-- =====================================================================
-- LUJITOS · Fase 4 · Motor financiero
--
-- Única fuente de verdad: saldo inicial + movimientos no anulados. No hay
-- saldos guardados aparte que puedan quedar desactualizados. La regla de cómo
-- afecta cada movimiento a una cuenta vive en UNA función
-- (public.transaction_effect) y la usan la vista de saldos, el historial y las
-- validaciones.
--
-- Cuentas de dinero: saldo = inicial + ingresos + transferencias recibidas
--                     − gastos − transferencias enviadas ± ajustes.
-- Tarjetas de crédito: el saldo es negativo = deuda. Una compra (gasto) la
--                     aumenta; un pago (transferencia desde un banco hacia la
--                     tarjeta) la reduce y descuenta el banco. El pago NO es otro
--                     gasto. Cupo disponible = cupo total − deuda.
--
-- Escrituras: SOLO por funciones RPC transaccionales (SECURITY DEFINER) que
-- toman el usuario de auth.uid(), bloquean las cuentas involucradas en orden
-- fijo (dos solicitudes simultáneas no se cruzan), validan todo en el servidor
-- y aceptan una clave de idempotencia (una solicitud repetida no duplica).
-- La app ya no puede insertar ni editar cuentas o movimientos directamente.
--
-- Códigos de error propios (la app los traduce):
--   LJ001 saldo quedaría negativo (se puede confirmar)
--   LJ002 compra supera el cupo de la tarjeta (se puede confirmar)
--   LJ003 transferencia repetida hace un momento (se puede confirmar)
--   LJ004 la cuenta a archivar tiene saldo (se puede confirmar)
--   LJ005 el saldo cambió mientras se ajustaba (volver a revisar)
--   LJ006 cuenta, movimiento o categoría inexistente, ajena o archivada
--   LJ007 datos no válidos
--   LJ008 movimiento anulado: no se modifica
--   LJ009 categoría con movimientos: hay que reasignarlos o archivarla
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------
-- 1. Regla única: efecto de un movimiento sobre una cuenta
-- ---------------------------------------------------------------------
create or replace function public.transaction_effect(
  p_type public.transaction_type,
  p_amount bigint,
  p_adjustment_sign smallint,
  p_account_id uuid,
  p_destination_account_id uuid,
  p_target uuid
)
returns bigint
language sql
immutable
parallel safe
set search_path = ''
as $$
  select (case
    when p_type = 'income' and p_account_id = p_target then p_amount
    when p_type = 'expense' and p_account_id = p_target then -p_amount
    when p_type = 'transfer' and p_account_id = p_target then -p_amount
    when p_type = 'transfer' and p_destination_account_id = p_target then p_amount
    when p_type = 'adjustment' and p_account_id = p_target then p_amount * p_adjustment_sign
    else 0
  end)::bigint
$$;
comment on function public.transaction_effect is
  'Única regla contable: cuánto suma o resta un movimiento a una cuenta. Transferencia = − origen / + destino (no es ingreso ni gasto).';

-- ---------------------------------------------------------------------
-- 2. Cuentas: entidad personalizada, descripción, fechas de tarjeta
-- ---------------------------------------------------------------------
alter table public.accounts
  add column institution_name text
    check (institution_name is null or char_length(btrim(institution_name)) between 1 and 60),
  add column description text check (description is null or char_length(description) <= 140),
  add column statement_day smallint check (statement_day between 1 and 31),
  add column payment_due_day smallint check (payment_due_day between 1 and 31),
  add column client_request_id uuid;

alter table public.accounts
  add constraint accounts_card_days_only_cards
    check ((statement_day is null and payment_due_day is null) or account_type = 'credit_card'),
  -- Saldo inicial: dinero (≥ 0) o deuda de tarjeta (≤ 0).
  add constraint accounts_initial_balance_sign check (
    (account_type = 'credit_card' and initial_balance <= 0)
    or (account_type <> 'credit_card' and initial_balance >= 0)
  );

create unique index accounts_request_key on public.accounts (user_id, client_request_id)
  where client_request_id is not null;

comment on column public.accounts.institution_name is 'Nombre de la entidad cuando no está en la lista (institution = custom).';
comment on column public.accounts.initial_balance is
  'Dinero (≥ 0) o deuda de tarjeta (≤ 0) al empezar a usar LUJITOS. No cambia si la cuenta ya tiene movimientos.';

-- ---------------------------------------------------------------------
-- 3. Categorías: archivar e «Intereses y comisiones» para tarjetas
-- ---------------------------------------------------------------------
alter table public.categories add column archived_at timestamptz;
alter table public.categories add constraint categories_system_never_archived
  check (user_id is not null or archived_at is null);

insert into public.categories (user_id, slug, name, type, icon, color, is_default)
values (null, 'fees', 'Intereses y comisiones', 'expense', 'percent', 'clay', true)
on conflict (slug) where user_id is null do nothing;

-- ---------------------------------------------------------------------
-- 4. Movimientos: motivo de anulación e idempotencia
-- ---------------------------------------------------------------------
alter table public.transactions
  add column void_reason text check (void_reason is null or char_length(void_reason) <= 200),
  add column client_request_id uuid;
alter table public.transactions
  add constraint transactions_void_reason_only_voided check (void_reason is null or deleted_at is not null);

create unique index transactions_request_key on public.transactions (user_id, client_request_id)
  where client_request_id is not null;

comment on column public.transactions.deleted_at is
  'Anulación: el movimiento deja de contar en los saldos pero se conserva, con su motivo (void_reason).';

-- ---------------------------------------------------------------------
-- 5. Validaciones de integridad (se aplican por cualquier camino)
-- ---------------------------------------------------------------------
create or replace function public.validate_transaction()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  category_owner uuid;
  category_kind public.category_type;
  category_archived timestamptz;
begin
  -- Un movimiento anulado queda congelado. Solo se admite reasignar su
  -- categoría (al eliminar una categoría): eso no cambia ningún saldo.
  if tg_op = 'UPDATE' and old.deleted_at is not null then
    if (to_jsonb(new) - 'category_id' - 'updated_at') is distinct from (to_jsonb(old) - 'category_id' - 'updated_at') then
      raise exception 'Un movimiento anulado no se puede modificar' using errcode = 'LJ008';
    end if;
    return new;
  end if;

  if new.category_id is not null then
    select c.user_id, c.type, c.archived_at into category_owner, category_kind, category_archived
    from public.categories c
    where c.id = new.category_id;

    if not found or (category_owner is not null and category_owner <> new.user_id) then
      raise exception 'Categoría no válida para este usuario' using errcode = '23514';
    end if;

    if new.type = 'adjustment'
       or (new.type = 'income' and category_kind <> 'income')
       or (new.type = 'expense' and category_kind <> 'expense') then
      raise exception 'La categoría no corresponde al tipo de movimiento' using errcode = '23514';
    end if;

    if category_archived is not null and (tg_op = 'INSERT' or new.category_id is distinct from old.category_id) then
      raise exception 'La categoría está archivada' using errcode = '23514';
    end if;
  end if;

  -- Ingresos y gastos necesitan categoría; transferencias y ajustes no.
  if new.type in ('income', 'expense') and new.category_id is null then
    raise exception 'Ingresos y gastos necesitan una categoría' using errcode = '23514';
  end if;

  -- Nada nuevo entra ni sale de una cuenta archivada (al crear o al cambiar de cuenta).
  if (tg_op = 'INSERT' and exists (
        select 1 from public.accounts a
        where a.id in (new.account_id, new.destination_account_id) and not a.is_active))
     or (tg_op = 'UPDATE' and (
        (new.account_id is distinct from old.account_id
          and exists (select 1 from public.accounts a where a.id = new.account_id and not a.is_active))
        or (new.destination_account_id is distinct from old.destination_account_id
          and exists (select 1 from public.accounts a where a.id = new.destination_account_id and not a.is_active))))
  then
    raise exception 'La cuenta está archivada' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new.user_id <> old.user_id then
    raise exception 'No se puede cambiar el dueño de un movimiento' using errcode = '42501';
  end if;

  return new;
end;
$$;

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

  -- Archivar/reactivar mantiene coherentes is_active y archived_at.
  if new.is_active and not old.is_active then
    new.archived_at := null;
  elsif not new.is_active and old.is_active then
    new.archived_at := coalesce(new.archived_at, now());
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Saldos: vista con resumen por cuenta (misma regla única)
-- ---------------------------------------------------------------------
create or replace view public.account_balances
with (security_invoker = true)
as
select
  a.id as account_id,
  a.user_id,
  (a.initial_balance + coalesce(sum(
    public.transaction_effect(t.type, t.amount, t.adjustment_sign, t.account_id, t.destination_account_id, a.id)
  ), 0))::bigint as balance,
  count(t.id) as transaction_count,
  max(t.transaction_date) as last_transaction_date,
  coalesce(sum(t.amount) filter (where t.type = 'income' and t.account_id = a.id), 0)::bigint as total_income,
  coalesce(sum(t.amount) filter (where t.type = 'expense' and t.account_id = a.id), 0)::bigint as total_expense,
  coalesce(sum(t.amount) filter (where t.type = 'transfer' and t.destination_account_id = a.id), 0)::bigint as transfers_in,
  coalesce(sum(t.amount) filter (where t.type = 'transfer' and t.account_id = a.id), 0)::bigint as transfers_out,
  coalesce(sum(t.amount * t.adjustment_sign) filter (where t.type = 'adjustment' and t.account_id = a.id), 0)::bigint
    as adjustments_net,
  max(t.created_at) as last_activity_at
from public.accounts a
left join public.transactions t
  on t.user_id = a.user_id
 and t.deleted_at is null
 and (t.account_id = a.id or t.destination_account_id = a.id)
group by a.id, a.user_id, a.initial_balance;
comment on view public.account_balances is
  'Saldo actual y resumen por cuenta = saldo inicial + movimientos no anulados (transaction_effect). Respeta RLS.';

-- Saldo de una cuenta, opcionalmente sin contar un movimiento (al editarlo).
create or replace function private.account_balance(p_account_id uuid, p_exclude_transaction uuid default null)
returns bigint
language sql
stable
set search_path = ''
as $$
  select (a.initial_balance + coalesce((
    select sum(public.transaction_effect(t.type, t.amount, t.adjustment_sign, t.account_id, t.destination_account_id, a.id))
    from public.transactions t
    where t.user_id = a.user_id
      and t.deleted_at is null
      and (t.account_id = a.id or t.destination_account_id = a.id)
      and (p_exclude_transaction is null or t.id <> p_exclude_transaction)
  ), 0))::bigint
  from public.accounts a
  where a.id = p_account_id
$$;

-- ---------------------------------------------------------------------
-- 7. Validación común de un movimiento (ingreso, gasto, transferencia)
-- ---------------------------------------------------------------------
create or replace function private.check_movement(
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
  p_allow_duplicate boolean
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

  -- Bloqueo en orden fijo: dos operaciones simultáneas sobre las mismas
  -- cuentas se ejecutan una después de la otra (sin bloqueos cruzados).
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

  -- ¿Alcanza el dinero o el cupo? (solo si la operación saca dinero o aumenta deuda)
  if p_type in ('expense', 'transfer') then
    v_balance := private.account_balance(p_account_id, p_exclude_transaction);
    v_after := v_balance - p_amount;
    if v_source.account_type = 'credit_card' then
      if v_source.credit_limit is not null and -v_after > v_source.credit_limit and not p_allow_negative then
        raise exception 'Supera el cupo disponible de «%».', v_source.name
          using errcode = 'LJ002', detail = greatest(v_source.credit_limit + v_balance, 0)::text;
      end if;
    elsif v_after < 0 and not p_allow_negative then
      raise exception 'El saldo de «%» quedaría negativo.', v_source.name
        using errcode = 'LJ001', detail = v_after::text;
    end if;
  end if;

  -- La misma transferencia registrada hace menos de dos minutos (doble envío).
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

-- ---------------------------------------------------------------------
-- 8. RPC: cuentas
-- ---------------------------------------------------------------------
create or replace function public.create_account(
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

create or replace function public.update_account(
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
begin
  if v_user is null then
    raise exception 'Inicia sesión.' using errcode = '42501';
  end if;
  perform 1 from public.accounts a where a.id = p_account_id and a.user_id = v_user for update;
  if not found then
    raise exception 'La cuenta no existe o no es tuya.' using errcode = 'LJ006';
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

-- Archivar no borra nada: la cuenta y su historial se conservan.
create or replace function public.archive_account(p_account_id uuid, p_force boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_balance bigint;
begin
  perform 1 from public.accounts a where a.id = p_account_id and a.user_id = v_user for update;
  if not found then
    raise exception 'La cuenta no existe o no es tuya.' using errcode = 'LJ006';
  end if;
  v_balance := private.account_balance(p_account_id);
  if v_balance <> 0 and not p_force then
    raise exception 'La cuenta todavía tiene saldo: al archivarla deja de sumar en tus totales.'
      using errcode = 'LJ004', detail = v_balance::text;
  end if;
  update public.accounts set is_active = false where id = p_account_id and user_id = v_user;
end;
$$;

create or replace function public.restore_account(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.accounts set is_active = true where id = p_account_id and user_id = auth.uid();
  if not found then
    raise exception 'La cuenta no existe o no es tuya.' using errcode = 'LJ006';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. RPC: movimientos
-- ---------------------------------------------------------------------
create or replace function public.create_transaction(
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
  -- Idempotencia: la misma solicitud repetida devuelve el movimiento ya creado.
  if p_request_id is not null then
    select t.id into v_id from public.transactions t where t.user_id = v_user and t.client_request_id = p_request_id;
    if found then
      return v_id;
    end if;
  end if;

  perform private.check_movement(
    v_user, null, p_type, p_amount, p_account_id, p_destination_account_id, p_transaction_date,
    true, true, p_allow_negative, p_allow_duplicate
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

-- Editar recalcula todo: los saldos se derivan de los movimientos.
create or replace function public.update_transaction(
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

  -- Bloquea las cuentas de antes y de después, en orden fijo.
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
    p_allow_negative, p_allow_duplicate
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

-- Anular: deja de contar en los saldos (una transferencia restaura ambas
-- cuentas a la vez), pero el registro y su motivo se conservan.
create or replace function public.void_transaction(p_transaction_id uuid, p_reason text default null)
returns void
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
    return; -- ya estaba anulado: repetir la solicitud no cambia nada
  end if;
  if char_length(coalesce(p_reason, '')) > 200 then
    raise exception 'El motivo puede tener hasta 200 caracteres.' using errcode = 'LJ007';
  end if;
  perform 1 from public.accounts a
   where a.user_id = v_user and a.id in (v_old.account_id, v_old.destination_account_id)
   order by a.id
   for update;
  update public.transactions
     set deleted_at = now(), void_reason = nullif(btrim(coalesce(p_reason, '')), '')
   where id = p_transaction_id;
end;
$$;

-- Ajuste de saldo: compara el saldo real observado con el calculado y registra
-- la diferencia como un movimiento de ajuste con su motivo. Nunca cambia el
-- historial en silencio. p_expected_balance es el saldo que el usuario vio al
-- confirmar: si cambió entretanto, se le pide revisar de nuevo.
create or replace function public.reconcile_account(
  p_account_id uuid,
  p_observed_balance bigint,
  p_reason text,
  p_expected_balance bigint default null,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_account public.accounts%rowtype;
  v_balance bigint;
  v_difference bigint;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Inicia sesión.' using errcode = '42501';
  end if;
  if p_request_id is not null then
    select t.id, t.amount * t.adjustment_sign into v_id, v_difference
      from public.transactions t where t.user_id = v_user and t.client_request_id = p_request_id;
    if found then
      return jsonb_build_object('transaction_id', v_id, 'difference', v_difference);
    end if;
  end if;

  select * into v_account from public.accounts a where a.id = p_account_id and a.user_id = v_user for update;
  if not found then
    raise exception 'La cuenta no existe o no es tuya.' using errcode = 'LJ006';
  end if;
  if not v_account.is_active then
    raise exception 'La cuenta «%» está archivada.', v_account.name using errcode = 'LJ006';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) = 0 or char_length(p_reason) > 500 then
    raise exception 'Escribe el motivo del ajuste.' using errcode = 'LJ007';
  end if;
  if p_observed_balance is null or abs(p_observed_balance) > 999999999999999 then
    raise exception 'El saldo real no es válido.' using errcode = 'LJ007';
  end if;

  v_balance := private.account_balance(p_account_id);
  if p_expected_balance is not null and v_balance <> p_expected_balance then
    raise exception 'El saldo cambió mientras ajustabas. Revisa la diferencia de nuevo.'
      using errcode = 'LJ005', detail = v_balance::text;
  end if;
  v_difference := p_observed_balance - v_balance;
  if v_difference = 0 then
    return jsonb_build_object('transaction_id', null, 'difference', 0);
  end if;

  insert into public.transactions (
    user_id, account_id, type, amount, adjustment_sign, description, notes, transaction_date, source, client_request_id
  )
  values (
    v_user, p_account_id, 'adjustment', abs(v_difference), sign(v_difference)::smallint, 'Ajuste de saldo',
    btrim(p_reason), (now() at time zone 'America/Bogota')::date, 'manual', p_request_id
  )
  returning id into v_id;
  return jsonb_build_object('transaction_id', v_id, 'difference', v_difference);
end;
$$;

-- ---------------------------------------------------------------------
-- 10. RPC: categorías
-- ---------------------------------------------------------------------
-- Una categoría con movimientos no se borra sin decir a cuál pasan sus
-- movimientos (o se archiva: deja de ofrecerse pero conserva el historial).
create or replace function public.delete_category(p_category_id uuid, p_reassign_to uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_category public.categories%rowtype;
  v_target public.categories%rowtype;
  v_count bigint;
begin
  select * into v_category from public.categories c where c.id = p_category_id and c.user_id = v_user for update;
  if not found then
    raise exception 'La categoría no existe o no es tuya.' using errcode = 'LJ006';
  end if;
  select count(*) into v_count from public.transactions t where t.category_id = p_category_id and t.user_id = v_user;
  if v_count > 0 then
    if p_reassign_to is null then
      raise exception 'La categoría tiene movimientos: elige a cuál pasarlos o archívala.'
        using errcode = 'LJ009', detail = v_count::text;
    end if;
    select * into v_target from public.categories c
     where c.id = p_reassign_to and (c.user_id is null or c.user_id = v_user);
    if not found or v_target.id = p_category_id or v_target.type <> v_category.type or v_target.archived_at is not null then
      raise exception 'Elige otra categoría activa del mismo tipo.' using errcode = 'LJ007';
    end if;
    update public.transactions set category_id = p_reassign_to
     where category_id = p_category_id and user_id = v_user;
  end if;
  delete from public.categories where id = p_category_id and user_id = v_user;
end;
$$;

-- ---------------------------------------------------------------------
-- 11. Lecturas calculadas en PostgreSQL (respetan RLS: SECURITY INVOKER)
-- ---------------------------------------------------------------------
-- Resumen financiero: cuentas activas, cada una contada una sola vez.
-- Disponible = bancos + billeteras + efectivo. Invertido aparte. Deuda = lo que
-- se debe en tarjetas. Patrimonio neto = todo lo que se tiene − deudas. El cupo
-- de crédito NO suma al patrimonio.
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
      coalesce(sum(credit_limit) filter (where kind = 'credit_card'), 0) as credit_limit,
      coalesce(sum(greatest(credit_limit + balance, 0)) filter (where kind = 'credit_card' and credit_limit is not null), 0)
        as credit_available,
      coalesce(sum(balance), 0) as net_worth,
      count(*) as accounts
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
    'credit_limit', t.credit_limit,
    'credit_available', t.credit_available,
    'net_worth', t.net_worth,
    'accounts', t.accounts,
    'month_start', m.start,
    'month_income', f.income,
    'month_expense', f.expense
  )
  from totals t, period m, flows f
$$;

-- Evolución diaria del saldo de una cuenta (para el gráfico). Máximo 400 días.
create or replace function public.account_balance_history(p_account_id uuid, p_from date, p_to date)
returns table (day date, balance bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with account as (
    select a.id, a.initial_balance from public.accounts a where a.id = p_account_id
  ),
  effects as (
    select t.transaction_date as d,
           sum(public.transaction_effect(t.type, t.amount, t.adjustment_sign, t.account_id, t.destination_account_id, a.id)) as delta
      from public.transactions t
      join account a on t.account_id = a.id or t.destination_account_id = a.id
     where t.deleted_at is null
     group by t.transaction_date
  ),
  days as (
    select generate_series(p_from, least(p_to, p_from + 400), interval '1 day')::date as d
  )
  select days.d,
         (a.initial_balance + coalesce((select sum(e.delta) from effects e where e.d <= days.d), 0))::bigint
    from days cross join account a
   order by days.d
$$;

-- ---------------------------------------------------------------------
-- 12. Permisos: escrituras solo por RPC
-- ---------------------------------------------------------------------
revoke insert, update on public.accounts from authenticated;
revoke insert, update on public.transactions from authenticated;

revoke all on function
  public.create_account(text, public.account_type, text, text, bigint, bigint, text, text, text, text, smallint, smallint, uuid),
  public.update_account(uuid, text, public.account_type, text, text, bigint, bigint, text, text, text, text, smallint, smallint),
  public.archive_account(uuid, boolean),
  public.restore_account(uuid),
  public.create_transaction(public.transaction_type, bigint, uuid, uuid, uuid, date, text, text, text, uuid, boolean, boolean),
  public.update_transaction(uuid, bigint, uuid, uuid, uuid, date, text, text, text, boolean, boolean),
  public.void_transaction(uuid, text),
  public.reconcile_account(uuid, bigint, text, bigint, uuid),
  public.delete_category(uuid, uuid),
  public.financial_summary(date),
  public.account_balance_history(uuid, date, date),
  public.transaction_effect(public.transaction_type, bigint, smallint, uuid, uuid, uuid)
from public, anon;

grant execute on function
  public.create_account(text, public.account_type, text, text, bigint, bigint, text, text, text, text, smallint, smallint, uuid),
  public.update_account(uuid, text, public.account_type, text, text, bigint, bigint, text, text, text, text, smallint, smallint),
  public.archive_account(uuid, boolean),
  public.restore_account(uuid),
  public.create_transaction(public.transaction_type, bigint, uuid, uuid, uuid, date, text, text, text, uuid, boolean, boolean),
  public.update_transaction(uuid, bigint, uuid, uuid, uuid, date, text, text, text, boolean, boolean),
  public.void_transaction(uuid, text),
  public.reconcile_account(uuid, bigint, text, bigint, uuid),
  public.delete_category(uuid, uuid),
  public.financial_summary(date),
  public.account_balance_history(uuid, date, date),
  public.transaction_effect(public.transaction_type, bigint, smallint, uuid, uuid, uuid)
to authenticated;

revoke all on function
  private.account_balance(uuid, uuid),
  private.check_movement(uuid, uuid, public.transaction_type, bigint, uuid, uuid, date, boolean, boolean, boolean, boolean)
from public, anon, authenticated;
