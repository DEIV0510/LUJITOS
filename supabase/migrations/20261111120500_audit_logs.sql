-- =====================================================================
-- LUJITOS · Registro de auditoría de operaciones sensibles
--
-- Qué se registra:
--   auth.*         registro, correo confirmado, inicio de sesión, cambio de
--                  contraseña y de correo
--   account.*      cuenta creada, editada, archivada o reactivada
--   transaction.*  movimiento creado, editado, borrado (lógico) o restaurado
--   category.*     categoría propia creada, editada o borrada
--   profile.*      perfil editado, onboarding completado
--   preferences.*  preferencias editadas (tema, notificaciones, Face ID…)
--
-- Qué NO se guarda nunca: montos, descripciones, comercios, notas, nombres,
-- correos, contraseñas, tokens ni datos bancarios. Solo la acción, el registro
-- afectado (UUID) y los NOMBRES de los campos que cambiaron.
--
-- Lo escriben únicamente triggers (SECURITY DEFINER). Desde la app solo se
-- pueden leer los registros propios: nadie los inserta, edita ni borra. Si se
-- elimina el usuario, su registro se borra en cascada (derecho de supresión).
-- =====================================================================

create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity_id uuid,
  changed_fields text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_logs_user_created_idx on public.audit_logs (user_id, created_at desc);
comment on table public.audit_logs is
  'Auditoría de operaciones sensibles. Sin montos, textos, contraseñas ni tokens: solo acción, registro y campos cambiados.';

alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;
create policy "audit_logs: ver los propios" on public.audit_logs
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------- Cambios en datos financieros y de perfil ----------
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
  end;
  v_user uuid := case when tg_table_name = 'profiles' then (v_row ->> 'id')::uuid else (v_row ->> 'user_id')::uuid end;
  v_fields text[] := '{}';
  v_action text;
begin
  -- Categorías del sistema (sin dueño): solo cambian por migraciones.
  if v_user is null then
    return null;
  end if;
  -- Al eliminar un usuario, sus datos se borran en cascada: no hay a quién atribuirlo.
  if tg_op = 'DELETE' and not exists (select 1 from auth.users where id = v_user) then
    return null;
  end if;

  if tg_op = 'INSERT' then
    v_action := v_entity || '.created';
  elsif tg_op = 'DELETE' then
    v_action := v_entity || '.deleted';
  else
    select coalesce(array_agg(n.key order by n.key), '{}')
      into v_fields
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
     where n.value is distinct from o.value
       and n.key not in ('updated_at', 'archived_at');
    if cardinality(v_fields) = 0 then
      return null;
    end if;
    v_action := case
      when v_entity = 'account' and 'is_active' = any (v_fields) then
        case when (v_row ->> 'is_active')::boolean then 'account.restored' else 'account.archived' end
      when v_entity = 'transaction' and 'deleted_at' = any (v_fields) then
        case when (v_row ->> 'deleted_at') is null then 'transaction.restored' else 'transaction.deleted' end
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

create trigger audit_accounts after insert or update on public.accounts
  for each row execute function public.audit_row_change();
create trigger audit_transactions after insert or update on public.transactions
  for each row execute function public.audit_row_change();
create trigger audit_categories after insert or update or delete on public.categories
  for each row execute function public.audit_row_change();
create trigger audit_profiles after update on public.profiles
  for each row execute function public.audit_row_change();
create trigger audit_user_preferences after update on public.user_preferences
  for each row execute function public.audit_row_change();

-- ---------- Eventos de Auth ----------
-- Si la auditoría fallara, el registro o el inicio de sesión NO se bloquean:
-- se deja un aviso en el log de Postgres (sin datos del usuario) y sigue.
create or replace function public.audit_auth_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if tg_op = 'INSERT' then
      insert into public.audit_logs (user_id, action) values (new.id, 'auth.signed_up');
    else
      if new.email_confirmed_at is not null and old.email_confirmed_at is null then
        insert into public.audit_logs (user_id, action) values (new.id, 'auth.email_confirmed');
      end if;
      if new.last_sign_in_at is distinct from old.last_sign_in_at and new.last_sign_in_at is not null then
        insert into public.audit_logs (user_id, action) values (new.id, 'auth.signed_in');
      end if;
      if new.encrypted_password is distinct from old.encrypted_password then
        insert into public.audit_logs (user_id, action) values (new.id, 'auth.password_changed');
      end if;
      if new.email is distinct from old.email then
        insert into public.audit_logs (user_id, action) values (new.id, 'auth.email_changed');
      end if;
    end if;
  exception when others then
    raise warning 'LUJITOS: no se pudo registrar un evento de auditoría (%)', sqlstate;
  end;
  return null;
end;
$$;
revoke all on function public.audit_auth_event() from public, anon, authenticated;

create trigger audit_auth_users
  after insert or update of email, encrypted_password, email_confirmed_at, last_sign_in_at on auth.users
  for each row execute function public.audit_auth_event();
