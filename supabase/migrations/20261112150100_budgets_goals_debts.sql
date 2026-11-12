-- =====================================================================
-- LUJITOS · Fase 5 · Presupuestos, metas de ahorro, deudas y planificación
--
-- Todo se apoya en el motor de la Fase 4: saldo = inicial + movimientos no
-- anulados (transaction_effect) y escrituras solo por RPC.
--
-- Presupuestos   límite por categoría de gasto (o general) y período. Lo gastado
--                se calcula siempre de los movimientos: solo gastos reales. No
--                cuentan transferencias, ingresos, pagos de tarjeta ni anulados,
--                y una edición o anulación recalcula sola. Las alertas (50/75/90/
--                100 % y «superado», umbrales configurables) se guardan una sola
--                vez por período en budget_alerts.
-- Metas          lo ahorrado = ahorro inicial + aportes − retiros. Un aporte es
--                una asignación de dinero que ya tienes: no crea dinero ni cambia
--                el patrimonio. Si además se mueve dinero entre cuentas propias,
--                se registra una transferencia real enlazada al aporte.
-- Deudas         cada deuda lleva su saldo en una cuenta de tipo «loan» (saldo
--                negativo = lo que se debe), igual que una tarjeta. Un pago es una
--                transferencia: la cuenta de origen baja, la deuda baja y el
--                patrimonio no cambia. Un interés es un gasto que aumenta la
--                deuda. Nada se cuenta dos veces. Las tarjetas siguen siendo las
--                de la Fase 4: no hay un segundo sistema de tarjetas.
-- Planificación  activos, pasivos, patrimonio, flujos por mes, gastos fijos y
--                esenciales, obligaciones periódicas y capacidad de ahorro.
--
-- Códigos nuevos (la app los traduce):
--   LJ010 la meta quedaría con menos de cero (retiro o reversión)
--   LJ011 el pago supera lo que se debe (se puede confirmar: queda saldo a favor)
--   LJ012 ya hay un presupuesto activo para esa categoría y período
--   LJ013 tiene historial: se archiva en vez de borrarse
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cuentas de deuda («loan»): saldo inicial ≤ 0, como una tarjeta
-- ---------------------------------------------------------------------
alter table public.accounts drop constraint accounts_initial_balance_sign;
alter table public.accounts add constraint accounts_initial_balance_sign check (
  (account_type in ('credit_card', 'loan') and initial_balance <= 0)
  or (account_type not in ('credit_card', 'loan') and initial_balance >= 0)
);
comment on column public.accounts.initial_balance is
  'Dinero (≥ 0) o deuda de tarjeta o préstamo (≤ 0) al empezar a usar LUJITOS. No cambia si la cuenta ya tiene movimientos.';

create or replace function public.protect_account_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  has_movements boolean;
begin
  if new.user_id <> old.user_id then
    raise exception 'No se puede cambiar el dueño de una cuenta' using errcode = '42501';
  end if;

  -- Una cuenta de deuda está atada a su deuda: no cambia de tipo.
  if (new.account_type = 'loan') <> (old.account_type = 'loan') then
    raise exception 'Una deuda no se convierte en otro tipo de cuenta, ni al revés.' using errcode = 'LJ007';
  end if;

  if new.initial_balance is distinct from old.initial_balance
     or (new.account_type = 'credit_card') <> (old.account_type = 'credit_card') then
    select exists (
      select 1 from public.transactions t
      where t.user_id = old.user_id and (t.account_id = old.id or t.destination_account_id = old.id)
    ) into has_movements;
    if has_movements and new.initial_balance is distinct from old.initial_balance then
      raise exception 'El saldo inicial no se cambia cuando la cuenta ya tiene movimientos: usa «Ajustar saldo»'
        using errcode = 'LJ007';
    end if;
    if has_movements then
      raise exception 'Una cuenta con movimientos no puede pasar de tarjeta de crédito a otro tipo, ni al revés'
        using errcode = 'LJ007';
    end if;
  end if;

  if new.is_active and not old.is_active then
    new.archived_at := null;
  elsif not new.is_active and old.is_active then
    new.archived_at := coalesce(new.archived_at, now());
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Movimientos: para qué se hizo (lo ponen solo las funciones RPC)
-- ---------------------------------------------------------------------
alter table public.transactions add column purpose text;
alter table public.transactions add constraint transactions_purpose_shape check (
  purpose is null
  or (purpose in ('debt_installment', 'debt_extra', 'goal_contribution', 'goal_withdrawal') and type = 'transfer')
  or (purpose = 'debt_interest' and type = 'expense')
);
comment on column public.transactions.purpose is
  'Cuota o abono de una deuda, interés de una deuda, aporte o retiro de una meta. Solo etiqueta: el efecto en saldos lo da el tipo.';

-- Lo gastado por categoría y período (presupuestos).
create index transactions_expense_category_date_idx on public.transactions (user_id, category_id, transaction_date)
  where deleted_at is null and type = 'expense';

-- ---------------------------------------------------------------------
-- 3. Categorías: gasto fijo y gasto esencial (planificación)
-- ---------------------------------------------------------------------
alter table public.categories
  add column is_fixed boolean not null default false,
  add column is_essential boolean not null default false;
comment on column public.categories.is_fixed is 'Gasto fijo: se repite por un valor parecido cada mes (arriendo, servicios, suscripciones).';
comment on column public.categories.is_essential is 'Gasto esencial: no se puede dejar de pagar (comida, vivienda, salud…). Se usa en la capacidad de ahorro.';

update public.categories set is_essential = true
 where user_id is null and slug in ('food', 'transport', 'housing', 'utilities', 'health', 'education', 'taxes');
update public.categories set is_fixed = true
 where user_id is null and slug in ('housing', 'utilities', 'education', 'subscriptions', 'gym', 'taxes');

-- ---------------------------------------------------------------------
-- 4. Validación común de movimientos (nueva versión)
--    Cambios: una deuda no recibe ingresos; un interés o un desembolso no
--    tienen límite de saldo; un pago mayor que la deuda pide confirmación.
-- ---------------------------------------------------------------------
drop function private.check_movement(uuid, uuid, public.transaction_type, bigint, uuid, uuid, date, boolean, boolean, boolean, boolean);

create function private.check_movement(
  p_user uuid,
  p_exclude_transaction uuid,
  p_type public.transaction_type,
  p_amount bigint,
  p_account_id uuid,
  p_destination_account_id uuid,
  p_transaction_date date,
  p_require_active_source boolean,
  p_require_active_destination boolean,
  p_allow_negative boolean,
  p_allow_duplicate boolean,
  p_allow_overpay boolean
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_source public.accounts%rowtype;
  v_destination public.accounts%rowtype;
  v_balance bigint;
  v_after bigint;
  v_today date := (now() at time zone 'America/Bogota')::date;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 999999999999999 then
    raise exception 'Escribe un valor mayor que cero.' using errcode = 'LJ007';
  end if;
  if p_transaction_date is not null and (p_transaction_date > v_today or p_transaction_date < date '2000-01-01') then
    raise exception 'La fecha no es válida: no puede ser futura.' using errcode = 'LJ007';
  end if;

  perform 1 from public.accounts a
   where a.user_id = p_user and a.id in (p_account_id, p_destination_account_id)
   order by a.id
   for update;

  select * into v_source from public.accounts a where a.id = p_account_id and a.user_id = p_user;
  if not found then
    raise exception 'La cuenta no existe o no es tuya.' using errcode = 'LJ006';
  end if;
  if p_require_active_source and not v_source.is_active then
    raise exception 'La cuenta «%» está archivada.', v_source.name using errcode = 'LJ006';
  end if;
  if p_type = 'income' and v_source.account_type = 'loan' then
    raise exception 'Una deuda no recibe ingresos: registra un pago desde Deudas.' using errcode = 'LJ007';
  end if;

  if p_type = 'transfer' then
    if p_destination_account_id is null then
      raise exception 'Elige la cuenta de destino.' using errcode = 'LJ007';
    end if;
    if p_destination_account_id = p_account_id then
      raise exception 'El origen y el destino deben ser cuentas distintas.' using errcode = 'LJ007';
    end if;
    select * into v_destination from public.accounts a where a.id = p_destination_account_id and a.user_id = p_user;
    if not found then
      raise exception 'La cuenta de destino no existe o no es tuya.' using errcode = 'LJ006';
    end if;
    if p_require_active_destination and not v_destination.is_active then
      raise exception 'La cuenta «%» está archivada.', v_destination.name using errcode = 'LJ006';
    end if;
  end if;

  if p_type in ('expense', 'transfer') then
    v_balance := private.account_balance(p_account_id, p_exclude_transaction);
    v_after := v_balance - p_amount;
    if v_source.account_type = 'credit_card' then
      if v_source.credit_limit is not null and -v_after > v_source.credit_limit and not p_allow_negative then
        raise exception 'Supera el cupo disponible de «%».', v_source.name
          using errcode = 'LJ002', detail = greatest(v_source.credit_limit + v_balance, 0)::text;
      end if;
    elsif v_source.account_type = 'loan' then
      null; -- un interés o un desembolso aumentan la deuda: no hay saldo que se agote
    elsif v_after < 0 and not p_allow_negative then
      raise exception 'El saldo de «%» quedaría negativo.', v_source.name
        using errcode = 'LJ001', detail = v_after::text;
    end if;
  end if;

  -- Pago de una deuda por encima de lo que se debe: quedaría saldo a favor.
  if p_type = 'transfer' and v_destination.account_type = 'loan' and not p_allow_overpay then
    v_balance := private.account_balance(p_destination_account_id, p_exclude_transaction);
    if v_balance + p_amount > 0 then
      raise exception 'El pago supera lo que debes en «%».', v_destination.name
        using errcode = 'LJ011', detail = greatest(-v_balance, 0)::text;
    end if;
  end if;

  if p_type = 'transfer' and not p_allow_duplicate and exists (
    select 1 from public.transactions t
     where t.user_id = p_user and t.type = 'transfer' and t.deleted_at is null
       and t.account_id = p_account_id and t.destination_account_id = p_destination_account_id
       and t.amount = p_amount and t.created_at > now() - interval '2 minutes'
       and (p_exclude_transaction is null or t.id <> p_exclude_transaction)
  ) then
    raise exception 'Ya registraste esta misma transferencia hace un momento.' using errcode = 'LJ003';
  end if;
end;
$$;

-- Movimientos genéricos: la confirmación de saldo (p_allow_negative) cubre
-- también el aviso de pago mayor que la deuda.
create or replace function private.create_transaction(
  p_type public.transaction_type,
  p_amount bigint,
  p_account_id uuid,
  p_destination_account_id uuid default null,
  p_category_id uuid default null,
  p_transaction_date date default null,
  p_description text default '',
  p_merchant text default null,
  p_notes text default null,
  p_request_id uuid default null,
  p_allow_negative boolean default false,
  p_allow_duplicate boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Inicia sesión para registrar movimientos.' using errcode = '42501';
  end if;
  if p_type = 'adjustment' then
    raise exception 'Los ajustes se registran con «Ajustar saldo».' using errcode = 'LJ007';
  end if;
  if p_request_id is not null then
    select t.id into v_id from public.transactions t where t.user_id = v_user and t.client_request_id = p_request_id;
    if found then
      return v_id;
    end if;
  end if;

  perform private.check_movement(
    v_user, null, p_type, p_amount, p_account_id, p_destination_account_id, p_transaction_date,
    true, true, p_allow_negative, p_allow_duplicate, p_allow_negative
  );

  insert into public.transactions (
    user_id, account_id, destination_account_id, category_id, type, amount,
    description, merchant, notes, transaction_date, source, client_request_id
  )
  values (
    v_user, p_account_id,
    case when p_type = 'transfer' then p_destination_account_id end,
    case when p_type <> 'transfer' then p_category_id end,
    p_type, p_amount,
    btrim(coalesce(p_description, '')), nullif(btrim(coalesce(p_merchant, '')), ''), nullif(btrim(coalesce(p_notes, '')), ''),
    coalesce(p_transaction_date, (now() at time zone 'America/Bogota')::date), 'manual', p_request_id
  )
  on conflict (user_id, client_request_id) where client_request_id is not null do nothing
  returning id into v_id;

  if v_id is null then
    select t.id into v_id from public.transactions t where t.user_id = v_user and t.client_request_id = p_request_id;
  end if;
  return v_id;
end;
$$;

create or replace function private.update_transaction(
  p_transaction_id uuid,
  p_amount bigint,
  p_account_id uuid,
  p_destination_account_id uuid default null,
  p_category_id uuid default null,
  p_transaction_date date default null,
  p_description text default '',
  p_merchant text default null,
  p_notes text default null,
  p_allow_negative boolean default false,
  p_allow_duplicate boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_old public.transactions%rowtype;
begin
  select * into v_old from public.transactions t
   where t.id = p_transaction_id and t.user_id = v_user
   for update;
  if not found then
    raise exception 'El movimiento no existe o no es tuyo.' using errcode = 'LJ006';
  end if;
  if v_old.deleted_at is not null then
    raise exception 'Este movimiento está anulado y no se puede editar.' using errcode = 'LJ008';
  end if;
  if v_old.type = 'adjustment' then
    raise exception 'Un ajuste no se edita: anúlalo y vuelve a ajustar el saldo.' using errcode = 'LJ007';
  end if;

  perform 1 from public.accounts a
   where a.user_id = v_user
     and a.id in (v_old.account_id, v_old.destination_account_id, p_account_id, p_destination_account_id)
   order by a.id
   for update;

  perform private.check_movement(
    v_user, p_transaction_id, v_old.type, p_amount, p_account_id, p_destination_account_id,
    coalesce(p_transaction_date, v_old.transaction_date),
    p_account_id is distinct from v_old.account_id,
    p_destination_account_id is distinct from v_old.destination_account_id,
    p_allow_negative, p_allow_duplicate, p_allow_negative
  );

  update public.transactions set
    account_id = p_account_id,
    destination_account_id = case when v_old.type = 'transfer' then p_destination_account_id end,
    category_id = case when v_old.type <> 'transfer' then p_category_id end,
    amount = p_amount,
    transaction_date = coalesce(p_transaction_date, v_old.transaction_date),
    description = btrim(coalesce(p_description, '')),
    merchant = nullif(btrim(coalesce(p_merchant, '')), ''),
    notes = nullif(btrim(coalesce(p_notes, '')), '')
  where id = p_transaction_id;
  return p_transaction_id;
end;
$$;

-- Las cuentas de deuda se crean y editan desde Deudas (con sus datos).
create or replace function private.create_account(
  p_name text,
  p_account_type public.account_type,
  p_institution text default 'custom',
  p_institution_name text default null,
  p_initial_balance bigint default 0,
  p_credit_limit bigint default null,
  p_last_four_digits text default null,
  p_color text default null,
  p_icon text default null,
  p_description text default null,
  p_statement_day smallint default null,
  p_payment_due_day smallint default null,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_card boolean := p_account_type = 'credit_card';
begin
  if v_user is null then
    raise exception 'Inicia sesión para crear cuentas.' using errcode = '42501';
  end if;
  if p_account_type = 'loan' then
    raise exception 'Las deudas se registran en Deudas.' using errcode = 'LJ007';
  end if;
  if p_request_id is not null then
    select a.id into v_id from public.accounts a where a.user_id = v_user and a.client_request_id = p_request_id;
    if found then
      return v_id;
    end if;
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 60 then
    raise exception 'Escribe un nombre para la cuenta (máximo 60 caracteres).' using errcode = 'LJ007';
  end if;
  if coalesce(p_institution, 'custom') = 'custom' and char_length(btrim(coalesce(p_institution_name, ''))) = 0 then
    raise exception 'Escribe el nombre de la entidad.' using errcode = 'LJ007';
  end if;
  if v_card and p_initial_balance > 0 then
    raise exception 'La deuda inicial de una tarjeta no puede ser negativa.' using errcode = 'LJ007';
  end if;
  if not v_card and p_initial_balance < 0 then
    raise exception 'El saldo inicial debe ser cero o un valor positivo.' using errcode = 'LJ007';
  end if;
  if v_card and (p_credit_limit is null or p_credit_limit <= 0) then
    raise exception 'Escribe el cupo total de la tarjeta.' using errcode = 'LJ007';
  end if;

  insert into public.accounts (
    user_id, name, institution, institution_name, account_type, initial_balance, credit_limit,
    last_four_digits, color, icon, description, statement_day, payment_due_day, connection_type, client_request_id
  )
  values (
    v_user, btrim(p_name), coalesce(nullif(btrim(p_institution), ''), 'custom'),
    nullif(btrim(coalesce(p_institution_name, '')), ''), p_account_type, coalesce(p_initial_balance, 0),
    case when v_card then p_credit_limit end, nullif(p_last_four_digits, ''), p_color, p_icon,
    nullif(btrim(coalesce(p_description, '')), ''),
    case when v_card then p_statement_day end, case when v_card then p_payment_due_day end,
    'manual', p_request_id
  )
  on conflict (user_id, client_request_id) where client_request_id is not null do nothing
  returning id into v_id;

  if v_id is null then
    select a.id into v_id from public.accounts a where a.user_id = v_user and a.client_request_id = p_request_id;
  end if;
  return v_id;
end;
$$;

create or replace function private.update_account(
  p_account_id uuid,
  p_name text,
  p_account_type public.account_type,
  p_institution text,
  p_institution_name text,
  p_initial_balance bigint,
  p_credit_limit bigint,
  p_last_four_digits text,
  p_color text,
  p_icon text,
  p_description text,
  p_statement_day smallint,
  p_payment_due_day smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_card boolean := p_account_type = 'credit_card';
  v_current public.account_type;
begin
  if v_user is null then
    raise exception 'Inicia sesión.' using errcode = '42501';
  end if;
  select a.account_type into v_current from public.accounts a where a.id = p_account_id and a.user_id = v_user for update;
  if not found then
    raise exception 'La cuenta no existe o no es tuya.' using errcode = 'LJ006';
  end if;
  if v_current = 'loan' or p_account_type = 'loan' then
    raise exception 'Esta cuenta es una deuda: edítala desde Deudas.' using errcode = 'LJ007';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 60 then
    raise exception 'Escribe un nombre para la cuenta (máximo 60 caracteres).' using errcode = 'LJ007';
  end if;
  if coalesce(p_institution, 'custom') = 'custom' and char_length(btrim(coalesce(p_institution_name, ''))) = 0 then
    raise exception 'Escribe el nombre de la entidad.' using errcode = 'LJ007';
  end if;
  if (v_card and p_initial_balance > 0) or (not v_card and p_initial_balance < 0) then
    raise exception 'El saldo inicial no es válido para este tipo de cuenta.' using errcode = 'LJ007';
  end if;
  if v_card and (p_credit_limit is null or p_credit_limit <= 0) then
    raise exception 'Escribe el cupo total de la tarjeta.' using errcode = 'LJ007';
  end if;

  update public.accounts set
    name = btrim(p_name),
    account_type = p_account_type,
    institution = coalesce(nullif(btrim(p_institution), ''), 'custom'),
    institution_name = nullif(btrim(coalesce(p_institution_name, '')), ''),
    initial_balance = coalesce(p_initial_balance, 0),
    credit_limit = case when v_card then p_credit_limit end,
    last_four_digits = nullif(p_last_four_digits, ''),
    color = p_color,
    icon = p_icon,
    description = nullif(btrim(coalesce(p_description, '')), ''),
    statement_day = case when v_card then p_statement_day end,
    payment_due_day = case when v_card then p_payment_due_day end
  where id = p_account_id and user_id = v_user;
  return p_account_id;
end;
$$;

-- =====================================================================
-- 5. PRESUPUESTOS
-- =====================================================================
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- NULL = presupuesto general (todos los gastos).
  category_id uuid references public.categories (id) on delete cascade,
  name text check (name is null or char_length(btrim(name)) between 1 and 60),
  limit_amount bigint not null check (limit_amount > 0 and limit_amount <= 999999999999999),
  period text not null check (period in ('weekly', 'monthly', 'yearly', 'custom')),
  start_date date not null default ((now() at time zone 'America/Bogota')::date),
  end_date date,
  alert_thresholds smallint[] not null default '{50,75,90,100}',
  archived_at timestamptz,
  client_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budgets_dates check (end_date is null or end_date >= start_date),
  constraint budgets_custom_needs_end check (period <> 'custom' or end_date is not null),
  constraint budgets_thresholds check (
    cardinality(alert_thresholds) <= 6
    and array_position(alert_thresholds, null) is null
    and 1 <= all (alert_thresholds)
    and 100 >= all (alert_thresholds)
  )
);
comment on table public.budgets is
  'Presupuestos. Semanal = lunes a domingo; mensual = mes calendario; anual = año calendario; personalizado = de start_date a end_date.';

create index budgets_user_idx on public.budgets (user_id) where archived_at is null;
create index budgets_category_idx on public.budgets (category_id);
create unique index budgets_one_active_key on public.budgets (
  user_id, coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid), period
) where archived_at is null and period <> 'custom';
create unique index budgets_request_key on public.budgets (user_id, client_request_id) where client_request_id is not null;
create trigger budgets_set_updated_at before update on public.budgets
  for each row execute function public.set_updated_at();

-- Alertas: una por umbral y período; «exceeded» = gastaste más que el límite.
create table public.budget_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  budget_id uuid not null references public.budgets (id) on delete cascade,
  period_start date not null,
  kind text not null check (kind in ('threshold', 'exceeded')),
  threshold smallint not null check (threshold between 1 and 100),
  spent bigint not null,
  limit_amount bigint not null,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  constraint budget_alerts_once_per_period unique (budget_id, period_start, kind, threshold),
  constraint budget_alerts_exceeded_shape check (kind = 'threshold' or threshold = 100)
);
create index budget_alerts_user_idx on public.budget_alerts (user_id, created_at desc);
comment on table public.budget_alerts is
  'Avisos de presupuesto ya generados (no se repiten en el mismo período). spent y limit_amount: valores al momento del aviso.';

-- Inicio y fin del período de un presupuesto que contiene la fecha p_ref.
create or replace function public.budget_period_bounds(p_period text, p_start date, p_end date, p_ref date)
returns table (period_start date, period_end date)
language sql
immutable
parallel safe
set search_path = ''
as $$
  select
    case p_period
      when 'weekly' then date_trunc('week', p_ref::timestamp)::date
      when 'monthly' then date_trunc('month', p_ref::timestamp)::date
      when 'yearly' then date_trunc('year', p_ref::timestamp)::date
      else p_start
    end,
    case p_period
      when 'weekly' then (date_trunc('week', p_ref::timestamp) + interval '6 days')::date
      when 'monthly' then (date_trunc('month', p_ref::timestamp) + interval '1 month' - interval '1 day')::date
      when 'yearly' then (date_trunc('year', p_ref::timestamp) + interval '1 year' - interval '1 day')::date
      else p_end
    end
$$;

-- Estado actual de cada presupuesto (siempre calculado de los movimientos).
create view public.budget_status
with (security_invoker = true)
as
with ref as (select (now() at time zone 'America/Bogota')::date as today)
select
  b.id as budget_id,
  b.user_id,
  cur.period_start,
  cur.period_end,
  b.limit_amount,
  s.spent,
  (b.limit_amount - s.spent)::bigint as available,
  round(s.spent * 100.0 / b.limit_amount, 2) as percent_used,
  case
    when b.archived_at is not null then 'archived'
    when r.today < b.start_date then 'scheduled'
    when b.end_date is not null and r.today > b.end_date then 'ended'
    when s.spent > b.limit_amount then 'exceeded'
    else 'active'
  end as status,
  greatest(cur.period_end - r.today, 0) as days_left,
  case when b.period <> 'custom' then prev.period_start end as previous_period_start,
  case when b.period <> 'custom' then ps.spent end as previous_spent
from public.budgets b
cross join ref r
cross join lateral public.budget_period_bounds(b.period, b.start_date, b.end_date, r.today) cur
cross join lateral public.budget_period_bounds(b.period, b.start_date, b.end_date, cur.period_start - 1) prev
cross join lateral (
  select coalesce(sum(t.amount), 0)::bigint as spent
    from public.transactions t
   where t.user_id = b.user_id and t.type = 'expense' and t.deleted_at is null
     and t.transaction_date between cur.period_start and cur.period_end
     and (b.category_id is null or t.category_id = b.category_id)
) s
cross join lateral (
  select coalesce(sum(t.amount), 0)::bigint as spent
    from public.transactions t
   where t.user_id = b.user_id and t.type = 'expense' and t.deleted_at is null
     and t.transaction_date between prev.period_start and prev.period_end
     and (b.category_id is null or t.category_id = b.category_id)
) ps;
comment on view public.budget_status is
  'Gastado, disponible y % del período actual, y lo gastado en el período anterior. Solo gastos reales no anulados. Respeta RLS.';

-- Períodos anteriores (desde el período en que empezó el presupuesto).
create or replace function public.budget_history(p_budget_id uuid, p_periods integer default 6)
returns table (period_start date, period_end date, spent bigint, limit_amount bigint, percent_used numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with b as (
    select bb.*, (now() at time zone 'America/Bogota')::date as today
      from public.budgets bb
     where bb.id = p_budget_id
  ),
  refs as (
    select case b.period
        when 'weekly' then b.today - 7 * g
        when 'monthly' then (date_trunc('month', b.today::timestamp) - make_interval(months => g))::date
        when 'yearly' then (date_trunc('year', b.today::timestamp) - make_interval(years => g))::date
        else b.start_date
      end as ref
      from b, generate_series(0, case when b.period = 'custom' then 0
                                      else least(greatest(coalesce(p_periods, 6), 1), 36) - 1 end) g
  )
  select p.period_start, p.period_end, s.spent, b.limit_amount, round(s.spent * 100.0 / b.limit_amount, 2)
    from b
   cross join refs
   cross join lateral public.budget_period_bounds(b.period, b.start_date, b.end_date, refs.ref) p
   cross join lateral (
     select coalesce(sum(t.amount), 0)::bigint as spent
       from public.transactions t
      where t.user_id = b.user_id and t.type = 'expense' and t.deleted_at is null
        and t.transaction_date between p.period_start and p.period_end
        and (b.category_id is null or t.category_id = b.category_id)
   ) s
   where p.period_end >= (select x.period_start from public.budget_period_bounds(b.period, b.start_date, b.end_date, b.start_date) x)
   order by p.period_start desc
$$;

-- Genera los avisos que correspondan en el período actual (sin repetir).
create or replace function private.evaluate_budget_alerts(p_user uuid, p_budget uuid, p_category uuid, p_date date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_total integer := 0;
  v_rows integer;
  v_spent bigint;
  r record;
begin
  for r in
    select b.id, b.category_id, b.limit_amount, b.alert_thresholds, p.period_start, p.period_end
      from public.budgets b
     cross join lateral public.budget_period_bounds(b.period, b.start_date, b.end_date, v_today) p
     where b.user_id = p_user
       and b.archived_at is null
       and v_today >= b.start_date
       and (b.end_date is null or v_today <= b.end_date)
       and (p_budget is null or b.id = p_budget)
       and (p_budget is not null or b.category_id is null or b.category_id = p_category)
       and (p_date is null or p_date between p.period_start and p.period_end)
  loop
    select coalesce(sum(t.amount), 0) into v_spent
      from public.transactions t
     where t.user_id = p_user and t.type = 'expense' and t.deleted_at is null
       and t.transaction_date between r.period_start and r.period_end
       and (r.category_id is null or t.category_id = r.category_id);

    -- Comparación exacta en enteros: gastado × 100 ≥ umbral × límite.
    insert into public.budget_alerts (user_id, budget_id, period_start, kind, threshold, spent, limit_amount)
    select p_user, r.id, r.period_start, 'threshold', th, v_spent, r.limit_amount
      from unnest(r.alert_thresholds) as th
     where v_spent * 100 >= th::bigint * r.limit_amount
    on conflict do nothing;
    get diagnostics v_rows = row_count;
    v_total := v_total + v_rows;

    if v_spent > r.limit_amount then
      insert into public.budget_alerts (user_id, budget_id, period_start, kind, threshold, spent, limit_amount)
      values (p_user, r.id, r.period_start, 'exceeded', 100, v_spent, r.limit_amount)
      on conflict do nothing;
      get diagnostics v_rows = row_count;
      v_total := v_total + v_rows;
    end if;
  end loop;
  return v_total;
end;
$$;

create or replace function private.on_expense_check_budgets()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type = 'expense' and new.deleted_at is null then
    perform private.evaluate_budget_alerts(new.user_id, null, new.category_id, new.transaction_date);
  end if;
  return null;
end;
$$;

create trigger transactions_budget_alerts
  after insert or update of amount, category_id, transaction_date, deleted_at on public.transactions
  for each row execute function private.on_expense_check_budgets();

create or replace function private.normalize_thresholds(p_thresholds integer[])
returns smallint[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v smallint[];
begin
  if p_thresholds is null then
    return '{50,75,90,100}'::smallint[];
  end if;
  if exists (select 1 from unnest(p_thresholds) x where x is null or x < 1 or x > 100) then
    raise exception 'Cada aviso debe estar entre 1 y 100.' using errcode = 'LJ007';
  end if;
  select coalesce(array_agg(distinct x::smallint order by x::smallint), '{}') into v from unnest(p_thresholds) x;
  if cardinality(v) > 6 then
    raise exception 'Elige hasta 6 avisos.' using errcode = 'LJ007';
  end if;
  return v;
end;
$$;

create or replace function private.check_budget(
  p_user uuid,
  p_budget uuid,
  p_category uuid,
  p_limit bigint,
  p_period text,
  p_start date,
  p_end date,
  p_name text,
  p_check_duplicate boolean
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_category public.categories%rowtype;
  v_old_category uuid;
begin
  if p_limit is null or p_limit <= 0 or p_limit > 999999999999999 then
    raise exception 'Escribe un límite mayor que cero.' using errcode = 'LJ007';
  end if;
  if p_period is null or p_period not in ('weekly', 'monthly', 'yearly', 'custom') then
    raise exception 'Elige el período del presupuesto.' using errcode = 'LJ007';
  end if;
  if p_start is null or p_start < date '2000-01-01' then
    raise exception 'La fecha de inicio no es válida.' using errcode = 'LJ007';
  end if;
  if p_period = 'custom' and p_end is null then
    raise exception 'Elige la fecha final del período.' using errcode = 'LJ007';
  end if;
  if p_end is not null and p_end < p_start then
    raise exception 'La fecha final debe ser igual o posterior a la inicial.' using errcode = 'LJ007';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) > 60 then
    raise exception 'El nombre puede tener hasta 60 caracteres.' using errcode = 'LJ007';
  end if;

  if p_category is not null then
    select * into v_category from public.categories c
     where c.id = p_category and (c.user_id is null or c.user_id = p_user);
    if not found then
      raise exception 'La categoría no existe.' using errcode = 'LJ006';
    end if;
    if v_category.type <> 'expense' then
      raise exception 'Los presupuestos son para categorías de gasto.' using errcode = 'LJ007';
    end if;
    if p_budget is not null then
      select b.category_id into v_old_category from public.budgets b where b.id = p_budget;
    end if;
    if v_category.archived_at is not null and (p_budget is null or v_old_category is distinct from p_category) then
      raise exception 'La categoría está archivada.' using errcode = 'LJ006';
    end if;
  end if;

  if p_check_duplicate and p_period <> 'custom' and exists (
    select 1 from public.budgets b
     where b.user_id = p_user and b.archived_at is null and b.period = p_period
       and b.category_id is not distinct from p_category
       and (p_budget is null or b.id <> p_budget)
  ) then
    raise exception 'Ya tienes un presupuesto activo para esa categoría y período.' using errcode = 'LJ012';
  end if;
end;
$$;

create function private.create_budget(
  p_category_id uuid,
  p_limit_amount bigint,
  p_period text,
  p_start_date date default null,
  p_end_date date default null,
  p_name text default null,
  p_alert_thresholds integer[] default null,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_start date := coalesce(p_start_date, (now() at time zone 'America/Bogota')::date);
  v_thresholds smallint[];
begin
  if v_user is null then
    raise exception 'Inicia sesión.' using errcode = '42501';
  end if;
  if p_request_id is not null then
    select b.id into v_id from public.budgets b where b.user_id = v_user and b.client_request_id = p_request_id;
    if found then
      return v_id;
    end if;
  end if;
  perform private.check_budget(v_user, null, p_category_id, p_limit_amount, p_period, v_start, p_end_date, p_name, true);
  v_thresholds := private.normalize_thresholds(p_alert_thresholds);

  insert into public.budgets (user_id, category_id, name, limit_amount, period, start_date, end_date, alert_thresholds, client_request_id)
  values (v_user, p_category_id, nullif(btrim(coalesce(p_name, '')), ''), p_limit_amount, p_period, v_start, p_end_date,
          v_thresholds, p_request_id)
  on conflict (user_id, client_request_id) where client_request_id is not null do nothing
  returning id into v_id;

  if v_id is null then
    select b.id into v_id from public.budgets b where b.user_id = v_user and b.client_request_id = p_request_id;
  end if;
  perform private.evaluate_budget_alerts(v_user, v_id, null, null);
  return v_id;
end;
$$;

create function private.update_budget(
  p_budget_id uuid,
  p_category_id uuid,
  p_limit_amount bigint,
  p_period text,
  p_start_date date,
  p_end_date date,
  p_name text,
  p_alert_thresholds integer[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_old public.budgets%rowtype;
  v_thresholds smallint[];
begin
  select * into v_old from public.budgets b where b.id = p_budget_id and b.user_id = v_user for update;
  if not found then
    raise exception 'El presupuesto no existe o no es tuyo.' using errcode = 'LJ006';
  end if;
  perform private.check_budget(v_user, p_budget_id, p_category_id, p_limit_amount, p_period,
    coalesce(p_start_date, v_old.start_date), p_end_date, p_name, v_old.archived_at is null);
  v_thresholds := private.normalize_thresholds(p_alert_thresholds);

  update public.budgets set
    category_id = p_category_id,
    name = nullif(btrim(coalesce(p_name, '')), ''),
    limit_amount = p_limit_amount,
    period = p_period,
    start_date = coalesce(p_start_date, v_old.start_date),
    end_date = p_end_date,
    alert_thresholds = v_thresholds
  where id = p_budget_id;
  perform private.evaluate_budget_alerts(v_user, p_budget_id, null, null);
  return p_budget_id;
end;
$$;

-- Archivar: deja de aplicarse y de avisar; conserva su historial.
create function private.archive_budget(p_budget_id uuid, p_archived boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_old public.budgets%rowtype;
begin
  select * into v_old from public.budgets b where b.id = p_budget_id and b.user_id = v_user for update;
  if not found then
    raise exception 'El presupuesto no existe o no es tuyo.' using errcode = 'LJ006';
  end if;
  if p_archived then
    if v_old.archived_at is null then
      update public.budgets set archived_at = now() where id = p_budget_id;
    end if;
    return;
  end if;
  if v_old.archived_at is null then
    return;
  end if;
  perform private.check_budget(v_user, p_budget_id, v_old.category_id, v_old.limit_amount, v_old.period,
    v_old.start_date, v_old.end_date, v_old.name, true);
  update public.budgets set archived_at = null where id = p_budget_id;
  perform private.evaluate_budget_alerts(v_user, p_budget_id, null, null);
end;
$$;

-- Borrar un presupuesto no toca ningún movimiento (el historial financiero queda).
create function private.delete_budget(p_budget_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.budgets where id = p_budget_id and user_id = auth.uid();
  if not found then
    raise exception 'El presupuesto no existe o no es tuyo.' using errcode = 'LJ006';
  end if;
end;
$$;

-- =====================================================================
-- 6. METAS DE AHORRO
-- =====================================================================
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  description text check (description is null or char_length(description) <= 280),
  kind text not null default 'other'
    check (kind in ('emergency', 'travel', 'home', 'vehicle', 'education', 'retirement', 'purchase', 'other')),
  target_amount bigint not null check (target_amount > 0 and target_amount <= 999999999999999),
  -- Lo que ya tenías ahorrado para esta meta al crearla (asignación, no dinero nuevo).
  initial_saved bigint not null default 0 check (initial_saved >= 0 and initial_saved <= 999999999999999),
  start_date date not null default ((now() at time zone 'America/Bogota')::date),
  target_date date,
  -- Cuenta donde está el dinero de la meta. NULL = sin cuenta asignada.
  account_id uuid,
  color text check (color is null or color ~ '^(#[0-9A-Fa-f]{6}|[a-z]{3,12})$'),
  icon text check (icon is null or char_length(icon) <= 60),
  archived_at timestamptz,
  client_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_goals_id_user_unique unique (id, user_id),
  constraint savings_goals_account_fk foreign key (account_id, user_id)
    references public.accounts (id, user_id) on delete no action,
  constraint savings_goals_dates check (target_date is null or target_date >= start_date)
);
create index savings_goals_user_idx on public.savings_goals (user_id);
create index savings_goals_account_idx on public.savings_goals (account_id, user_id);
create unique index savings_goals_request_key on public.savings_goals (user_id, client_request_id)
  where client_request_id is not null;
create trigger savings_goals_set_updated_at before update on public.savings_goals
  for each row execute function public.set_updated_at();

create table public.savings_goal_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null,
  kind text not null check (kind in ('contribution', 'withdrawal')),
  amount bigint not null check (amount > 0 and amount <= 999999999999999),
  movement_date date not null default ((now() at time zone 'America/Bogota')::date),
  note text check (note is null or char_length(note) <= 200),
  -- Transferencia real entre cuentas propias, si el aporte movió dinero.
  transaction_id uuid references public.transactions (id) on delete no action,
  voided_at timestamptz,
  void_reason text check (void_reason is null or char_length(void_reason) <= 200),
  client_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_goal_movements_goal_fk foreign key (goal_id, user_id)
    references public.savings_goals (id, user_id) on delete cascade,
  constraint savings_goal_movements_void_reason check (void_reason is null or voided_at is not null)
);
create index savings_goal_movements_goal_idx on public.savings_goal_movements (goal_id, movement_date desc);
create index savings_goal_movements_user_idx on public.savings_goal_movements (user_id);
create unique index savings_goal_movements_transaction_key on public.savings_goal_movements (transaction_id)
  where transaction_id is not null;
create unique index savings_goal_movements_request_key on public.savings_goal_movements (user_id, client_request_id)
  where client_request_id is not null;
create trigger savings_goal_movements_set_updated_at before update on public.savings_goal_movements
  for each row execute function public.set_updated_at();

-- Progreso de cada meta. Ahorro recomendado solo si la meta sigue activa y la
-- fecha no pasó; si venció, no se recomienda nada negativo: estado «overdue».
create view public.savings_goal_progress
with (security_invoker = true)
as
with sums as (
  select g.id,
    coalesce(sum(m.amount) filter (where m.kind = 'contribution'), 0)::bigint as contributed,
    coalesce(sum(m.amount) filter (where m.kind = 'withdrawal'), 0)::bigint as withdrawn,
    count(m.id) as movement_count,
    max(m.movement_date) as last_movement_date
  from public.savings_goals g
  left join public.savings_goal_movements m on m.goal_id = g.id and m.voided_at is null
  group by g.id
),
calc as (
  select g.id as goal_id, g.user_id, g.target_amount, g.target_date, g.account_id, g.archived_at,
    s.contributed, s.withdrawn, s.movement_count, s.last_movement_date,
    greatest(g.initial_saved + s.contributed - s.withdrawn, 0)::bigint as saved,
    (now() at time zone 'America/Bogota')::date as today
  from public.savings_goals g
  join sums s on s.id = g.id
),
state as (
  select c.*,
    case
      when c.archived_at is not null then 'archived'
      when c.saved >= c.target_amount then 'completed'
      when c.target_date is not null and c.target_date < c.today then 'overdue'
      else 'active'
    end as status,
    greatest(c.target_amount - c.saved, 0)::bigint as remaining
  from calc c
)
select
  s.goal_id,
  s.user_id,
  s.saved,
  s.contributed,
  s.withdrawn,
  s.remaining,
  round(s.saved * 100.0 / s.target_amount, 2) as percent,
  greatest(s.saved - s.target_amount, 0)::bigint as exceeded_by,
  (s.target_date - s.today) as days_left,
  s.status,
  case when s.status = 'active' and s.target_date is not null then
    ceil(s.remaining / greatest(ceil((s.target_date - s.today) / 30.4375), 1))::bigint end as monthly_needed,
  case when s.status = 'active' and s.target_date is not null then
    ceil(s.remaining / greatest(ceil((s.target_date - s.today) / 7.0), 1))::bigint end as weekly_needed,
  case when s.status = 'active' and s.target_date is not null then
    ceil(s.remaining::numeric / greatest(s.target_date - s.today, 1))::bigint end as daily_needed,
  (s.account_id is null) as unassigned,
  ab.balance as account_balance,
  case when s.account_id is not null then
    (sum(s.saved) filter (where s.archived_at is null) over (partition by s.account_id))::bigint end as account_allocated,
  s.movement_count,
  s.last_movement_date
from state s
left join public.account_balances ab on ab.account_id = s.account_id;
comment on view public.savings_goal_progress is
  'Lo ahorrado (inicial + aportes − retiros no revertidos), lo que falta, %, días y ahorro recomendado. No es dinero aparte: no suma al patrimonio.';

-- Lo ahorrado sin recortar (para validar retiros y reversiones).
create or replace function private.goal_saved(p_goal_id uuid, p_exclude_movement uuid default null)
returns bigint
language sql
stable
set search_path = ''
as $$
  select (g.initial_saved + coalesce((
    select sum(case m.kind when 'contribution' then m.amount else -m.amount end)
      from public.savings_goal_movements m
     where m.goal_id = g.id and m.voided_at is null
       and (p_exclude_movement is null or m.id <> p_exclude_movement)
  ), 0))::bigint
  from public.savings_goals g
  where g.id = p_goal_id
$$;

create or replace function private.check_goal(
  p_user uuid,
  p_name text,
  p_target bigint,
  p_initial bigint,
  p_start date,
  p_target_date date,
  p_kind text,
  p_account uuid,
  p_description text,
  p_require_active_account boolean
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_account public.accounts%rowtype;
begin
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 60 then
    raise exception 'Escribe un nombre para la meta (máximo 60 caracteres).' using errcode = 'LJ007';
  end if;
  if p_target is null or p_target <= 0 or p_target > 999999999999999 then
    raise exception 'Escribe cuánto quieres ahorrar.' using errcode = 'LJ007';
  end if;
  if p_initial is null or p_initial < 0 or p_initial > 999999999999999 then
    raise exception 'Lo ahorrado al empezar no puede ser negativo.' using errcode = 'LJ007';
  end if;
  if p_start is null or p_start < date '2000-01-01' then
    raise exception 'La fecha de inicio no es válida.' using errcode = 'LJ007';
  end if;
  if p_target_date is not null and p_target_date < p_start then
    raise exception 'La fecha objetivo debe ser posterior al inicio.' using errcode = 'LJ007';
  end if;
  if p_kind is null or p_kind not in ('emergency', 'travel', 'home', 'vehicle', 'education', 'retirement', 'purchase', 'other') then
    raise exception 'Elige el tipo de meta.' using errcode = 'LJ007';
  end if;
  if char_length(coalesce(p_description, '')) > 280 then
    raise exception 'La descripción puede tener hasta 280 caracteres.' using errcode = 'LJ007';
  end if;
  if p_account is not null then
    select * into v_account from public.accounts a where a.id = p_account and a.user_id = p_user;
    if not found then
      raise exception 'La cuenta no existe o no es tuya.' using errcode = 'LJ006';
    end if;
    if v_account.account_type in ('credit_card', 'loan') then
      raise exception 'Elige una cuenta con dinero, no una tarjeta ni una deuda.' using errcode = 'LJ007';
    end if;
    if p_require_active_account and not v_account.is_active then
      raise exception 'La cuenta «%» está archivada.', v_account.name using errcode = 'LJ006';
    end if;
  end if;
end;
$$;

create function private.create_savings_goal(
  p_name text,
  p_target_amount bigint,
  p_initial_saved bigint default 0,
  p_target_date date default null,
  p_start_date date default null,
  p_kind text default 'other',
  p_account_id uuid default null,
  p_description text default null,
  p_color text default null,
  p_icon text default null,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_start date := coalesce(p_start_date, (now() at time zone 'America/Bogota')::date);
begin
  if v_user is null then
    raise exception 'Inicia sesión.' using errcode = '42501';
  end if;
  if p_request_id is not null then
    select g.id into v_id from public.savings_goals g where g.user_id = v_user and g.client_request_id = p_request_id;
    if found then
      return v_id;
    end if;
  end if;
  perform private.check_goal(v_user, p_name, p_target_amount, coalesce(p_initial_saved, 0), v_start, p_target_date,
    coalesce(p_kind, 'other'), p_account_id, p_description, true);

  insert into public.savings_goals (
    user_id, name, description, kind, target_amount, initial_saved, start_date, target_date, account_id, color, icon, client_request_id
  )
  values (
    v_user, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), coalesce(p_kind, 'other'), p_target_amount,
    coalesce(p_initial_saved, 0), v_start, p_target_date, p_account_id, p_color, p_icon, p_request_id
  )
  on conflict (user_id, client_request_id) where client_request_id is not null do nothing
  returning id into v_id;

  if v_id is null then
    select g.id into v_id from public.savings_goals g where g.user_id = v_user and g.client_request_id = p_request_id;
  end if;
  return v_id;
end;
$$;

create function private.update_savings_goal(
  p_goal_id uuid,
  p_name text,
  p_target_amount bigint,
  p_initial_saved bigint,
  p_target_date date,
  p_start_date date,
  p_kind text,
  p_account_id uuid,
  p_description text,
  p_color text,
  p_icon text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_old public.savings_goals%rowtype;
begin
  select * into v_old from public.savings_goals g where g.id = p_goal_id and g.user_id = v_user for update;
  if not found then
    raise exception 'La meta no existe o no es tuya.' using errcode = 'LJ006';
  end if;
  perform private.check_goal(v_user, p_name, p_target_amount, coalesce(p_initial_saved, 0),
    coalesce(p_start_date, v_old.start_date), p_target_date, coalesce(p_kind, v_old.kind), p_account_id, p_description,
    p_account_id is distinct from v_old.account_id);
  -- Bajar lo ahorrado al empezar no puede dejar la meta en negativo.
  if private.goal_saved(p_goal_id) - v_old.initial_saved + coalesce(p_initial_saved, 0) < 0 then
    raise exception 'La meta quedaría con menos de cero: revisa los retiros.' using errcode = 'LJ010';
  end if;

  update public.savings_goals set
    name = btrim(p_name),
    description = nullif(btrim(coalesce(p_description, '')), ''),
    kind = coalesce(p_kind, v_old.kind),
    target_amount = p_target_amount,
    initial_saved = coalesce(p_initial_saved, 0),
    start_date = coalesce(p_start_date, v_old.start_date),
    target_date = p_target_date,
    account_id = p_account_id,
    color = p_color,
    icon = p_icon
  where id = p_goal_id;
  return p_goal_id;
end;
$$;

create function private.archive_savings_goal(p_goal_id uuid, p_archived boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.savings_goals
     set archived_at = case when p_archived then coalesce(archived_at, now()) end
   where id = p_goal_id and user_id = auth.uid();
  if not found then
    raise exception 'La meta no existe o no es tuya.' using errcode = 'LJ006';
  end if;
end;
$$;

create function private.delete_savings_goal(p_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  perform 1 from public.savings_goals g where g.id = p_goal_id and g.user_id = v_user for update;
  if not found then
    raise exception 'La meta no existe o no es tuya.' using errcode = 'LJ006';
  end if;
  if exists (select 1 from public.savings_goal_movements m where m.goal_id = p_goal_id) then
    raise exception 'La meta tiene aportes o retiros registrados: archívala para conservar el historial.'
      using errcode = 'LJ013';
  end if;
  delete from public.savings_goals where id = p_goal_id and user_id = v_user;
end;
$$;

-- Aporte o retiro. Sin cuenta: solo asignación (el dinero ya estaba). Con
-- cuenta: además una transferencia real entre cuentas propias, enlazada.
create function private.add_goal_movement(
  p_goal_id uuid,
  p_kind text,
  p_amount bigint,
  p_movement_date date default null,
  p_note text default null,
  p_account_id uuid default null,
  p_request_id uuid default null,
  p_allow_negative boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_goal public.savings_goals%rowtype;
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_date date := coalesce(p_movement_date, (now() at time zone 'America/Bogota')::date);
  v_saved bigint;
  v_source uuid;
  v_destination uuid;
  v_transaction uuid;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Inicia sesión.' using errcode = '42501';
  end if;
  select * into v_goal from public.savings_goals g where g.id = p_goal_id and g.user_id = v_user for update;
  if not found then
    raise exception 'La meta no existe o no es tuya.' using errcode = 'LJ006';
  end if;
  -- Idempotencia (después del bloqueo: dos envíos iguales no se cruzan).
  if p_request_id is not null then
    select m.id into v_id from public.savings_goal_movements m where m.user_id = v_user and m.client_request_id = p_request_id;
    if found then
      return v_id;
    end if;
  end if;
  if v_goal.archived_at is not null then
    raise exception 'La meta está archivada.' using errcode = 'LJ006';
  end if;
  if p_kind is null or p_kind not in ('contribution', 'withdrawal') then
    raise exception 'Elige si es un aporte o un retiro.' using errcode = 'LJ007';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 999999999999999 then
    raise exception 'Escribe un valor mayor que cero.' using errcode = 'LJ007';
  end if;
  if v_date > v_today or v_date < date '2000-01-01' then
    raise exception 'La fecha no es válida: no puede ser futura.' using errcode = 'LJ007';
  end if;
  if char_length(coalesce(p_note, '')) > 200 then
    raise exception 'La nota puede tener hasta 200 caracteres.' using errcode = 'LJ007';
  end if;

  v_saved := private.goal_saved(p_goal_id);
  if p_kind = 'withdrawal' and p_amount > v_saved then
    raise exception 'No puedes retirar más de lo ahorrado en la meta.' using errcode = 'LJ010', detail = greatest(v_saved, 0)::text;
  end if;

  if p_account_id is not null then
    if v_goal.account_id is null then
      raise exception 'Asigna una cuenta a la meta para mover dinero.' using errcode = 'LJ007';
    end if;
    if p_account_id = v_goal.account_id then
      raise exception 'Elige otra cuenta: el dinero ya está en la cuenta de la meta.' using errcode = 'LJ007';
    end if;
    v_source := case when p_kind = 'contribution' then p_account_id else v_goal.account_id end;
    v_destination := case when p_kind = 'contribution' then v_goal.account_id else p_account_id end;
    perform private.check_movement(v_user, null, 'transfer', p_amount, v_source, v_destination, v_date,
      true, true, p_allow_negative, true, false);
    insert into public.transactions (
      user_id, account_id, destination_account_id, type, amount, description, transaction_date, source, purpose, client_request_id
    )
    values (
      v_user, v_source, v_destination, 'transfer', p_amount,
      case when p_kind = 'contribution' then 'Aporte a «' || v_goal.name || '»' else 'Retiro de «' || v_goal.name || '»' end,
      v_date, 'manual', 'goal_' || p_kind, p_request_id
    )
    returning id into v_transaction;
  end if;

  insert into public.savings_goal_movements (user_id, goal_id, kind, amount, movement_date, note, transaction_id, client_request_id)
  values (v_user, p_goal_id, p_kind, p_amount, v_date, nullif(btrim(coalesce(p_note, '')), ''), v_transaction, p_request_id)
  returning id into v_id;
  return v_id;
end;
$$;

create function private.update_goal_movement(
  p_movement_id uuid,
  p_amount bigint,
  p_movement_date date default null,
  p_note text default null,
  p_allow_negative boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_old public.savings_goal_movements%rowtype;
  v_transaction public.transactions%rowtype;
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_date date;
  v_saved_without bigint;
begin
  select * into v_old from public.savings_goal_movements m where m.id = p_movement_id and m.user_id = v_user;
  if not found then
    raise exception 'El movimiento de la meta no existe o no es tuyo.' using errcode = 'LJ006';
  end if;
  -- Siempre se bloquea primero la meta y luego el movimiento.
  perform 1 from public.savings_goals g where g.id = v_old.goal_id for update;
  select * into v_old from public.savings_goal_movements m where m.id = p_movement_id for update;
  if v_old.voided_at is not null then
    raise exception 'Este movimiento está revertido y no se puede editar.' using errcode = 'LJ008';
  end if;
  v_date := coalesce(p_movement_date, v_old.movement_date);
  if p_amount is null or p_amount <= 0 or p_amount > 999999999999999 then
    raise exception 'Escribe un valor mayor que cero.' using errcode = 'LJ007';
  end if;
  if v_date > v_today or v_date < date '2000-01-01' then
    raise exception 'La fecha no es válida: no puede ser futura.' using errcode = 'LJ007';
  end if;
  if char_length(coalesce(p_note, '')) > 200 then
    raise exception 'La nota puede tener hasta 200 caracteres.' using errcode = 'LJ007';
  end if;

  v_saved_without := private.goal_saved(v_old.goal_id, p_movement_id);
  if v_saved_without + (case when v_old.kind = 'contribution' then p_amount else -p_amount end) < 0 then
    raise exception 'La meta quedaría con menos de cero.' using errcode = 'LJ010', detail = greatest(v_saved_without, 0)::text;
  end if;

  if v_old.transaction_id is not null then
    select * into v_transaction from public.transactions t where t.id = v_old.transaction_id for update;
    if v_transaction.deleted_at is null then
      perform private.check_movement(v_user, v_transaction.id, 'transfer', p_amount, v_transaction.account_id,
        v_transaction.destination_account_id, v_date, false, false, p_allow_negative, true, false);
      update public.transactions set amount = p_amount, transaction_date = v_date where id = v_transaction.id;
    end if;
  end if;

  update public.savings_goal_movements set
    amount = p_amount,
    movement_date = v_date,
    note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_movement_id;
  return p_movement_id;
end;
$$;

-- Revertir: el movimiento deja de contar (y su transferencia, si la hubo,
-- se anula: el dinero vuelve a la cuenta de origen). El registro se conserva.
create function private.void_goal_movement(p_movement_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_old public.savings_goal_movements%rowtype;
  v_transaction public.transactions%rowtype;
begin
  select * into v_old from public.savings_goal_movements m where m.id = p_movement_id and m.user_id = v_user;
  if not found then
    raise exception 'El movimiento de la meta no existe o no es tuyo.' using errcode = 'LJ006';
  end if;
  perform 1 from public.savings_goals g where g.id = v_old.goal_id for update;
  select * into v_old from public.savings_goal_movements m where m.id = p_movement_id for update;
  if v_old.voided_at is not null then
    return; -- ya estaba revertido: repetir la solicitud no cambia nada
  end if;
  if char_length(coalesce(p_reason, '')) > 200 then
    raise exception 'El motivo puede tener hasta 200 caracteres.' using errcode = 'LJ007';
  end if;
  if v_old.kind = 'contribution' and private.goal_saved(v_old.goal_id, p_movement_id) < 0 then
    raise exception 'Primero revierte los retiros: la meta quedaría con menos de cero.' using errcode = 'LJ010';
  end if;

  update public.savings_goal_movements
     set voided_at = now(), void_reason = nullif(btrim(coalesce(p_reason, '')), '')
   where id = p_movement_id;

  if v_old.transaction_id is not null then
    select * into v_transaction from public.transactions t where t.id = v_old.transaction_id for update;
    if v_transaction.deleted_at is null then
      perform 1 from public.accounts a
       where a.user_id = v_user and a.id in (v_transaction.account_id, v_transaction.destination_account_id)
       order by a.id
       for update;
      update public.transactions
         set deleted_at = now(),
             void_reason = coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Revertido desde la meta')
       where id = v_transaction.id;
    end if;
  end if;
end;
$$;

-- Si la transferencia enlazada se edita o se anula desde Movimientos, el
-- aporte de la meta la sigue (nunca quedan desalineados).
create or replace function private.sync_goal_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.savings_goal_movements m
     set amount = new.amount,
         movement_date = new.transaction_date,
         voided_at = case when new.deleted_at is null then null else coalesce(m.voided_at, new.deleted_at) end,
         void_reason = case when new.deleted_at is null then null else coalesce(m.void_reason, new.void_reason) end
   where m.transaction_id = new.id
     and (m.amount is distinct from new.amount
          or m.movement_date is distinct from new.transaction_date
          or (m.voided_at is null) <> (new.deleted_at is null));
  return null;
end;
$$;

create trigger transactions_sync_goal_movements
  after update of amount, transaction_date, deleted_at on public.transactions
  for each row when (new.purpose in ('goal_contribution', 'goal_withdrawal'))
  execute function private.sync_goal_movement();

-- =====================================================================
-- 7. DEUDAS
-- =====================================================================
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Cuenta de tipo «loan» con el saldo de la deuda (1 a 1). Nombre, color y
  -- estado (archivada) viven en la cuenta.
  account_id uuid not null,
  kind text not null default 'bank_loan'
    check (kind in ('bank_loan', 'personal', 'mortgage', 'vehicle', 'education', 'other')),
  creditor text check (creditor is null or char_length(btrim(creditor)) between 1 and 60),
  -- Valor prestado originalmente (puede ser mayor que el saldo al registrarla).
  original_amount bigint not null check (original_amount > 0 and original_amount <= 999999999999999),
  -- Tasa en porcentaje (1.5 = 1,5 %) y si es mensual o anual. NULL = sin interés.
  interest_rate numeric(7, 4) check (interest_rate is null or (interest_rate >= 0 and interest_rate <= 999)),
  interest_period text check (interest_period is null or interest_period in ('monthly', 'annual')),
  start_date date not null,
  due_date date,
  installment_amount bigint check (installment_amount is null or (installment_amount > 0 and installment_amount <= 999999999999999)),
  frequency text not null default 'none'
    check (frequency in ('none', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  -- Fecha de la próxima cuota al registrarla; las siguientes se calculan.
  first_payment_date date,
  payment_account_id uuid,
  description text check (description is null or char_length(description) <= 280),
  client_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint debts_account_key unique (account_id),
  constraint debts_account_fk foreign key (account_id, user_id)
    references public.accounts (id, user_id) on delete no action,
  constraint debts_payment_account_fk foreign key (payment_account_id, user_id)
    references public.accounts (id, user_id) on delete no action,
  constraint debts_interest_shape check ((interest_rate is null) = (interest_period is null)),
  constraint debts_dates check (due_date is null or due_date >= start_date),
  constraint debts_schedule_shape check (
    (frequency = 'none' and first_payment_date is null)
    or (frequency <> 'none' and installment_amount is not null and first_payment_date is not null)
  )
);
create index debts_user_idx on public.debts (user_id);
create index debts_payment_account_idx on public.debts (payment_account_id, user_id);
create unique index debts_request_key on public.debts (user_id, client_request_id) where client_request_id is not null;
create trigger debts_set_updated_at before update on public.debts
  for each row execute function public.set_updated_at();

-- Seguimiento de cada deuda, calculado de los movimientos de su cuenta.
create view public.debt_overview
with (security_invoker = true)
as
with mov as (
  select d.id as debt_id,
    coalesce(sum(t.amount) filter (where t.type = 'transfer' and t.destination_account_id = d.account_id), 0)::bigint as total_paid,
    count(t.id) filter (where t.type = 'transfer' and t.destination_account_id = d.account_id
                          and t.purpose = 'debt_installment') as installments_paid,
    coalesce(sum(t.amount) filter (where t.type = 'expense' and t.account_id = d.account_id), 0)::bigint as interest_registered,
    coalesce(sum(t.amount) filter (where t.type = 'transfer' and t.account_id = d.account_id), 0)::bigint as disbursed,
    max(t.transaction_date) filter (where t.type = 'transfer' and t.destination_account_id = d.account_id) as last_payment_date
  from public.debts d
  left join public.transactions t
    on t.user_id = d.user_id and t.deleted_at is null
   and (t.account_id = d.account_id or t.destination_account_id = d.account_id)
  group by d.id
),
calc as (
  select d.id as debt_id, d.user_id, d.account_id, a.is_active, d.frequency, d.first_payment_date, d.due_date,
    greatest(-b.balance, 0)::bigint as outstanding,
    greatest(b.balance, 0)::bigint as credit_balance,
    (-a.initial_balance)::bigint as initial_outstanding,
    greatest(d.original_amount + a.initial_balance, 0)::bigint as paid_before,
    m.total_paid, m.installments_paid, m.interest_registered, m.disbursed, m.last_payment_date,
    (now() at time zone 'America/Bogota')::date as today
  from public.debts d
  join public.accounts a on a.id = d.account_id
  join public.account_balances b on b.account_id = d.account_id
  join mov m on m.debt_id = d.id
),
sched as (
  select c.*,
    case when c.frequency = 'none' or c.outstanding = 0 or not c.is_active then null
      else (c.first_payment_date + case c.frequency
        when 'weekly' then make_interval(days => 7 * c.installments_paid::int)
        when 'biweekly' then make_interval(days => 14 * c.installments_paid::int)
        when 'monthly' then make_interval(months => c.installments_paid::int)
        when 'quarterly' then make_interval(months => 3 * c.installments_paid::int)
        when 'yearly' then make_interval(years => c.installments_paid::int)
      end)::date
    end as next_payment_date
  from calc c
)
select
  s.debt_id,
  s.user_id,
  s.account_id,
  s.outstanding,
  s.credit_balance,
  s.initial_outstanding,
  s.paid_before,
  s.total_paid,
  s.installments_paid,
  s.interest_registered,
  s.disbursed,
  s.last_payment_date,
  case when s.paid_before + s.total_paid + s.outstanding = 0 then 100::numeric
       else round((s.paid_before + s.total_paid) * 100.0 / (s.paid_before + s.total_paid + s.outstanding), 2)
  end as percent_paid,
  s.next_payment_date,
  (s.next_payment_date - s.today) as days_to_next_payment,
  (s.due_date - s.today) as days_to_due,
  case
    when not s.is_active then 'archived'
    when s.outstanding = 0 then 'paid'
    when s.next_payment_date < s.today or (s.due_date is not null and s.due_date < s.today) then 'overdue'
    else 'active'
  end as status
from sched s;
comment on view public.debt_overview is
  'Saldo pendiente, total pagado, intereses registrados, % pagado, próximo pago y estado de cada deuda. % pagado = pagado / (pagado + pendiente).';

create or replace function private.check_debt(
  p_user uuid,
  p_name text,
  p_original bigint,
  p_outstanding bigint,
  p_kind text,
  p_creditor text,
  p_rate numeric,
  p_rate_period text,
  p_start date,
  p_due date,
  p_installment bigint,
  p_frequency text,
  p_first_payment date,
  p_payment_account uuid,
  p_description text,
  p_require_active_payment_account boolean
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_account public.accounts%rowtype;
begin
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 60 then
    raise exception 'Escribe un nombre para la deuda (máximo 60 caracteres).' using errcode = 'LJ007';
  end if;
  if p_original is null or p_original <= 0 or p_original > 999999999999999 then
    raise exception 'Escribe el valor inicial de la deuda.' using errcode = 'LJ007';
  end if;
  if p_outstanding is null or p_outstanding <= 0 or p_outstanding > 999999999999999 then
    raise exception 'Escribe el saldo pendiente (mayor que cero).' using errcode = 'LJ007';
  end if;
  if p_kind is null or p_kind not in ('bank_loan', 'personal', 'mortgage', 'vehicle', 'education', 'other') then
    raise exception 'Elige el tipo de deuda.' using errcode = 'LJ007';
  end if;
  if char_length(btrim(coalesce(p_creditor, ''))) > 60 then
    raise exception 'El acreedor puede tener hasta 60 caracteres.' using errcode = 'LJ007';
  end if;
  if (p_rate is null) <> (p_rate_period is null) then
    raise exception 'Escribe la tasa de interés y si es mensual o anual.' using errcode = 'LJ007';
  end if;
  if p_rate is not null and (p_rate < 0 or p_rate > 999 or p_rate_period not in ('monthly', 'annual')) then
    raise exception 'La tasa de interés no es válida.' using errcode = 'LJ007';
  end if;
  if p_start is null or p_start < date '1980-01-01' then
    raise exception 'La fecha de inicio no es válida.' using errcode = 'LJ007';
  end if;
  if p_due is not null and p_due < p_start then
    raise exception 'La fecha límite debe ser posterior al inicio.' using errcode = 'LJ007';
  end if;
  if p_frequency is null or p_frequency not in ('none', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly') then
    raise exception 'Elige cada cuánto pagas.' using errcode = 'LJ007';
  end if;
  if p_frequency <> 'none' and (p_installment is null or p_first_payment is null) then
    raise exception 'Escribe el valor de la cuota y la fecha del próximo pago.' using errcode = 'LJ007';
  end if;
  if p_installment is not null and (p_installment <= 0 or p_installment > 999999999999999) then
    raise exception 'La cuota debe ser mayor que cero.' using errcode = 'LJ007';
  end if;
  if char_length(coalesce(p_description, '')) > 280 then
    raise exception 'La descripción puede tener hasta 280 caracteres.' using errcode = 'LJ007';
  end if;
  if p_payment_account is not null then
    select * into v_account from public.accounts a where a.id = p_payment_account and a.user_id = p_user;
    if not found then
      raise exception 'La cuenta de pago no existe o no es tuya.' using errcode = 'LJ006';
    end if;
    if v_account.account_type = 'loan' then
      raise exception 'La cuenta de pago no puede ser otra deuda.' using errcode = 'LJ007';
    end if;
    if p_require_active_payment_account and not v_account.is_active then
      raise exception 'La cuenta «%» está archivada.', v_account.name using errcode = 'LJ006';
    end if;
  end if;
end;
$$;

create function private.create_debt(
  p_name text,
  p_original_amount bigint,
  p_outstanding bigint,
  p_kind text default 'bank_loan',
  p_creditor text default null,
  p_interest_rate numeric default null,
  p_interest_period text default null,
  p_start_date date default null,
  p_due_date date default null,
  p_installment_amount bigint default null,
  p_frequency text default 'none',
  p_first_payment_date date default null,
  p_payment_account_id uuid default null,
  p_description text default null,
  p_color text default null,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_account uuid;
  v_start date := coalesce(p_start_date, (now() at time zone 'America/Bogota')::date);
  v_frequency text := coalesce(p_frequency, 'none');
begin
  if v_user is null then
    raise exception 'Inicia sesión.' using errcode = '42501';
  end if;
  if p_request_id is not null then
    select d.id into v_id from public.debts d where d.user_id = v_user and d.client_request_id = p_request_id;
    if found then
      return v_id;
    end if;
  end if;
  perform private.check_debt(v_user, p_name, p_original_amount, p_outstanding, coalesce(p_kind, 'bank_loan'), p_creditor,
    p_interest_rate, p_interest_period, v_start, p_due_date, p_installment_amount, v_frequency, p_first_payment_date,
    p_payment_account_id, p_description, true);

  insert into public.accounts (
    user_id, name, institution, institution_name, account_type, initial_balance, color, icon, connection_type, client_request_id
  )
  values (
    v_user, btrim(p_name), 'custom', coalesce(nullif(btrim(coalesce(p_creditor, '')), ''), 'Deuda'), 'loan',
    -p_outstanding, p_color, 'banknote', 'manual', p_request_id
  )
  on conflict (user_id, client_request_id) where client_request_id is not null do nothing
  returning id into v_account;

  if v_account is null then
    -- Otra solicitud idéntica la creó en paralelo.
    select d.id into v_id from public.debts d where d.user_id = v_user and d.client_request_id = p_request_id;
    return v_id;
  end if;

  insert into public.debts (
    user_id, account_id, kind, creditor, original_amount, interest_rate, interest_period, start_date, due_date,
    installment_amount, frequency, first_payment_date, payment_account_id, description, client_request_id
  )
  values (
    v_user, v_account, coalesce(p_kind, 'bank_loan'), nullif(btrim(coalesce(p_creditor, '')), ''), p_original_amount,
    p_interest_rate, p_interest_period, v_start, p_due_date, p_installment_amount, v_frequency,
    case when v_frequency <> 'none' then p_first_payment_date end, p_payment_account_id,
    nullif(btrim(coalesce(p_description, '')), ''), p_request_id
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- El saldo inicial solo se cambia si la deuda aún no tiene movimientos; después
-- se corrige con «Ajustar saldo» (queda registrado el ajuste y su motivo).
create function private.update_debt(
  p_debt_id uuid,
  p_name text,
  p_original_amount bigint,
  p_initial_outstanding bigint,
  p_kind text,
  p_creditor text,
  p_interest_rate numeric,
  p_interest_period text,
  p_start_date date,
  p_due_date date,
  p_installment_amount bigint,
  p_frequency text,
  p_first_payment_date date,
  p_payment_account_id uuid,
  p_description text,
  p_color text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_old public.debts%rowtype;
  v_frequency text := coalesce(p_frequency, 'none');
begin
  select * into v_old from public.debts d where d.id = p_debt_id and d.user_id = v_user for update;
  if not found then
    raise exception 'La deuda no existe o no es tuya.' using errcode = 'LJ006';
  end if;
  perform 1 from public.accounts a where a.id = v_old.account_id for update;
  perform private.check_debt(v_user, p_name, p_original_amount, p_initial_outstanding, coalesce(p_kind, v_old.kind), p_creditor,
    p_interest_rate, p_interest_period, coalesce(p_start_date, v_old.start_date), p_due_date, p_installment_amount, v_frequency,
    p_first_payment_date, p_payment_account_id, p_description, p_payment_account_id is distinct from v_old.payment_account_id);

  update public.accounts set
    name = btrim(p_name),
    institution_name = coalesce(nullif(btrim(coalesce(p_creditor, '')), ''), 'Deuda'),
    color = p_color,
    initial_balance = -p_initial_outstanding
  where id = v_old.account_id;

  update public.debts set
    kind = coalesce(p_kind, v_old.kind),
    creditor = nullif(btrim(coalesce(p_creditor, '')), ''),
    original_amount = p_original_amount,
    interest_rate = p_interest_rate,
    interest_period = p_interest_period,
    start_date = coalesce(p_start_date, v_old.start_date),
    due_date = p_due_date,
    installment_amount = p_installment_amount,
    frequency = v_frequency,
    first_payment_date = case when v_frequency <> 'none' then p_first_payment_date end,
    payment_account_id = p_payment_account_id,
    description = nullif(btrim(coalesce(p_description, '')), '')
  where id = p_debt_id;
  return p_debt_id;
end;
$$;

create function private.archive_debt(p_debt_id uuid, p_archived boolean default true, p_force boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_balance bigint;
begin
  select * into v_debt from public.debts d where d.id = p_debt_id and d.user_id = v_user for update;
  if not found then
    raise exception 'La deuda no existe o no es tuya.' using errcode = 'LJ006';
  end if;
  perform 1 from public.accounts a where a.id = v_debt.account_id for update;
  if p_archived then
    v_balance := private.account_balance(v_debt.account_id);
    if v_balance <> 0 and not p_force then
      raise exception 'La deuda todavía tiene saldo: al archivarla deja de contar en tus totales.'
        using errcode = 'LJ004', detail = v_balance::text;
    end if;
  end if;
  update public.accounts set is_active = not p_archived where id = v_debt.account_id;
end;
$$;

create function private.delete_debt(p_debt_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_debt public.debts%rowtype;
begin
  select * into v_debt from public.debts d where d.id = p_debt_id and d.user_id = v_user for update;
  if not found then
    raise exception 'La deuda no existe o no es tuya.' using errcode = 'LJ006';
  end if;
  perform 1 from public.accounts a where a.id = v_debt.account_id for update;
  if exists (
    select 1 from public.transactions t
     where t.user_id = v_user and (t.account_id = v_debt.account_id or t.destination_account_id = v_debt.account_id)
  ) then
    raise exception 'La deuda tiene pagos o movimientos registrados: archívala para conservar el historial.'
      using errcode = 'LJ013';
  end if;
  delete from public.debts where id = p_debt_id;
  delete from public.accounts where id = v_debt.account_id and user_id = v_user;
end;
$$;

-- Pago de una deuda: cuota, abono extra o interés.
--   cuota / abono  transferencia de la cuenta de pago a la deuda (no es gasto).
--                  Si la cuota incluye intereses (p_interest_portion), esa parte
--                  se registra antes como gasto «Intereses y comisiones» sobre la
--                  deuda: así baja solo el capital.
--   interés        gasto sobre la deuda: aumenta lo que se debe.
-- Se editan o revierten como cualquier movimiento (update_transaction /
-- void_transaction): el seguimiento se recalcula solo.
create function private.register_debt_payment(
  p_debt_id uuid,
  p_kind text,
  p_amount bigint,
  p_account_id uuid default null,
  p_interest_portion bigint default 0,
  p_payment_date date default null,
  p_notes text default null,
  p_request_id uuid default null,
  p_allow_negative boolean default false,
  p_allow_overpay boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_account public.accounts%rowtype;
  v_date date := coalesce(p_payment_date, (now() at time zone 'America/Bogota')::date);
  v_portion bigint := coalesce(p_interest_portion, 0);
  v_source uuid;
  v_fees uuid;
  v_transaction uuid;
  v_interest uuid;
  v_interest_request uuid := case when p_request_id is not null then md5(p_request_id::text || ':interest')::uuid end;
begin
  if v_user is null then
    raise exception 'Inicia sesión.' using errcode = '42501';
  end if;
  select * into v_debt from public.debts d where d.id = p_debt_id and d.user_id = v_user for update;
  if not found then
    raise exception 'La deuda no existe o no es tuya.' using errcode = 'LJ006';
  end if;
  if p_request_id is not null then
    select t.id into v_transaction from public.transactions t where t.user_id = v_user and t.client_request_id = p_request_id;
    if found then
      select t.id into v_interest from public.transactions t where t.user_id = v_user and t.client_request_id = v_interest_request;
      return jsonb_build_object('transaction_id', v_transaction, 'interest_transaction_id', v_interest);
    end if;
  end if;

  select * into v_account from public.accounts a where a.id = v_debt.account_id;
  if not v_account.is_active then
    raise exception 'La deuda está archivada.' using errcode = 'LJ006';
  end if;
  if p_kind is null or p_kind not in ('installment', 'extra', 'interest') then
    raise exception 'Elige si es una cuota, un abono o un interés.' using errcode = 'LJ007';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 999999999999999 then
    raise exception 'Escribe un valor mayor que cero.' using errcode = 'LJ007';
  end if;
  if char_length(coalesce(p_notes, '')) > 500 then
    raise exception 'La nota puede tener hasta 500 caracteres.' using errcode = 'LJ007';
  end if;
  select c.id into v_fees from public.categories c where c.slug = 'fees' and c.user_id is null;

  if p_kind = 'interest' then
    perform private.check_movement(v_user, null, 'expense', p_amount, v_debt.account_id, null, v_date,
      true, false, true, true, true);
    insert into public.transactions (
      user_id, account_id, category_id, type, amount, description, notes, transaction_date, source, purpose, client_request_id
    )
    values (
      v_user, v_debt.account_id, v_fees, 'expense', p_amount, 'Intereses · ' || v_account.name,
      nullif(btrim(coalesce(p_notes, '')), ''), v_date, 'manual', 'debt_interest', p_request_id
    )
    returning id into v_transaction;
    return jsonb_build_object('transaction_id', v_transaction, 'interest_transaction_id', null);
  end if;

  if v_portion < 0 or v_portion > p_amount then
    raise exception 'Los intereses incluidos no pueden superar el pago.' using errcode = 'LJ007';
  end if;
  v_source := coalesce(p_account_id, v_debt.payment_account_id);
  if v_source is null then
    raise exception 'Elige la cuenta con la que pagas.' using errcode = 'LJ007';
  end if;

  if v_portion > 0 then
    perform private.check_movement(v_user, null, 'expense', v_portion, v_debt.account_id, null, v_date,
      true, false, true, true, true);
    insert into public.transactions (
      user_id, account_id, category_id, type, amount, description, transaction_date, source, purpose, client_request_id
    )
    values (
      v_user, v_debt.account_id, v_fees, 'expense', v_portion, 'Intereses · ' || v_account.name, v_date, 'manual',
      'debt_interest', v_interest_request
    )
    returning id into v_interest;
  end if;

  perform private.check_movement(v_user, null, 'transfer', p_amount, v_source, v_debt.account_id, v_date,
    true, true, p_allow_negative, true, p_allow_overpay);
  insert into public.transactions (
    user_id, account_id, destination_account_id, type, amount, description, notes, transaction_date, source, purpose,
    client_request_id
  )
  values (
    v_user, v_source, v_debt.account_id, 'transfer', p_amount,
    case when p_kind = 'installment' then 'Cuota · ' else 'Abono · ' end || v_account.name,
    nullif(btrim(coalesce(p_notes, '')), ''), v_date, 'manual',
    case when p_kind = 'installment' then 'debt_installment' else 'debt_extra' end, p_request_id
  )
  returning id into v_transaction;
  return jsonb_build_object('transaction_id', v_transaction, 'interest_transaction_id', v_interest);
end;
$$;

-- =====================================================================
-- 8. RESUMEN Y PLANIFICACIÓN (lecturas, respetan RLS)
-- =====================================================================
-- Activos = suma de saldos positivos; pasivos = suma de saldos negativos
-- (tarjetas, préstamos, sobregiros). Patrimonio = activos − pasivos.
-- Una transferencia entre cuentas propias (incluido pagar una deuda) no lo
-- cambia. El cupo de crédito y las metas no suman al patrimonio.
create or replace function public.financial_summary(p_month date default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with balances as (
    select a.account_type::text as kind, a.credit_limit, b.balance
      from public.accounts a
      join public.account_balances b on b.account_id = a.id
     where a.is_active
  ),
  period as (
    select date_trunc('month', coalesce(p_month, (now() at time zone 'America/Bogota')::date))::date as start
  ),
  flows as (
    select
      coalesce(sum(t.amount) filter (where t.type = 'income'), 0) as income,
      coalesce(sum(t.amount) filter (where t.type = 'expense'), 0) as expense
    from public.transactions t, period m
    where t.deleted_at is null
      and t.transaction_date >= m.start
      and t.transaction_date < (m.start + interval '1 month')::date
  ),
  totals as (
    select
      coalesce(sum(balance) filter (where kind in ('bank', 'savings', 'checking')), 0) as banks,
      coalesce(sum(balance) filter (where kind = 'digital_wallet'), 0) as wallets,
      coalesce(sum(balance) filter (where kind = 'cash'), 0) as cash,
      coalesce(sum(balance) filter (where kind in ('investment', 'cdt', 'investment_fund')), 0) as invested,
      coalesce(sum(balance) filter (where kind = 'other'), 0) as other,
      coalesce(sum(-balance) filter (where kind = 'credit_card' and balance < 0), 0) as card_debt,
      coalesce(sum(-balance) filter (where kind = 'loan' and balance < 0), 0) as loan_debt,
      coalesce(sum(credit_limit) filter (where kind = 'credit_card'), 0) as credit_limit,
      coalesce(sum(greatest(credit_limit + balance, 0)) filter (where kind = 'credit_card' and credit_limit is not null), 0)
        as credit_available,
      coalesce(sum(greatest(balance, 0)), 0) as assets,
      coalesce(sum(greatest(-balance, 0)), 0) as liabilities,
      coalesce(sum(balance), 0) as net_worth,
      count(*) filter (where kind <> 'loan') as accounts,
      count(*) filter (where kind = 'loan') as debts
    from balances
  )
  select jsonb_build_object(
    'available', t.banks + t.wallets + t.cash,
    'banks', t.banks,
    'wallets', t.wallets,
    'cash', t.cash,
    'invested', t.invested,
    'other', t.other,
    'card_debt', t.card_debt,
    'loan_debt', t.loan_debt,
    'total_debt', t.card_debt + t.loan_debt,
    'credit_limit', t.credit_limit,
    'credit_available', t.credit_available,
    'assets', t.assets,
    'liabilities', t.liabilities,
    'net_worth', t.net_worth,
    'accounts', t.accounts,
    'debts', t.debts,
    'month_start', m.start,
    'month_income', f.income,
    'month_expense', f.expense,
    'month_savings', f.income - f.expense,
    'savings_rate', case when f.income > 0 then round((f.income - f.expense) * 100.0 / f.income, 2) end
  )
  from totals t, period m, flows f
$$;

-- Ingresos y gastos por mes (gráficos y promedios). Máximo 24 meses.
create or replace function public.monthly_flows(p_months integer default 6)
returns table (month_start date, income bigint, expense bigint, fixed_expense bigint, essential_expense bigint, movements bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with cur as (select date_trunc('month', (now() at time zone 'America/Bogota'))::date as m),
  months as (
    select (cur.m - make_interval(months => g))::date as m
      from cur, generate_series(0, least(greatest(coalesce(p_months, 6), 1), 24) - 1) g
  )
  select months.m,
    coalesce(sum(t.amount) filter (where t.type = 'income'), 0)::bigint,
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)::bigint,
    coalesce(sum(t.amount) filter (where t.type = 'expense' and c.is_fixed), 0)::bigint,
    coalesce(sum(t.amount) filter (where t.type = 'expense' and c.is_essential), 0)::bigint,
    count(t.id) filter (where t.type in ('income', 'expense'))
  from months
  left join public.transactions t
    on t.deleted_at is null
   and t.transaction_date >= months.m
   and t.transaction_date < (months.m + interval '1 month')::date
  left join public.categories c on c.id = t.category_id
  group by months.m
  order by months.m
$$;

-- Gasto por categoría en un rango (máximo 400 días).
create or replace function public.spending_by_category(p_from date, p_to date)
returns table (category_id uuid, total bigint, movements bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.category_id, sum(t.amount)::bigint, count(*)
    from public.transactions t
   where t.deleted_at is null and t.type = 'expense'
     and t.transaction_date between p_from and least(p_to, p_from + 400)
   group by t.category_id
   order by 2 desc
$$;

-- Datos para planificar. Promedios de hasta 3 meses completos (sin el mes en
-- curso; el primer mes cuenta solo si empezaste a registrar antes del día 6).
-- Sin meses completos se usa lo que va del mes y se marca como preliminar.
-- Obligaciones = cuotas de deudas activas llevadas a su valor mensual.
-- Capacidad de ahorro = ingreso promedio − gasto esencial promedio − obligaciones.
create or replace function public.planning_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with ref as (
    select (now() at time zone 'America/Bogota')::date as today,
           date_trunc('month', (now() at time zone 'America/Bogota'))::date as cur_month
  ),
  first_tx as (
    select min(t.transaction_date) as d
      from public.transactions t
     where t.deleted_at is null and t.type in ('income', 'expense')
  ),
  window_start as (
    select case
        when f.d is null then null
        when extract(day from f.d) <= 5 then date_trunc('month', f.d::timestamp)::date
        else (date_trunc('month', f.d::timestamp) + interval '1 month')::date
      end as first_full_month
      from first_tx f
  ),
  months as (
    select m::date as m
      from ref, window_start w,
           generate_series(ref.cur_month - interval '3 months', ref.cur_month - interval '1 month', interval '1 month') m
     where w.first_full_month is not null and m::date >= w.first_full_month
  ),
  monthly as (
    select months.m,
      coalesce(sum(t.amount) filter (where t.type = 'income'), 0) as income,
      coalesce(sum(t.amount) filter (where t.type = 'expense'), 0) as expense,
      coalesce(sum(t.amount) filter (where t.type = 'expense' and c.is_essential), 0) as essential,
      coalesce(sum(t.amount) filter (where t.type = 'expense' and c.is_fixed), 0) as fixed
    from months
    left join public.transactions t
      on t.deleted_at is null
     and t.transaction_date >= months.m
     and t.transaction_date < (months.m + interval '1 month')::date
    left join public.categories c on c.id = t.category_id
    group by months.m
  ),
  current_month as (
    select
      coalesce(sum(t.amount) filter (where t.type = 'income'), 0) as income,
      coalesce(sum(t.amount) filter (where t.type = 'expense'), 0) as expense,
      coalesce(sum(t.amount) filter (where t.type = 'expense' and c.is_essential), 0) as essential,
      coalesce(sum(t.amount) filter (where t.type = 'expense' and c.is_fixed), 0) as fixed
    from ref
    left join public.transactions t
      on t.deleted_at is null and t.transaction_date >= ref.cur_month and t.transaction_date <= ref.today
    left join public.categories c on c.id = t.category_id
  ),
  basis as (
    select
      case
        when (select count(*) from monthly) > 0 then 'complete_months'
        when (select d from first_tx) is not null then 'current_month'
        else 'none'
      end as kind,
      (select count(*) from monthly) as months
  ),
  averages as (
    select
      case b.kind when 'complete_months' then (select avg(income) from monthly) when 'current_month' then cm.income end as income,
      case b.kind when 'complete_months' then (select avg(expense) from monthly) when 'current_month' then cm.expense end as expense,
      case b.kind when 'complete_months' then (select avg(essential) from monthly) when 'current_month' then cm.essential end
        as essential,
      case b.kind when 'complete_months' then (select avg(fixed) from monthly) when 'current_month' then cm.fixed end as fixed
    from basis b, current_month cm
  ),
  obligations as (
    select coalesce(sum(case d.frequency
        when 'weekly' then d.installment_amount * 52 / 12.0
        when 'biweekly' then d.installment_amount * 26 / 12.0
        when 'monthly' then d.installment_amount::numeric
        when 'quarterly' then d.installment_amount / 3.0
        when 'yearly' then d.installment_amount / 12.0
        else 0
      end), 0) as monthly,
      count(*) as debts
    from public.debts d
    join public.debt_overview o on o.debt_id = d.id
    where o.status in ('active', 'overdue') and d.frequency <> 'none'
  ),
  goals as (
    select coalesce(sum(p.monthly_needed), 0) as monthly_needed, count(*) as active
      from public.savings_goal_progress p
     where p.status = 'active'
  )
  select jsonb_build_object(
    'basis', b.kind,
    'months_used', b.months,
    'preliminary', b.months < 3,
    'income_avg', round(a.income)::bigint,
    'expense_avg', round(a.expense)::bigint,
    'essential_avg', round(a.essential)::bigint,
    'fixed_avg', round(a.fixed)::bigint,
    'variable_avg', round(a.expense - a.fixed)::bigint,
    'savings_avg', round(a.income - a.expense)::bigint,
    'savings_rate', case when a.income > 0 then round((a.income - a.expense) * 100.0 / a.income, 2) end,
    'obligations_monthly', round(o.monthly)::bigint,
    'obligation_debts', o.debts,
    'savings_capacity', round(a.income - a.essential - o.monthly)::bigint,
    'goals_monthly_needed', g.monthly_needed,
    'active_goals', g.active
  )
  from basis b, averages a, obligations o, goals g
$$;

-- =====================================================================
-- 9. AUDITORÍA de las tablas nuevas (sin montos ni textos)
-- =====================================================================
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_entity text := case tg_table_name
    when 'accounts' then 'account'
    when 'transactions' then 'transaction'
    when 'categories' then 'category'
    when 'profiles' then 'profile'
    when 'user_preferences' then 'preferences'
    when 'budgets' then 'budget'
    when 'savings_goals' then 'goal'
    when 'savings_goal_movements' then 'goal_movement'
    when 'debts' then 'debt'
  end;
  v_user uuid := case when tg_table_name = 'profiles' then (v_row ->> 'id')::uuid else (v_row ->> 'user_id')::uuid end;
  v_fields text[] := '{}';
  v_action text;
begin
  if v_user is null then
    return null;
  end if;
  if tg_op = 'DELETE' and not exists (select 1 from auth.users where id = v_user) then
    return null;
  end if;

  if tg_op = 'INSERT' then
    v_action := v_entity || '.created';
  elsif tg_op = 'DELETE' then
    v_action := v_entity || '.deleted';
  else
    -- En cuentas, archived_at acompaña a is_active (basta con uno).
    select coalesce(array_agg(n.key order by n.key), '{}')
      into v_fields
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
     where n.value is distinct from o.value
       and n.key <> 'updated_at'
       and not (v_entity = 'account' and n.key = 'archived_at');
    if cardinality(v_fields) = 0 then
      return null;
    end if;
    v_action := case
      when v_entity = 'account' and 'is_active' = any (v_fields) then
        case when (v_row ->> 'is_active')::boolean then 'account.restored' else 'account.archived' end
      when v_entity = 'transaction' and 'deleted_at' = any (v_fields) then
        case when (v_row ->> 'deleted_at') is null then 'transaction.restored' else 'transaction.deleted' end
      when v_entity = 'goal_movement' and 'voided_at' = any (v_fields) then
        case when (v_row ->> 'voided_at') is null then 'goal_movement.restored' else 'goal_movement.voided' end
      when 'archived_at' = any (v_fields) then
        case when (v_row ->> 'archived_at') is null then v_entity || '.restored' else v_entity || '.archived' end
      when v_entity = 'profile' and 'onboarding_completed_at' = any (v_fields)
           and (v_row ->> 'onboarding_completed_at') is not null then 'profile.onboarding_completed'
      else v_entity || '.updated'
    end;
  end if;

  insert into public.audit_logs (user_id, action, entity_id, changed_fields)
  values (v_user, v_action, (v_row ->> 'id')::uuid, v_fields);
  return null;
end;
$$;
revoke all on function public.audit_row_change() from public, anon, authenticated;

create trigger audit_budgets after insert or update or delete on public.budgets
  for each row execute function public.audit_row_change();
create trigger audit_savings_goals after insert or update or delete on public.savings_goals
  for each row execute function public.audit_row_change();
create trigger audit_savings_goal_movements after insert or update on public.savings_goal_movements
  for each row execute function public.audit_row_change();
create trigger audit_debts after insert or update or delete on public.debts
  for each row execute function public.audit_row_change();

-- =====================================================================
-- 10. RLS y permisos: lectura de lo propio; escrituras solo por RPC
-- =====================================================================
alter table public.budgets enable row level security;
alter table public.budget_alerts enable row level security;
alter table public.savings_goals enable row level security;
alter table public.savings_goal_movements enable row level security;
alter table public.debts enable row level security;

revoke all on public.budgets, public.budget_alerts, public.savings_goals, public.savings_goal_movements, public.debts,
  public.budget_status, public.savings_goal_progress, public.debt_overview
from anon, authenticated;
grant select on public.budgets, public.budget_alerts, public.savings_goals, public.savings_goal_movements, public.debts,
  public.budget_status, public.savings_goal_progress, public.debt_overview
to authenticated;
-- Lo único que la app modifica directamente: marcar un aviso como visto.
grant update (seen_at) on public.budget_alerts to authenticated;

create policy "budgets: ver los propios" on public.budgets
  for select to authenticated using (user_id = (select auth.uid()));
create policy "budget_alerts: ver los propios" on public.budget_alerts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "budget_alerts: marcar vistos los propios" on public.budget_alerts
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "goals: ver las propias" on public.savings_goals
  for select to authenticated using (user_id = (select auth.uid()));
create policy "goal_movements: ver los propios" on public.savings_goal_movements
  for select to authenticated using (user_id = (select auth.uid()));
create policy "debts: ver las propias" on public.debts
  for select to authenticated using (user_id = (select auth.uid()));

-- =====================================================================
-- 11. Envoltorios públicos (SECURITY INVOKER) de las funciones con privilegios
-- =====================================================================
create function public.create_budget(
  p_category_id uuid,
  p_limit_amount bigint,
  p_period text,
  p_start_date date default null,
  p_end_date date default null,
  p_name text default null,
  p_alert_thresholds integer[] default null,
  p_request_id uuid default null
)
returns uuid language plpgsql security invoker set search_path = '' as $$
begin
  return private.create_budget(p_category_id, p_limit_amount, p_period, p_start_date, p_end_date, p_name,
    p_alert_thresholds, p_request_id);
end;
$$;

create function public.update_budget(
  p_budget_id uuid,
  p_category_id uuid,
  p_limit_amount bigint,
  p_period text,
  p_start_date date,
  p_end_date date,
  p_name text,
  p_alert_thresholds integer[]
)
returns uuid language plpgsql security invoker set search_path = '' as $$
begin
  return private.update_budget(p_budget_id, p_category_id, p_limit_amount, p_period, p_start_date, p_end_date, p_name,
    p_alert_thresholds);
end;
$$;

create function public.archive_budget(p_budget_id uuid, p_archived boolean default true)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform private.archive_budget(p_budget_id, p_archived);
end;
$$;

create function public.delete_budget(p_budget_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform private.delete_budget(p_budget_id);
end;
$$;

create function public.create_savings_goal(
  p_name text,
  p_target_amount bigint,
  p_initial_saved bigint default 0,
  p_target_date date default null,
  p_start_date date default null,
  p_kind text default 'other',
  p_account_id uuid default null,
  p_description text default null,
  p_color text default null,
  p_icon text default null,
  p_request_id uuid default null
)
returns uuid language plpgsql security invoker set search_path = '' as $$
begin
  return private.create_savings_goal(p_name, p_target_amount, p_initial_saved, p_target_date, p_start_date, p_kind,
    p_account_id, p_description, p_color, p_icon, p_request_id);
end;
$$;

create function public.update_savings_goal(
  p_goal_id uuid,
  p_name text,
  p_target_amount bigint,
  p_initial_saved bigint,
  p_target_date date,
  p_start_date date,
  p_kind text,
  p_account_id uuid,
  p_description text,
  p_color text,
  p_icon text
)
returns uuid language plpgsql security invoker set search_path = '' as $$
begin
  return private.update_savings_goal(p_goal_id, p_name, p_target_amount, p_initial_saved, p_target_date, p_start_date,
    p_kind, p_account_id, p_description, p_color, p_icon);
end;
$$;

create function public.archive_savings_goal(p_goal_id uuid, p_archived boolean default true)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform private.archive_savings_goal(p_goal_id, p_archived);
end;
$$;

create function public.delete_savings_goal(p_goal_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform private.delete_savings_goal(p_goal_id);
end;
$$;

create function public.add_goal_movement(
  p_goal_id uuid,
  p_kind text,
  p_amount bigint,
  p_movement_date date default null,
  p_note text default null,
  p_account_id uuid default null,
  p_request_id uuid default null,
  p_allow_negative boolean default false
)
returns uuid language plpgsql security invoker set search_path = '' as $$
begin
  return private.add_goal_movement(p_goal_id, p_kind, p_amount, p_movement_date, p_note, p_account_id, p_request_id,
    p_allow_negative);
end;
$$;

create function public.update_goal_movement(
  p_movement_id uuid,
  p_amount bigint,
  p_movement_date date default null,
  p_note text default null,
  p_allow_negative boolean default false
)
returns uuid language plpgsql security invoker set search_path = '' as $$
begin
  return private.update_goal_movement(p_movement_id, p_amount, p_movement_date, p_note, p_allow_negative);
end;
$$;

create function public.void_goal_movement(p_movement_id uuid, p_reason text default null)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform private.void_goal_movement(p_movement_id, p_reason);
end;
$$;

create function public.create_debt(
  p_name text,
  p_original_amount bigint,
  p_outstanding bigint,
  p_kind text default 'bank_loan',
  p_creditor text default null,
  p_interest_rate numeric default null,
  p_interest_period text default null,
  p_start_date date default null,
  p_due_date date default null,
  p_installment_amount bigint default null,
  p_frequency text default 'none',
  p_first_payment_date date default null,
  p_payment_account_id uuid default null,
  p_description text default null,
  p_color text default null,
  p_request_id uuid default null
)
returns uuid language plpgsql security invoker set search_path = '' as $$
begin
  return private.create_debt(p_name, p_original_amount, p_outstanding, p_kind, p_creditor, p_interest_rate, p_interest_period,
    p_start_date, p_due_date, p_installment_amount, p_frequency, p_first_payment_date, p_payment_account_id, p_description,
    p_color, p_request_id);
end;
$$;

create function public.update_debt(
  p_debt_id uuid,
  p_name text,
  p_original_amount bigint,
  p_initial_outstanding bigint,
  p_kind text,
  p_creditor text,
  p_interest_rate numeric,
  p_interest_period text,
  p_start_date date,
  p_due_date date,
  p_installment_amount bigint,
  p_frequency text,
  p_first_payment_date date,
  p_payment_account_id uuid,
  p_description text,
  p_color text
)
returns uuid language plpgsql security invoker set search_path = '' as $$
begin
  return private.update_debt(p_debt_id, p_name, p_original_amount, p_initial_outstanding, p_kind, p_creditor, p_interest_rate,
    p_interest_period, p_start_date, p_due_date, p_installment_amount, p_frequency, p_first_payment_date, p_payment_account_id,
    p_description, p_color);
end;
$$;

create function public.archive_debt(p_debt_id uuid, p_archived boolean default true, p_force boolean default false)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform private.archive_debt(p_debt_id, p_archived, p_force);
end;
$$;

create function public.delete_debt(p_debt_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform private.delete_debt(p_debt_id);
end;
$$;

create function public.register_debt_payment(
  p_debt_id uuid,
  p_kind text,
  p_amount bigint,
  p_account_id uuid default null,
  p_interest_portion bigint default 0,
  p_payment_date date default null,
  p_notes text default null,
  p_request_id uuid default null,
  p_allow_negative boolean default false,
  p_allow_overpay boolean default false
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  return private.register_debt_payment(p_debt_id, p_kind, p_amount, p_account_id, p_interest_portion, p_payment_date, p_notes,
    p_request_id, p_allow_negative, p_allow_overpay);
end;
$$;

-- ---------- Permisos de funciones ----------
-- Implementaciones con privilegios: solo usuarios con sesión (a través de
-- los envoltorios; la API no publica el esquema private).
revoke all on function
  private.create_budget(uuid, bigint, text, date, date, text, integer[], uuid),
  private.update_budget(uuid, uuid, bigint, text, date, date, text, integer[]),
  private.archive_budget(uuid, boolean),
  private.delete_budget(uuid),
  private.create_savings_goal(text, bigint, bigint, date, date, text, uuid, text, text, text, uuid),
  private.update_savings_goal(uuid, text, bigint, bigint, date, date, text, uuid, text, text, text),
  private.archive_savings_goal(uuid, boolean),
  private.delete_savings_goal(uuid),
  private.add_goal_movement(uuid, text, bigint, date, text, uuid, uuid, boolean),
  private.update_goal_movement(uuid, bigint, date, text, boolean),
  private.void_goal_movement(uuid, text),
  private.create_debt(text, bigint, bigint, text, text, numeric, text, date, date, bigint, text, date, uuid, text, text, uuid),
  private.update_debt(uuid, text, bigint, bigint, text, text, numeric, text, date, date, bigint, text, date, uuid, text, text),
  private.archive_debt(uuid, boolean, boolean),
  private.delete_debt(uuid),
  private.register_debt_payment(uuid, text, bigint, uuid, bigint, date, text, uuid, boolean, boolean)
from public, anon;
grant execute on function
  private.create_budget(uuid, bigint, text, date, date, text, integer[], uuid),
  private.update_budget(uuid, uuid, bigint, text, date, date, text, integer[]),
  private.archive_budget(uuid, boolean),
  private.delete_budget(uuid),
  private.create_savings_goal(text, bigint, bigint, date, date, text, uuid, text, text, text, uuid),
  private.update_savings_goal(uuid, text, bigint, bigint, date, date, text, uuid, text, text, text),
  private.archive_savings_goal(uuid, boolean),
  private.delete_savings_goal(uuid),
  private.add_goal_movement(uuid, text, bigint, date, text, uuid, uuid, boolean),
  private.update_goal_movement(uuid, bigint, date, text, boolean),
  private.void_goal_movement(uuid, text),
  private.create_debt(text, bigint, bigint, text, text, numeric, text, date, date, bigint, text, date, uuid, text, text, uuid),
  private.update_debt(uuid, text, bigint, bigint, text, text, numeric, text, date, date, bigint, text, date, uuid, text, text),
  private.archive_debt(uuid, boolean, boolean),
  private.delete_debt(uuid),
  private.register_debt_payment(uuid, text, bigint, uuid, bigint, date, text, uuid, boolean, boolean)
to authenticated;

-- Auxiliares y triggers: nadie las llama directamente.
revoke all on function
  private.check_movement(uuid, uuid, public.transaction_type, bigint, uuid, uuid, date, boolean, boolean, boolean, boolean, boolean),
  private.evaluate_budget_alerts(uuid, uuid, uuid, date),
  private.on_expense_check_budgets(),
  private.normalize_thresholds(integer[]),
  private.check_budget(uuid, uuid, uuid, bigint, text, date, date, text, boolean),
  private.goal_saved(uuid, uuid),
  private.check_goal(uuid, text, bigint, bigint, date, date, text, uuid, text, boolean),
  private.sync_goal_movement(),
  private.check_debt(uuid, text, bigint, bigint, text, text, numeric, text, date, date, bigint, text, date, uuid, text, boolean)
from public, anon, authenticated;

-- Funciones públicas: solo usuarios con sesión.
revoke all on function
  public.create_budget(uuid, bigint, text, date, date, text, integer[], uuid),
  public.update_budget(uuid, uuid, bigint, text, date, date, text, integer[]),
  public.archive_budget(uuid, boolean),
  public.delete_budget(uuid),
  public.create_savings_goal(text, bigint, bigint, date, date, text, uuid, text, text, text, uuid),
  public.update_savings_goal(uuid, text, bigint, bigint, date, date, text, uuid, text, text, text),
  public.archive_savings_goal(uuid, boolean),
  public.delete_savings_goal(uuid),
  public.add_goal_movement(uuid, text, bigint, date, text, uuid, uuid, boolean),
  public.update_goal_movement(uuid, bigint, date, text, boolean),
  public.void_goal_movement(uuid, text),
  public.create_debt(text, bigint, bigint, text, text, numeric, text, date, date, bigint, text, date, uuid, text, text, uuid),
  public.update_debt(uuid, text, bigint, bigint, text, text, numeric, text, date, date, bigint, text, date, uuid, text, text),
  public.archive_debt(uuid, boolean, boolean),
  public.delete_debt(uuid),
  public.register_debt_payment(uuid, text, bigint, uuid, bigint, date, text, uuid, boolean, boolean),
  public.budget_period_bounds(text, date, date, date),
  public.budget_history(uuid, integer),
  public.financial_summary(date),
  public.monthly_flows(integer),
  public.spending_by_category(date, date),
  public.planning_snapshot()
from public, anon;
grant execute on function
  public.create_budget(uuid, bigint, text, date, date, text, integer[], uuid),
  public.update_budget(uuid, uuid, bigint, text, date, date, text, integer[]),
  public.archive_budget(uuid, boolean),
  public.delete_budget(uuid),
  public.create_savings_goal(text, bigint, bigint, date, date, text, uuid, text, text, text, uuid),
  public.update_savings_goal(uuid, text, bigint, bigint, date, date, text, uuid, text, text, text),
  public.archive_savings_goal(uuid, boolean),
  public.delete_savings_goal(uuid),
  public.add_goal_movement(uuid, text, bigint, date, text, uuid, uuid, boolean),
  public.update_goal_movement(uuid, bigint, date, text, boolean),
  public.void_goal_movement(uuid, text),
  public.create_debt(text, bigint, bigint, text, text, numeric, text, date, date, bigint, text, date, uuid, text, text, uuid),
  public.update_debt(uuid, text, bigint, bigint, text, text, numeric, text, date, date, bigint, text, date, uuid, text, text),
  public.archive_debt(uuid, boolean, boolean),
  public.delete_debt(uuid),
  public.register_debt_payment(uuid, text, bigint, uuid, bigint, date, text, uuid, boolean, boolean),
  public.budget_period_bounds(text, date, date, date),
  public.budget_history(uuid, integer),
  public.financial_summary(date),
  public.monthly_flows(integer),
  public.spending_by_category(date, date),
  public.planning_snapshot()
to authenticated;
