-- =====================================================================
-- LUJITOS · Pruebas de seguridad (RLS) e integridad
--
-- Se ejecutan dentro de UNA transacción que termina en ROLLBACK: crean dos
-- usuarios ficticios (A y B), prueban y no dejan nada guardado.
-- Si una comprobación falla, la ejecución se detiene con «PRUEBA FALLIDA».
--
-- Ejecutar contra el proyecto vinculado:
--   npx supabase db query --remote -f supabase/tests/rls_security.test.sql
-- Ejecutar en local (sin Supabase): npm run test:db
-- =====================================================================
begin;

create schema lujitos_tests;
create function lujitos_tests.check(ok boolean, message text) returns void
language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'PRUEBA FALLIDA: %', message;
  end if;
  raise notice 'ok - %', message;
end;
$$;
grant usage on schema lujitos_tests to authenticated, anon;
grant execute on function lujitos_tests.check(boolean, text) to authenticated, anon;

-- Usuarios ficticios (dominio .test reservado: nunca recibe correos).
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'usuario.a@lujitos.test',
   '{"first_name": "Ana", "last_name": "Prueba", "terms_accepted": "true"}'),
  ('22222222-2222-4222-8222-222222222222', 'usuario.b@lujitos.test',
   '{"first_name": "Beto", "last_name": "Prueba"}');

-- ---------------------------------------------------------------------
-- 1. Registro: perfil, preferencias y categorías
-- ---------------------------------------------------------------------
select lujitos_tests.check(
  (select count(*) from public.profiles where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')) = 2,
  'El registro crea el perfil automáticamente');
select lujitos_tests.check(
  (select first_name = 'Ana' and last_name = 'Prueba' and email = 'usuario.a@lujitos.test' and terms_accepted_at is not null
   from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'El perfil guarda nombre, correo y aceptación de términos');
select lujitos_tests.check(
  (select terms_accepted_at is null from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  'Sin aceptación explícita no se marca terms_accepted_at');
select lujitos_tests.check(
  (select bool_and(currency = 'COP' and country = 'CO' and timezone = 'America/Bogota') from public.profiles
   where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')),
  'Valores por defecto: COP, Colombia, America/Bogota');
select lujitos_tests.check(
  (select count(*) from public.user_preferences where user_id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')) = 2,
  'El registro crea las preferencias');
select lujitos_tests.check(
  (select count(*) from public.categories where user_id is null and type = 'income') = 8
  and (select count(*) from public.categories where user_id is null and type = 'expense') = 15,
  'Existen 8 categorías de ingreso y 15 de gasto del sistema');

-- Auditoría de Auth (estos cambios los hace el servicio de Auth de Supabase)
select lujitos_tests.check(
  (select count(*) from public.audit_logs where action = 'auth.signed_up'
     and user_id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')) = 2,
  'Auditoría: cada registro queda anotado');
update auth.users set email_confirmed_at = now(), last_sign_in_at = now() where id = '11111111-1111-4111-8111-111111111111';
update auth.users set encrypted_password = 'hash-de-prueba' where id = '11111111-1111-4111-8111-111111111111';
select lujitos_tests.check(
  (select array_agg(action order by action) from public.audit_logs
    where user_id = '11111111-1111-4111-8111-111111111111' and action like 'auth.%')
    = array['auth.email_confirmed', 'auth.password_changed', 'auth.signed_in', 'auth.signed_up'],
  'Auditoría: confirmación de correo, inicio de sesión y cambio de contraseña');

-- ---------------------------------------------------------------------
-- 2. Usuario A: sus datos y cálculo de saldos
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
set local role authenticated;

insert into public.accounts (id, name, institution, account_type, initial_balance) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Ahorros A', 'bancolombia', 'savings', 1000000),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Nequi A', 'nequi', 'digital_wallet', 200000),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'Tarjeta A', 'bancolombia', 'credit_card', 0);

select lujitos_tests.check(
  (select bool_and(user_id = '11111111-1111-4111-8111-111111111111') from public.accounts),
  'user_id se asigna solo con auth.uid()');

insert into public.transactions (id, account_id, destination_account_id, category_id, type, amount, adjustment_sign, description) values
  ('aaaaaaaa-0000-4000-8000-0000000000e1', 'aaaaaaaa-0000-4000-8000-000000000001', null,
   (select id from public.categories where slug = 'salary'), 'income', 2500000, null, 'Nómina'),
  ('aaaaaaaa-0000-4000-8000-0000000000e2', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002',
   null, 'transfer', 300000, null, 'Recarga Nequi'),
  ('aaaaaaaa-0000-4000-8000-0000000000e3', 'aaaaaaaa-0000-4000-8000-000000000002', null,
   (select id from public.categories where slug = 'food'), 'expense', 80000, null, 'Mercado'),
  ('aaaaaaaa-0000-4000-8000-0000000000e4', 'aaaaaaaa-0000-4000-8000-000000000003', null,
   (select id from public.categories where slug = 'tech'), 'expense', 400000, null, 'Compra con tarjeta'),
  ('aaaaaaaa-0000-4000-8000-0000000000e5', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000003',
   null, 'transfer', 150000, null, 'Pago de la tarjeta'),
  ('aaaaaaaa-0000-4000-8000-0000000000e6', 'aaaaaaaa-0000-4000-8000-000000000001', null,
   null, 'adjustment', 50000, -1, 'Ajuste de saldo');

select lujitos_tests.check(
  (select balance from public.account_balances where account_id = 'aaaaaaaa-0000-4000-8000-000000000001') = 3000000,
  'Saldo de ahorros: 1.000.000 + 2.500.000 − 300.000 − 150.000 − 50.000 = 3.000.000');
select lujitos_tests.check(
  (select balance from public.account_balances where account_id = 'aaaaaaaa-0000-4000-8000-000000000002') = 420000,
  'Saldo de Nequi: 200.000 + 300.000 − 80.000 = 420.000');
select lujitos_tests.check(
  (select balance from public.account_balances where account_id = 'aaaaaaaa-0000-4000-8000-000000000003') = -250000,
  'Tarjeta: compra −400.000 y pago +150.000 = −250.000 (deuda)');
select lujitos_tests.check(
  (select sum(balance) from public.account_balances) = 3170000,
  'Patrimonio 3.170.000: transferencias y pago de tarjeta no se cuentan dos veces');
select lujitos_tests.check(
  (select sum(amount) from public.transactions where type = 'income' and deleted_at is null) = 2500000
  and (select sum(amount) from public.transactions where type = 'expense' and deleted_at is null) = 480000,
  'Ingresos 2.500.000 y gastos 480.000: las transferencias no suman como ingreso ni gasto');

-- Borrado lógico
update public.transactions set deleted_at = now() where id = 'aaaaaaaa-0000-4000-8000-0000000000e3';
select lujitos_tests.check(
  (select balance from public.account_balances where account_id = 'aaaaaaaa-0000-4000-8000-000000000002') = 500000,
  'Un movimiento marcado como borrado deja de afectar el saldo');

-- Categoría propia
insert into public.categories (id, user_id, name, type, icon, color) values
  ('aaaaaaaa-0000-4000-8000-0000000000c1', '11111111-1111-4111-8111-111111111111', 'Mascotas', 'expense', 'pawprint.fill', 'amber');
select lujitos_tests.check(
  (select count(*) from public.categories where user_id is not null) = 1,
  'A puede crear su propia categoría');

-- Perfil: puede editar su nombre, no su correo
update public.profiles set first_name = 'Ana María' where id = '11111111-1111-4111-8111-111111111111';
select lujitos_tests.check(
  (select first_name from public.profiles) = 'Ana María', 'A edita su propio nombre');
do $$
begin
  update public.profiles set email = 'otro@lujitos.test' where id = '11111111-1111-4111-8111-111111111111';
  raise exception 'PRUEBA FALLIDA: el correo del perfil se pudo cambiar desde la app';
exception when insufficient_privilege then
  raise notice 'ok - El correo del perfil no se edita desde la app';
end $$;

-- Restricciones de integridad
do $$
begin
  insert into public.transactions (account_id, category_id, type, amount)
  values ('aaaaaaaa-0000-4000-8000-000000000001', (select id from public.categories where slug = 'food'), 'expense', -5000);
  raise exception 'PRUEBA FALLIDA: se aceptó un monto negativo';
exception when check_violation then raise notice 'ok - Los montos deben ser positivos';
end $$;
do $$
begin
  insert into public.transactions (account_id, category_id, type, amount)
  values ('aaaaaaaa-0000-4000-8000-000000000001', (select id from public.categories where slug = 'food'), 'expense', 0);
  raise exception 'PRUEBA FALLIDA: se aceptó un monto en cero';
exception when check_violation then raise notice 'ok - El monto no puede ser cero';
end $$;
do $$
begin
  insert into public.transactions (account_id, destination_account_id, type, amount)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'transfer', 1000);
  raise exception 'PRUEBA FALLIDA: transferencia a la misma cuenta';
exception when check_violation then raise notice 'ok - Una transferencia necesita cuentas distintas';
end $$;
do $$
begin
  insert into public.transactions (account_id, type, amount)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'transfer', 1000);
  raise exception 'PRUEBA FALLIDA: transferencia sin destino';
exception when check_violation then raise notice 'ok - Una transferencia necesita cuenta de destino';
end $$;
do $$
begin
  insert into public.transactions (account_id, destination_account_id, category_id, type, amount)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002',
          (select id from public.categories where slug = 'food'), 'transfer', 1000);
  raise exception 'PRUEBA FALLIDA: transferencia con categoría';
exception when check_violation then raise notice 'ok - Una transferencia no lleva categoría';
end $$;
do $$
begin
  insert into public.transactions (account_id, type, amount)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'expense', 1000);
  raise exception 'PRUEBA FALLIDA: gasto sin categoría';
exception when check_violation then raise notice 'ok - Ingresos y gastos necesitan categoría';
end $$;
do $$
begin
  insert into public.transactions (account_id, category_id, type, amount)
  values ('aaaaaaaa-0000-4000-8000-000000000001', (select id from public.categories where slug = 'salary'), 'expense', 1000);
  raise exception 'PRUEBA FALLIDA: gasto con categoría de ingreso';
exception when check_violation then raise notice 'ok - La categoría debe coincidir con el tipo';
end $$;
do $$
begin
  insert into public.transactions (account_id, type, amount)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'adjustment', 1000);
  raise exception 'PRUEBA FALLIDA: ajuste sin dirección';
exception when check_violation then raise notice 'ok - Un ajuste necesita dirección (+/−)';
end $$;
do $$
begin
  delete from public.transactions where id = 'aaaaaaaa-0000-4000-8000-0000000000e1';
  raise exception 'PRUEBA FALLIDA: se pudo borrar físicamente un movimiento';
exception when insufficient_privilege then raise notice 'ok - Los movimientos no se borran físicamente';
end $$;
do $$
begin
  delete from public.accounts where id = 'aaaaaaaa-0000-4000-8000-000000000002';
  raise exception 'PRUEBA FALLIDA: se pudo borrar físicamente una cuenta';
exception when insufficient_privilege then raise notice 'ok - Las cuentas se archivan, no se borran';
end $$;

-- Archivar cuenta
update public.accounts set is_active = false where id = 'aaaaaaaa-0000-4000-8000-000000000002';
select lujitos_tests.check(
  (select archived_at is not null from public.accounts where id = 'aaaaaaaa-0000-4000-8000-000000000002'),
  'Archivar una cuenta registra la fecha');
do $$
begin
  insert into public.transactions (account_id, category_id, type, amount)
  values ('aaaaaaaa-0000-4000-8000-000000000002', (select id from public.categories where slug = 'food'), 'expense', 1000);
  raise exception 'PRUEBA FALLIDA: movimiento nuevo en cuenta archivada';
exception when check_violation then raise notice 'ok - No se registran movimientos en cuentas archivadas';
end $$;
select lujitos_tests.check(
  (select balance from public.account_balances where account_id = 'aaaaaaaa-0000-4000-8000-000000000002') = 500000,
  'La cuenta archivada conserva su historial y su saldo');

-- ---------------------------------------------------------------------
-- 2b. Auditoría de las operaciones de A
-- ---------------------------------------------------------------------
select lujitos_tests.check(
  (select count(*) from public.audit_logs where action = 'account.created') = 3,
  'Auditoría: cada cuenta creada queda anotada');
select lujitos_tests.check(
  (select count(*) from public.audit_logs where action = 'transaction.created') = 6,
  'Auditoría: cada movimiento guardado queda anotado (los rechazados no)');
select lujitos_tests.check(
  (select changed_fields = '{deleted_at}' and entity_id = 'aaaaaaaa-0000-4000-8000-0000000000e3'
     from public.audit_logs where action = 'transaction.deleted'),
  'Auditoría: el borrado lógico de un movimiento queda anotado');
select lujitos_tests.check(
  (select count(*) from public.audit_logs
    where action = 'account.archived' and entity_id = 'aaaaaaaa-0000-4000-8000-000000000002') = 1,
  'Auditoría: archivar una cuenta queda anotado');
select lujitos_tests.check(
  (select count(*) from public.audit_logs where action = 'category.created') = 1,
  'Auditoría: crear una categoría propia queda anotado');
select lujitos_tests.check(
  (select changed_fields from public.audit_logs where action = 'profile.updated') = '{first_name}',
  'Auditoría: guarda qué campos cambiaron, no sus valores');
select lujitos_tests.check(
  not exists (
    select 1 from public.audit_logs l, jsonb_each_text(to_jsonb(l)) f
     where f.value ~ '(Nómina|Mercado|Ana|2500000|80000|lujitos\.test|hash-de-prueba)'),
  'Auditoría: no guarda montos, descripciones, nombres, correos ni contraseñas');
do $$
begin
  insert into public.audit_logs (user_id, action) values ('11111111-1111-4111-8111-111111111111', 'auth.signed_in');
  raise exception 'PRUEBA FALLIDA: la app escribió en la auditoría';
exception when insufficient_privilege then raise notice 'ok - La app no puede escribir en la auditoría';
end $$;
do $$
begin
  update public.audit_logs set action = 'account.created';
  raise exception 'PRUEBA FALLIDA: la app editó la auditoría';
exception when insufficient_privilege then raise notice 'ok - La auditoría no se puede editar desde la app';
end $$;
do $$
begin
  delete from public.audit_logs;
  raise exception 'PRUEBA FALLIDA: la app borró la auditoría';
exception when insufficient_privilege then raise notice 'ok - La auditoría no se puede borrar desde la app';
end $$;

-- ---------------------------------------------------------------------
-- 3. Usuario B: no ve ni toca nada de A
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);

select lujitos_tests.check((select count(*) from public.accounts) = 0, 'B no ve las cuentas de A');
select lujitos_tests.check((select count(*) from public.transactions) = 0, 'B no ve los movimientos de A');
select lujitos_tests.check((select count(*) from public.account_balances) = 0, 'B no ve los saldos de A');
select lujitos_tests.check((select count(*) from public.profiles) = 1, 'B solo ve su propio perfil');
select lujitos_tests.check((select count(*) from public.user_preferences) = 1, 'B solo ve sus preferencias');
select lujitos_tests.check((select count(*) from public.categories where user_id is not null) = 0, 'B no ve las categorías privadas de A');
select lujitos_tests.check((select count(*) from public.categories where user_id is null) = 23, 'B sí ve las categorías del sistema');
select lujitos_tests.check(
  (select count(*) from public.audit_logs) = 1
  and (select bool_and(user_id = '22222222-2222-4222-8222-222222222222') from public.audit_logs),
  'B solo ve su propia auditoría (no la de A)');

with changed as (
  update public.accounts set name = 'Intruso' where id = 'aaaaaaaa-0000-4000-8000-000000000001' returning 1
) select lujitos_tests.check((select count(*) from changed) = 0, 'B no puede modificar cuentas de A');
with changed as (
  update public.transactions set amount = 1 where id = 'aaaaaaaa-0000-4000-8000-0000000000e1' returning 1
) select lujitos_tests.check((select count(*) from changed) = 0, 'B no puede modificar movimientos de A');
with changed as (
  update public.profiles set first_name = 'Intruso' where id = '11111111-1111-4111-8111-111111111111' returning 1
) select lujitos_tests.check((select count(*) from changed) = 0, 'B no puede modificar el perfil de A');
with changed as (
  update public.categories set name = 'Intruso' where slug = 'food' returning 1
) select lujitos_tests.check((select count(*) from changed) = 0, 'Nadie puede modificar categorías del sistema');
with removed as (
  delete from public.categories where id = 'aaaaaaaa-0000-4000-8000-0000000000c1' returning 1
) select lujitos_tests.check((select count(*) from removed) = 0, 'B no puede borrar categorías de A');

do $$
begin
  insert into public.accounts (user_id, name, account_type)
  values ('11111111-1111-4111-8111-111111111111', 'Cuenta falsa', 'cash');
  raise exception 'PRUEBA FALLIDA: B creó una cuenta a nombre de A';
exception when insufficient_privilege then raise notice 'ok - B no puede crear cuentas a nombre de A';
end $$;

do $$
begin
  insert into public.transactions (account_id, category_id, type, amount)
  values ('aaaaaaaa-0000-4000-8000-000000000001', (select id from public.categories where slug = 'food'), 'expense', 1000);
  raise exception 'PRUEBA FALLIDA: B registró un movimiento en la cuenta de A';
exception when foreign_key_violation then raise notice 'ok - B no puede usar cuentas de A (clave foránea compuesta)';
end $$;

insert into public.accounts (id, name, account_type) values ('bbbbbbbb-0000-4000-8000-000000000001', 'Efectivo B', 'cash');
do $$
begin
  insert into public.transactions (account_id, destination_account_id, type, amount)
  values ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'transfer', 1000);
  raise exception 'PRUEBA FALLIDA: B transfirió hacia la cuenta de A';
exception when foreign_key_violation then raise notice 'ok - B no puede transferir hacia cuentas de A';
end $$;
do $$
begin
  insert into public.transactions (account_id, category_id, type, amount)
  values ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-0000000000c1', 'expense', 1000);
  raise exception 'PRUEBA FALLIDA: B usó una categoría privada de A';
exception when check_violation then raise notice 'ok - B no puede usar categorías privadas de A';
end $$;
do $$
begin
  insert into public.account_snapshots (account_id, balance, snapshot_date)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 1, current_date);
  raise exception 'PRUEBA FALLIDA: B guardó un histórico de la cuenta de A';
exception when foreign_key_violation then raise notice 'ok - B no puede crear históricos de cuentas de A';
end $$;
do $$
begin
  insert into public.categories (user_id, name, type, is_default, slug)
  values (null, 'Falsa del sistema', 'expense', true, 'falsa');
  raise exception 'PRUEBA FALLIDA: B creó una categoría del sistema';
exception when insufficient_privilege then raise notice 'ok - Nadie crea categorías del sistema desde la app';
end $$;
do $$
begin
  insert into public.profiles (id, first_name) values ('33333333-3333-4333-8333-333333333333', 'Falso');
  raise exception 'PRUEBA FALLIDA: B creó un perfil';
exception when insufficient_privilege then raise notice 'ok - Los perfiles solo los crea el registro';
end $$;

-- ---------------------------------------------------------------------
-- 4. Visitante sin sesión (anon): sin acceso a tablas privadas
-- ---------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
do $$
begin
  perform count(*) from public.accounts;
  raise exception 'PRUEBA FALLIDA: el visitante anónimo leyó cuentas';
exception when insufficient_privilege then raise notice 'ok - Sin sesión no se lee ninguna tabla privada';
end $$;
do $$
begin
  perform count(*) from public.audit_logs;
  raise exception 'PRUEBA FALLIDA: el visitante anónimo leyó la auditoría';
exception when insufficient_privilege then raise notice 'ok - Sin sesión no se lee la auditoría';
end $$;

reset role;
select lujitos_tests.check(
  (select count(*) from public.transactions where user_id = '11111111-1111-4111-8111-111111111111') = 6
  and (select amount from public.transactions where id = 'aaaaaaaa-0000-4000-8000-0000000000e1') = 2500000,
  'Los datos de A siguen intactos tras los intentos de B');

-- ---------------------------------------------------------------------
-- 5. Eliminar un usuario borra todos sus datos (derecho de supresión)
-- ---------------------------------------------------------------------
delete from auth.users where id = '11111111-1111-4111-8111-111111111111';
select lujitos_tests.check(
  (select count(*) from public.accounts where user_id = '11111111-1111-4111-8111-111111111111') = 0
  and (select count(*) from public.transactions where user_id = '11111111-1111-4111-8111-111111111111') = 0
  and (select count(*) from public.categories where user_id = '11111111-1111-4111-8111-111111111111') = 0
  and (select count(*) from public.profiles where id = '11111111-1111-4111-8111-111111111111') = 0
  and (select count(*) from public.user_preferences where user_id = '11111111-1111-4111-8111-111111111111') = 0
  and (select count(*) from public.audit_logs where user_id = '11111111-1111-4111-8111-111111111111') = 0,
  'Eliminar un usuario borra en cascada su perfil, cuentas, movimientos, categorías y auditoría');
select lujitos_tests.check(
  (select count(*) from public.accounts where user_id = '22222222-2222-4222-8222-222222222222') = 1,
  'Eliminar a A no toca los datos de B');

select 'TODAS LAS PRUEBAS DE SEGURIDAD PASARON' as resultado;
rollback;
