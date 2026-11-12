-- =====================================================================
-- LUJITOS · Fase 4 · Las funciones con privilegios no quedan en la API
--
-- Recomendación de Supabase (lint 0029): una función SECURITY DEFINER no debe
-- estar en un esquema que publica la API. Las implementaciones se mueven al
-- esquema «private» (la API no lo expone) y en «public» queda un envoltorio
-- SECURITY INVOKER, sin privilegios, con la misma firma. La app llama igual.
-- Toda la validación (auth.uid(), dueño de las cuentas, bloqueos) sigue en la
-- implementación.
-- =====================================================================

alter function public.create_account(text, public.account_type, text, text, bigint, bigint, text, text, text, text, smallint, smallint, uuid) set schema private;
alter function public.update_account(uuid, text, public.account_type, text, text, bigint, bigint, text, text, text, text, smallint, smallint) set schema private;
alter function public.archive_account(uuid, boolean) set schema private;
alter function public.restore_account(uuid) set schema private;
alter function public.create_transaction(public.transaction_type, bigint, uuid, uuid, uuid, date, text, text, text, uuid, boolean, boolean) set schema private;
alter function public.update_transaction(uuid, bigint, uuid, uuid, uuid, date, text, text, text, boolean, boolean) set schema private;
alter function public.void_transaction(uuid, text) set schema private;
alter function public.reconcile_account(uuid, bigint, text, bigint, uuid) set schema private;
alter function public.delete_category(uuid, uuid) set schema private;

-- Solo usuarios con sesión pueden usar el esquema (y solo estas funciones;
-- las auxiliares account_balance y check_movement siguen cerradas).
grant usage on schema private to authenticated;

-- ---------- Envoltorios públicos (SECURITY INVOKER) ----------
create function public.create_account(
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
security invoker
set search_path = ''
as $$
begin
  return private.create_account(p_name, p_account_type, p_institution, p_institution_name, p_initial_balance, p_credit_limit,
    p_last_four_digits, p_color, p_icon, p_description, p_statement_day, p_payment_due_day, p_request_id);
end;
$$;

create function public.update_account(
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
security invoker
set search_path = ''
as $$
begin
  return private.update_account(p_account_id, p_name, p_account_type, p_institution, p_institution_name, p_initial_balance,
    p_credit_limit, p_last_four_digits, p_color, p_icon, p_description, p_statement_day, p_payment_due_day);
end;
$$;

create function public.archive_account(p_account_id uuid, p_force boolean default false)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.archive_account(p_account_id, p_force);
end;
$$;

create function public.restore_account(p_account_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.restore_account(p_account_id);
end;
$$;

create function public.create_transaction(
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
security invoker
set search_path = ''
as $$
begin
  return private.create_transaction(p_type, p_amount, p_account_id, p_destination_account_id, p_category_id, p_transaction_date,
    p_description, p_merchant, p_notes, p_request_id, p_allow_negative, p_allow_duplicate);
end;
$$;

create function public.update_transaction(
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
security invoker
set search_path = ''
as $$
begin
  return private.update_transaction(p_transaction_id, p_amount, p_account_id, p_destination_account_id, p_category_id,
    p_transaction_date, p_description, p_merchant, p_notes, p_allow_negative, p_allow_duplicate);
end;
$$;

create function public.void_transaction(p_transaction_id uuid, p_reason text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.void_transaction(p_transaction_id, p_reason);
end;
$$;

create function public.reconcile_account(
  p_account_id uuid,
  p_observed_balance bigint,
  p_reason text,
  p_expected_balance bigint default null,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.reconcile_account(p_account_id, p_observed_balance, p_reason, p_expected_balance, p_request_id);
end;
$$;

create function public.delete_category(p_category_id uuid, p_reassign_to uuid default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.delete_category(p_category_id, p_reassign_to);
end;
$$;

-- ---------- Permisos ----------
revoke all on function
  public.create_account(text, public.account_type, text, text, bigint, bigint, text, text, text, text, smallint, smallint, uuid),
  public.update_account(uuid, text, public.account_type, text, text, bigint, bigint, text, text, text, text, smallint, smallint),
  public.archive_account(uuid, boolean),
  public.restore_account(uuid),
  public.create_transaction(public.transaction_type, bigint, uuid, uuid, uuid, date, text, text, text, uuid, boolean, boolean),
  public.update_transaction(uuid, bigint, uuid, uuid, uuid, date, text, text, text, boolean, boolean),
  public.void_transaction(uuid, text),
  public.reconcile_account(uuid, bigint, text, bigint, uuid),
  public.delete_category(uuid, uuid)
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
  public.delete_category(uuid, uuid)
to authenticated;
