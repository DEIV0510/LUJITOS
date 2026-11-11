-- =====================================================================
-- LUJITOS · Registro automático de perfil y validaciones de integridad
-- =====================================================================

-- ---------- Perfil y preferencias al registrarse ----------
-- SECURITY DEFINER porque escribe en tablas sin política INSERT. search_path vacío
-- para que no pueda ser secuestrado por objetos con el mismo nombre.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, terms_accepted_at)
  values (
    new.id,
    new.email,
    left(btrim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), 60),
    left(btrim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), 60),
    case when coalesce(new.raw_user_meta_data ->> 'terms_accepted', '') = 'true' then now() end
  );
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- El correo del perfil sigue al de Auth ----------
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;
revoke all on function public.handle_user_email_change() from public, anon, authenticated;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- ---------- Validación de movimientos ----------
-- Se ejecuta con los permisos de quien escribe (security invoker), así que la
-- búsqueda de la categoría respeta RLS: una categoría privada de otro usuario
-- "no existe" para él aunque conozca su UUID.
create or replace function public.validate_transaction()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  category_owner uuid;
  category_kind public.category_type;
begin
  if new.category_id is not null then
    select c.user_id, c.type into category_owner, category_kind
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
  end if;

  -- Ingresos y gastos necesitan categoría; transferencias y ajustes no.
  if new.type in ('income', 'expense') and new.category_id is null then
    raise exception 'Ingresos y gastos necesitan una categoría' using errcode = '23514';
  end if;

  -- No se registran movimientos nuevos en cuentas archivadas.
  if tg_op = 'INSERT' and exists (
    select 1 from public.accounts a
    where a.id in (new.account_id, new.destination_account_id) and not a.is_active
  ) then
    raise exception 'La cuenta está archivada' using errcode = '23514';
  end if;

  -- Un movimiento no cambia de dueño.
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then
    raise exception 'No se puede cambiar el dueño de un movimiento' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger transactions_validate
  before insert or update on public.transactions
  for each row execute function public.validate_transaction();

-- ---------- Las cuentas no cambian de dueño ni pierden su archivo ----------
create or replace function public.protect_account_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id <> old.user_id then
    raise exception 'No se puede cambiar el dueño de una cuenta' using errcode = '42501';
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

create trigger accounts_protect_owner
  before update on public.accounts
  for each row execute function public.protect_account_owner();
