-- =====================================================================
-- LUJITOS · Esquema base
-- Montos en PESOS COLOMBIANOS ENTEROS (BIGINT). Nunca decimales.
-- Toda tabla privada lleva user_id y se protege con RLS (ver migración 2).
-- =====================================================================

-- ---------- Tipos ----------
create type public.account_type as enum (
  'bank', 'digital_wallet', 'cash', 'savings', 'checking', 'credit_card', 'investment', 'other'
);
create type public.connection_type as enum ('manual', 'import', 'open_finance');
create type public.category_type as enum ('income', 'expense');
create type public.transaction_type as enum ('income', 'expense', 'transfer', 'adjustment');
create type public.transaction_source as enum ('manual', 'import', 'open_finance', 'system');
create type public.theme_preference as enum ('system', 'light', 'dark');

-- ---------- Utilidad: updated_at automático ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- PROFILES (1 a 1 con auth.users) ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 60),
  last_name text not null default '' check (char_length(last_name) <= 60),
  email text check (email is null or char_length(email) <= 254),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  currency char(3) not null default 'COP' check (currency ~ '^[A-Z]{3}$'),
  country char(2) not null default 'CO' check (country ~ '^[A-Z]{2}$'),
  timezone text not null default 'America/Bogota' check (char_length(timezone) <= 64),
  terms_accepted_at timestamptz,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Perfil de cada usuario. Se crea solo al registrarse (trigger on_auth_user_created).';

-- ---------- ACCOUNTS ----------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  institution text not null default 'custom' check (char_length(institution) between 1 and 60),
  account_type public.account_type not null,
  -- Puede ser negativo: deuda inicial de una tarjeta de crédito o sobregiro.
  initial_balance bigint not null default 0,
  currency char(3) not null default 'COP' check (currency ~ '^[A-Z]{3}$'),
  last_four_digits char(4) check (last_four_digits ~ '^[0-9]{4}$'),
  color text check (color is null or color ~ '^(#[0-9A-Fa-f]{6}|[a-z]{3,12})$'),
  icon text check (icon is null or char_length(icon) <= 60),
  connection_type public.connection_type not null default 'manual',
  credit_limit bigint check (credit_limit is null or credit_limit >= 0),
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Permite claves foráneas compuestas (id, user_id): un movimiento solo puede
  -- apuntar a cuentas del mismo usuario, aunque conozca el UUID de otra.
  constraint accounts_id_user_unique unique (id, user_id),
  constraint accounts_archive_consistent check (is_active = (archived_at is null)),
  constraint accounts_credit_limit_only_cards check (credit_limit is null or account_type = 'credit_card')
);
comment on column public.accounts.initial_balance is 'Saldo al crear la cuenta, en pesos enteros. El saldo actual se calcula en la vista account_balances.';

-- ---------- CATEGORIES ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  -- NULL = categoría del sistema (visible para todos, nadie la modifica).
  user_id uuid references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  type public.category_type not null,
  icon text not null default 'ellipsis.circle.fill' check (char_length(icon) <= 60),
  color text not null default 'olive' check (color ~ '^(#[0-9A-Fa-f]{6}|[a-z]{3,12})$'),
  is_default boolean not null default false,
  -- Clave estable de las categorías del sistema (la app la usa para íconos).
  slug text check (slug is null or slug ~ '^[a-z0-9-]{2,40}$'),
  created_at timestamptz not null default now(),
  constraint categories_system_are_default check ((user_id is null) = is_default),
  constraint categories_system_have_slug check (user_id is not null or slug is not null)
);
create unique index categories_system_slug_key on public.categories (slug) where user_id is null;
create unique index categories_user_name_key on public.categories (user_id, type, lower(name)) where user_id is not null;
create index categories_user_id_idx on public.categories (user_id);

-- ---------- TRANSACTIONS ----------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid,
  destination_account_id uuid,
  category_id uuid references public.categories (id) on delete no action,
  type public.transaction_type not null,
  -- Siempre positivo: el tipo define si suma o resta.
  amount bigint not null check (amount > 0 and amount <= 999999999999999),
  -- Solo ajustes de saldo: +1 suma, -1 resta.
  adjustment_sign smallint check (adjustment_sign in (-1, 1)),
  description text not null default '' check (char_length(description) <= 120),
  merchant text check (merchant is null or char_length(merchant) <= 80),
  notes text check (notes is null or char_length(notes) <= 500),
  transaction_date date not null default ((now() at time zone 'America/Bogota')::date),
  source public.transaction_source not null default 'manual',
  -- Borrado lógico: los movimientos no se eliminan físicamente.
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint transactions_account_fk foreign key (account_id, user_id)
    references public.accounts (id, user_id) on delete no action,
  constraint transactions_destination_fk foreign key (destination_account_id, user_id)
    references public.accounts (id, user_id) on delete no action,

  -- Todo movimiento sale o entra de una cuenta.
  constraint transactions_account_required check (account_id is not null),
  -- Transferencia: origen y destino distintos y sin categoría (no es ingreso ni gasto).
  constraint transactions_transfer_shape check (
    (type = 'transfer' and destination_account_id is not null
       and destination_account_id <> account_id and category_id is null)
    or (type <> 'transfer' and destination_account_id is null)
  ),
  -- El ajuste necesita dirección; los demás tipos no la llevan.
  constraint transactions_adjustment_sign check ((type = 'adjustment') = (adjustment_sign is not null))
);
comment on table public.transactions is
  'Movimientos. Transferencias entre cuentas propias y pagos de tarjeta NO son ingreso ni gasto.';

create index transactions_user_date_idx on public.transactions (user_id, transaction_date desc) where deleted_at is null;
create index transactions_account_idx on public.transactions (account_id, user_id);
create index transactions_destination_idx on public.transactions (destination_account_id, user_id);
create index transactions_category_idx on public.transactions (category_id);

-- ---------- ACCOUNT_SNAPSHOTS (histórico de saldos) ----------
create table public.account_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  balance bigint not null,
  snapshot_date date not null,
  created_at timestamptz not null default now(),
  constraint account_snapshots_account_fk foreign key (account_id, user_id)
    references public.accounts (id, user_id) on delete no action,
  constraint account_snapshots_one_per_day unique (account_id, snapshot_date)
);
create index account_snapshots_account_idx on public.account_snapshots (account_id, user_id);
create index account_snapshots_user_date_idx on public.account_snapshots (user_id, snapshot_date desc);

-- ---------- USER_PREFERENCES ----------
create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  theme public.theme_preference not null default 'system',
  notifications_enabled boolean not null default true,
  biometric_enabled boolean not null default false,
  hide_amounts boolean not null default false,
  currency char(3) not null default 'COP' check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Índices de cuentas ----------
create index accounts_user_active_idx on public.accounts (user_id) where is_active;

-- ---------- updated_at ----------
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger accounts_set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();
create trigger transactions_set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();
create trigger user_preferences_set_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- ---------- Saldo actual de cada cuenta ----------
-- security_invoker: la vista respeta el RLS de quien consulta.
-- Cada movimiento afecta a cada cuenta una sola vez:
--   ingreso +, gasto −, transferencia − en origen y + en destino, ajuste ±.
-- Un pago de tarjeta es transferencia (banco − / tarjeta +): no es un gasto nuevo.
create view public.account_balances
with (security_invoker = true)
as
select
  a.id as account_id,
  a.user_id,
  (a.initial_balance + coalesce(sum(
    case
      when t.type = 'income' and t.account_id = a.id then t.amount
      when t.type = 'expense' and t.account_id = a.id then -t.amount
      when t.type = 'transfer' and t.account_id = a.id then -t.amount
      when t.type = 'transfer' and t.destination_account_id = a.id then t.amount
      when t.type = 'adjustment' and t.account_id = a.id then t.amount * t.adjustment_sign
      else 0
    end
  ), 0))::bigint as balance,
  count(t.id) as transaction_count,
  max(t.transaction_date) as last_transaction_date
from public.accounts a
left join public.transactions t
  on t.user_id = a.user_id
 and t.deleted_at is null
 and (t.account_id = a.id or t.destination_account_id = a.id)
group by a.id, a.user_id, a.initial_balance;
comment on view public.account_balances is 'Saldo actual = saldo inicial + movimientos no borrados. Respeta RLS.';
