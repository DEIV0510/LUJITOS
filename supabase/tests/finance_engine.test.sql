-- =====================================================================
-- LUJITOS · Fase 4 · Pruebas del motor financiero (RPC)
--
-- Los 8 casos del brief, más: saldo insuficiente, cupo, transferencia repetida,
-- idempotencia, archivar con saldo, ajuste de saldo, edición y anulación,
-- categorías, historial, resumen financiero y aislamiento entre usuarios.
-- Todo dentro de una transacción que termina en ROLLBACK: no deja nada.
--
--   npm run test:db           (PostgreSQL local, PGlite)
--   npm run test:db:remote    (proyecto real, junto con rls_security.test.sql)
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
create table lujitos_tests.ids (k text primary key, v uuid);
create table lujitos_tests.nums (k text primary key, v bigint);
create function lujitos_tests.id(p_key text) returns uuid
language sql stable as $$ select v from lujitos_tests.ids where k = p_key $$;
create function lujitos_tests.bal(p_key text) returns bigint
language sql stable as $$
  select b.balance from public.account_balances b join lujitos_tests.ids i on i.v = b.account_id where i.k = p_key
$$;
create function lujitos_tests.cat(p_slug text) returns uuid
language sql stable as $$ select id from public.categories where slug = p_slug and user_id is null $$;
grant usage on schema lujitos_tests to authenticated, anon;
grant all on lujitos_tests.ids, lujitos_tests.nums to authenticated;
grant execute on all functions in schema lujitos_tests to authenticated, anon;

insert into auth.users (id, email, raw_user_meta_data) values
  ('33333333-3333-4333-8333-333333333333', 'usuario.c@lujitos.test', '{"first_name": "Carla"}'),
  ('44444444-4444-4444-8444-444444444444', 'usuario.d@lujitos.test', '{"first_name": "Dario"}');

select set_config('request.jwt.claims', '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}', true);
set local role authenticated;

-- ---------------------------------------------------------------------
-- CASO 1: ingreso
-- ---------------------------------------------------------------------
insert into lujitos_tests.ids select 'caso1',
  public.create_account(p_name => 'Ahorros nómina', p_account_type => 'savings', p_institution => 'bancolombia',
                        p_initial_balance => 1000000);
select public.create_transaction('income', 200000, lujitos_tests.id('caso1'),
  p_category_id => lujitos_tests.cat('salary'), p_description => 'Nómina', p_merchant => 'Empresa S.A.S.');
select lujitos_tests.check(lujitos_tests.bal('caso1') = 1200000, 'CASO 1: 1.000.000 + ingreso 200.000 = 1.200.000');

-- ---------------------------------------------------------------------
-- CASO 2: gasto
-- ---------------------------------------------------------------------
insert into lujitos_tests.ids select 'caso2',
  public.create_account(p_name => 'Efectivo', p_account_type => 'cash', p_institution => 'cash', p_initial_balance => 1000000);
select public.create_transaction('expense', 150000, lujitos_tests.id('caso2'),
  p_category_id => lujitos_tests.cat('food'), p_description => 'Mercado', p_merchant => 'Supermercado');
select lujitos_tests.check(lujitos_tests.bal('caso2') = 850000, 'CASO 2: 1.000.000 − gasto 150.000 = 850.000');

-- ---------------------------------------------------------------------
-- CASO 3: transferencia entre cuentas propias
-- ---------------------------------------------------------------------
insert into lujitos_tests.ids select 'bancolombia',
  public.create_account(p_name => 'Bancolombia', p_account_type => 'savings', p_institution => 'bancolombia', p_initial_balance => 2000000);
insert into lujitos_tests.ids select 'nequi',
  public.create_account(p_name => 'Nequi', p_account_type => 'digital_wallet', p_institution => 'nequi', p_initial_balance => 500000);
select public.create_transaction('transfer', 200000, lujitos_tests.id('bancolombia'),
  p_destination_account_id => lujitos_tests.id('nequi'), p_description => 'Recarga Nequi');
select lujitos_tests.check(
  lujitos_tests.bal('bancolombia') = 1800000 and lujitos_tests.bal('nequi') = 700000,
  'CASO 3: Bancolombia 1.800.000 y Nequi 700.000');
select lujitos_tests.check(
  lujitos_tests.bal('bancolombia') + lujitos_tests.bal('nequi') = 2500000,
  'CASO 3: total consolidado 2.500.000 (la transferencia no se duplica)');

-- ---------------------------------------------------------------------
-- CASO 4: compra con tarjeta de crédito
-- ---------------------------------------------------------------------
insert into lujitos_tests.ids select 'tarjeta',
  public.create_account(p_name => 'Visa Bancolombia', p_account_type => 'credit_card', p_institution => 'bancolombia',
                        p_initial_balance => -500000, p_credit_limit => 3000000,
                        p_statement_day => 15::smallint, p_payment_due_day => 30::smallint);
select public.create_transaction('expense', 200000, lujitos_tests.id('tarjeta'),
  p_category_id => lujitos_tests.cat('shopping'), p_description => 'Compra con tarjeta');
select lujitos_tests.check(lujitos_tests.bal('tarjeta') = -700000, 'CASO 4: deuda inicial 500.000 + compra 200.000 = deuda 700.000');
select lujitos_tests.check(
  (select (public.financial_summary() ->> 'credit_available')::bigint) = 2300000,
  'CASO 4: cupo disponible 3.000.000 − 700.000 = 2.300.000');

-- ---------------------------------------------------------------------
-- CASO 5: pago de tarjeta (transferencia, no es un gasto nuevo)
-- ---------------------------------------------------------------------
insert into lujitos_tests.ids select 'banco_pago',
  public.create_account(p_name => 'Corriente', p_account_type => 'checking', p_institution => 'davivienda', p_initial_balance => 1000000);
insert into lujitos_tests.nums select 'gastos_antes', (public.financial_summary() ->> 'month_expense')::bigint;
select public.create_transaction('transfer', 200000, lujitos_tests.id('banco_pago'),
  p_destination_account_id => lujitos_tests.id('tarjeta'), p_description => 'Pago tarjeta');
select lujitos_tests.check(
  lujitos_tests.bal('banco_pago') = 800000 and lujitos_tests.bal('tarjeta') = -500000,
  'CASO 5: banco 800.000 y deuda de la tarjeta 500.000');
select lujitos_tests.check(
  (public.financial_summary() ->> 'month_expense')::bigint = (select v from lujitos_tests.nums where k = 'gastos_antes'),
  'CASO 5: el pago de la tarjeta no suma como gasto de consumo');

-- ---------------------------------------------------------------------
-- CASO 6: edición de un gasto
-- ---------------------------------------------------------------------
insert into lujitos_tests.ids select 'gasto6',
  public.create_transaction('expense', 100000, lujitos_tests.id('caso2'), p_category_id => lujitos_tests.cat('transport'),
                            p_description => 'Taxi');
select lujitos_tests.check(lujitos_tests.bal('caso2') = 750000, 'CASO 6: antes de editar, 850.000 − 100.000 = 750.000');
select public.update_transaction(lujitos_tests.id('gasto6'), 60000, lujitos_tests.id('caso2'),
  p_category_id => lujitos_tests.cat('transport'), p_description => 'Taxi (corregido)');
select lujitos_tests.check(lujitos_tests.bal('caso2') = 790000, 'CASO 6: al cambiar 100.000 por 60.000 el saldo queda 790.000');

-- ---------------------------------------------------------------------
-- CASO 7: anulación de una transferencia
-- ---------------------------------------------------------------------
insert into lujitos_tests.ids select 'trans7',
  public.create_transaction('transfer', 300000, lujitos_tests.id('bancolombia'),
                            p_destination_account_id => lujitos_tests.id('nequi'), p_description => 'Ahorro');
select lujitos_tests.check(
  lujitos_tests.bal('bancolombia') = 1500000 and lujitos_tests.bal('nequi') = 1000000,
  'CASO 7: con la transferencia, 1.500.000 y 1.000.000');
select public.void_transaction(lujitos_tests.id('trans7'), 'Me equivoqué de cuenta');
select lujitos_tests.check(
  lujitos_tests.bal('bancolombia') = 1800000 and lujitos_tests.bal('nequi') = 700000,
  'CASO 7: al anularla se restauran las dos cuentas');
select lujitos_tests.check(
  (select deleted_at is not null and void_reason = 'Me equivoqué de cuenta' from public.transactions where id = lujitos_tests.id('trans7')),
  'CASO 7: el movimiento anulado se conserva con su motivo');
select public.void_transaction(lujitos_tests.id('trans7'), 'Repetido');
select lujitos_tests.check(
  (select void_reason = 'Me equivoqué de cuenta' from public.transactions where id = lujitos_tests.id('trans7')),
  'Anular dos veces no cambia nada');
do $$
begin
  perform public.update_transaction(lujitos_tests.id('trans7'), 1000, lujitos_tests.id('bancolombia'),
    p_destination_account_id => lujitos_tests.id('nequi'));
  raise exception 'PRUEBA FALLIDA: se editó un movimiento anulado';
exception when sqlstate 'LJ008' then raise notice 'ok - Un movimiento anulado no se edita';
end $$;

-- ---------------------------------------------------------------------
-- Resumen financiero (calculado en PostgreSQL)
-- ---------------------------------------------------------------------
insert into lujitos_tests.ids select 'cdt',
  public.create_account(p_name => 'CDT 90 días', p_account_type => 'cdt', p_institution => 'bogota', p_initial_balance => 2000000);
select lujitos_tests.check((public.financial_summary() ->> 'banks')::bigint = 3800000, 'Resumen: bancos 3.800.000');
select lujitos_tests.check((public.financial_summary() ->> 'wallets')::bigint = 700000, 'Resumen: billeteras 700.000');
select lujitos_tests.check((public.financial_summary() ->> 'cash')::bigint = 790000, 'Resumen: efectivo 790.000');
select lujitos_tests.check((public.financial_summary() ->> 'available')::bigint = 5290000, 'Resumen: dinero disponible 5.290.000');
select lujitos_tests.check((public.financial_summary() ->> 'invested')::bigint = 2000000, 'Resumen: invertido 2.000.000 (CDT, no disponible)');
select lujitos_tests.check((public.financial_summary() ->> 'card_debt')::bigint = 500000, 'Resumen: deuda en tarjetas 500.000');
select lujitos_tests.check((public.financial_summary() ->> 'credit_limit')::bigint = 3000000, 'Resumen: cupo total 3.000.000');
select lujitos_tests.check(
  (public.financial_summary() ->> 'net_worth')::bigint = 6790000,
  'Resumen: patrimonio neto 6.790.000 = disponible + invertido − deuda (sin sumar el cupo)');
select lujitos_tests.check(
  (public.financial_summary() ->> 'month_income')::bigint = 200000
  and (public.financial_summary() ->> 'month_expense')::bigint = 410000,
  'Resumen: ingresos 200.000 y gastos 410.000 del mes (sin transferencias, pagos ni anulados)');

-- ---------------------------------------------------------------------
-- Saldo insuficiente, cupo y transferencia repetida (se pueden confirmar)
-- ---------------------------------------------------------------------
do $$
declare v_detail text;
begin
  perform public.create_transaction('expense', 1000000, lujitos_tests.id('caso2'), p_category_id => lujitos_tests.cat('food'));
  raise exception 'PRUEBA FALLIDA: gasto mayor al saldo sin advertencia';
exception when sqlstate 'LJ001' then
  get stacked diagnostics v_detail = pg_exception_detail;
  perform lujitos_tests.check(v_detail = '-210000', 'Un gasto mayor al saldo pide confirmación e informa el saldo resultante (−210.000)');
end $$;
select public.create_transaction('expense', 1000000, lujitos_tests.id('caso2'),
  p_category_id => lujitos_tests.cat('food'), p_allow_negative => true);
select lujitos_tests.check(lujitos_tests.bal('caso2') = -210000, 'Con la confirmación del usuario se registra el saldo negativo');

do $$
begin
  perform public.create_transaction('expense', 2600000, lujitos_tests.id('tarjeta'), p_category_id => lujitos_tests.cat('travel'));
  raise exception 'PRUEBA FALLIDA: compra por encima del cupo sin advertencia';
exception when sqlstate 'LJ002' then raise notice 'ok - Una compra que supera el cupo pide confirmación';
end $$;

select public.create_transaction('transfer', 50000, lujitos_tests.id('bancolombia'), p_destination_account_id => lujitos_tests.id('nequi'));
do $$
begin
  perform public.create_transaction('transfer', 50000, lujitos_tests.id('bancolombia'), p_destination_account_id => lujitos_tests.id('nequi'));
  raise exception 'PRUEBA FALLIDA: transferencia repetida sin advertencia';
exception when sqlstate 'LJ003' then raise notice 'ok - La misma transferencia repetida en segundos pide confirmación';
end $$;

-- ---------------------------------------------------------------------
-- Idempotencia: la misma solicitud enviada dos veces crea un solo movimiento
-- ---------------------------------------------------------------------
insert into lujitos_tests.ids values ('solicitud', 'cccccccc-0000-4000-8000-000000000001');
insert into lujitos_tests.ids select 'idem1',
  public.create_transaction('expense', 10000, lujitos_tests.id('bancolombia'), p_category_id => lujitos_tests.cat('food'),
                            p_request_id => lujitos_tests.id('solicitud'));
insert into lujitos_tests.ids select 'idem2',
  public.create_transaction('expense', 10000, lujitos_tests.id('bancolombia'), p_category_id => lujitos_tests.cat('food'),
                            p_request_id => lujitos_tests.id('solicitud'));
select lujitos_tests.check(
  lujitos_tests.id('idem1') = lujitos_tests.id('idem2')
  and (select count(*) from public.transactions where client_request_id = lujitos_tests.id('solicitud')) = 1,
  'Una solicitud repetida (doble toque o reintento) no duplica el movimiento');

-- ---------------------------------------------------------------------
-- Validaciones del servidor (no se confía en la app)
-- ---------------------------------------------------------------------
do $$
begin
  perform public.create_transaction('expense', 0, lujitos_tests.id('bancolombia'), p_category_id => lujitos_tests.cat('food'));
  raise exception 'PRUEBA FALLIDA: monto cero';
exception when sqlstate 'LJ007' then raise notice 'ok - El servidor rechaza montos en cero o negativos';
end $$;
do $$
begin
  perform public.create_transaction('transfer', 1000, lujitos_tests.id('bancolombia'), p_destination_account_id => lujitos_tests.id('bancolombia'));
  raise exception 'PRUEBA FALLIDA: transferencia a la misma cuenta';
exception when sqlstate 'LJ007' then raise notice 'ok - Origen y destino deben ser distintos';
end $$;
do $$
begin
  perform public.create_transaction('expense', 1000, lujitos_tests.id('bancolombia'), p_category_id => lujitos_tests.cat('food'),
    p_transaction_date => (now() at time zone 'America/Bogota')::date + 3);
  raise exception 'PRUEBA FALLIDA: fecha futura';
exception when sqlstate 'LJ007' then raise notice 'ok - No se registran movimientos con fecha futura';
end $$;
do $$
begin
  perform public.create_transaction('income', 1000, lujitos_tests.id('bancolombia'), p_category_id => lujitos_tests.cat('food'));
  raise exception 'PRUEBA FALLIDA: ingreso con categoría de gasto';
exception when check_violation then raise notice 'ok - La categoría debe corresponder al tipo';
end $$;
do $$
begin
  perform public.create_transaction('adjustment', 1000, lujitos_tests.id('bancolombia'));
  raise exception 'PRUEBA FALLIDA: ajuste sin pasar por «Ajustar saldo»';
exception when sqlstate 'LJ007' then raise notice 'ok - Los ajustes solo se registran con «Ajustar saldo»';
end $$;

-- ---------------------------------------------------------------------
-- Ajuste de saldo (conciliación)
-- ---------------------------------------------------------------------
do $$
begin
  perform public.reconcile_account(lujitos_tests.id('bancolombia'), 1000, 'Prueba', p_expected_balance => 1);
  raise exception 'PRUEBA FALLIDA: ajuste con un saldo esperado viejo';
exception when sqlstate 'LJ005' then raise notice 'ok - Si el saldo cambió mientras se ajustaba, se pide revisar de nuevo';
end $$;
do $$
begin
  perform public.reconcile_account(lujitos_tests.id('bancolombia'), 1000, '   ');
  raise exception 'PRUEBA FALLIDA: ajuste sin motivo';
exception when sqlstate 'LJ007' then raise notice 'ok - El ajuste exige un motivo';
end $$;
insert into lujitos_tests.nums select 'antes_ajuste', lujitos_tests.bal('bancolombia');
select lujitos_tests.check(
  (public.reconcile_account(lujitos_tests.id('bancolombia'), (select v from lujitos_tests.nums where k = 'antes_ajuste') - 12345,
     'Comisión bancaria no registrada', p_expected_balance => (select v from lujitos_tests.nums where k = 'antes_ajuste')) ->> 'difference')::bigint = -12345,
  'Ajuste: compara el saldo real con el calculado y devuelve la diferencia (−12.345)');
select lujitos_tests.check(
  lujitos_tests.bal('bancolombia') = (select v from lujitos_tests.nums where k = 'antes_ajuste') - 12345,
  'Ajuste: el saldo queda igual al saldo real observado');
select lujitos_tests.check(
  (select count(*) from public.transactions
    where type = 'adjustment' and account_id = lujitos_tests.id('bancolombia')
      and amount = 12345 and adjustment_sign = -1 and notes = 'Comisión bancaria no registrada') = 1,
  'Ajuste: queda un movimiento de ajuste con el motivo (el historial no se toca)');
select lujitos_tests.check(
  (public.reconcile_account(lujitos_tests.id('bancolombia'), lujitos_tests.bal('bancolombia'), 'Sin diferencia') ->> 'transaction_id') is null,
  'Ajuste: si no hay diferencia no se crea ningún movimiento');
do $$
begin
  perform public.update_transaction(
    (select id from public.transactions where type = 'adjustment' and account_id = lujitos_tests.id('bancolombia') limit 1),
    1, lujitos_tests.id('bancolombia'));
  raise exception 'PRUEBA FALLIDA: se editó un ajuste';
exception when sqlstate 'LJ007' then raise notice 'ok - Un ajuste no se edita (se anula y se vuelve a ajustar)';
end $$;

-- Tarjeta: ajustar a la deuda real (saldo = −deuda)
select public.reconcile_account(lujitos_tests.id('tarjeta'), -520000, 'Intereses del mes');
select lujitos_tests.check(lujitos_tests.bal('tarjeta') = -520000, 'Ajuste de tarjeta: la deuda queda en la deuda real (520.000)');

-- ---------------------------------------------------------------------
-- Reglas de las cuentas
-- ---------------------------------------------------------------------
do $$
begin
  perform public.update_account(lujitos_tests.id('caso1'), 'Ahorros nómina', 'savings', 'bancolombia', null,
    5000000, null, null, null, null, null, null, null);
  raise exception 'PRUEBA FALLIDA: se cambió el saldo inicial de una cuenta con movimientos';
exception when sqlstate 'LJ007' then raise notice 'ok - El saldo inicial no cambia si ya hay movimientos (historial intacto)';
end $$;
insert into lujitos_tests.ids select 'nueva',
  public.create_account(p_name => 'Billetera', p_account_type => 'other', p_institution => 'custom',
                        p_institution_name => 'Cooperativa del barrio', p_initial_balance => 100);
select public.update_account(lujitos_tests.id('nueva'), 'Billetera', 'other', 'custom', 'Cooperativa del barrio',
  200, null, null, 'gold', 'wallet.pass.fill', 'Ahorro del barrio', null, null);
select lujitos_tests.check(
  lujitos_tests.bal('nueva') = 200
  and (select institution_name = 'Cooperativa del barrio' and description = 'Ahorro del barrio' from public.accounts where id = lujitos_tests.id('nueva')),
  'Una cuenta sin movimientos sí puede corregir su saldo inicial; entidad y descripción personalizadas');
do $$
begin
  perform public.create_account(p_name => 'Sin entidad', p_account_type => 'other');
  raise exception 'PRUEBA FALLIDA: cuenta personalizada sin entidad';
exception when sqlstate 'LJ007' then raise notice 'ok - Una entidad personalizada necesita nombre';
end $$;
do $$
begin
  perform public.create_account(p_name => 'Negativa', p_account_type => 'cash', p_institution => 'cash', p_initial_balance => -1);
  raise exception 'PRUEBA FALLIDA: saldo inicial negativo';
exception when sqlstate 'LJ007' then raise notice 'ok - El saldo inicial de una cuenta de dinero es cero o positivo';
end $$;
do $$
begin
  perform public.create_account(p_name => 'Tarjeta sin cupo', p_account_type => 'credit_card', p_institution => 'bbva');
  raise exception 'PRUEBA FALLIDA: tarjeta sin cupo';
exception when sqlstate 'LJ007' then raise notice 'ok - Una tarjeta necesita su cupo total';
end $$;
do $$
begin
  perform public.update_account(lujitos_tests.id('tarjeta'), 'Visa', 'savings', 'bancolombia', null,
    0, null, null, null, null, null, null, null);
  raise exception 'PRUEBA FALLIDA: tarjeta con movimientos convertida en ahorros';
exception when sqlstate 'LJ007' then raise notice 'ok - Una tarjeta con movimientos no cambia de naturaleza';
end $$;

do $$
declare v_detail text;
begin
  perform public.archive_account(lujitos_tests.id('nequi'));
  raise exception 'PRUEBA FALLIDA: se archivó una cuenta con saldo sin advertir';
exception when sqlstate 'LJ004' then
  get stacked diagnostics v_detail = pg_exception_detail;
  perform lujitos_tests.check(v_detail::bigint = lujitos_tests.bal('nequi'), 'Archivar una cuenta con saldo advierte cuánto tiene');
end $$;
select public.archive_account(lujitos_tests.id('cdt'), true);
select lujitos_tests.check(
  (public.financial_summary() ->> 'invested')::bigint = 0
  and lujitos_tests.bal('cdt') = 2000000,
  'Una cuenta archivada deja de sumar en los totales pero conserva su saldo e historial');
select public.restore_account(lujitos_tests.id('cdt'));
select lujitos_tests.check((public.financial_summary() ->> 'invested')::bigint = 2000000, 'Reactivar una cuenta la vuelve a sumar');

-- Idempotencia al crear cuentas
insert into lujitos_tests.ids values ('solicitud_cuenta', 'cccccccc-0000-4000-8000-000000000002');
select public.create_account(p_name => 'Doble', p_account_type => 'cash', p_institution => 'cash', p_request_id => lujitos_tests.id('solicitud_cuenta'));
select public.create_account(p_name => 'Doble', p_account_type => 'cash', p_institution => 'cash', p_request_id => lujitos_tests.id('solicitud_cuenta'));
select lujitos_tests.check((select count(*) from public.accounts where name = 'Doble') = 1, 'Crear la misma cuenta dos veces (reintento) no la duplica');

-- ---------------------------------------------------------------------
-- Categorías: archivar y reasignar antes de borrar
-- ---------------------------------------------------------------------
with c as (
  insert into public.categories (user_id, name, type, icon, color)
  values ('33333333-3333-4333-8333-333333333333', 'Mascotas', 'expense', 'pawprint.fill', 'amber') returning id
) insert into lujitos_tests.ids select 'mascotas', id from c;
insert into lujitos_tests.ids select 'gasto_mascota',
  public.create_transaction('expense', 30000, lujitos_tests.id('bancolombia'), p_category_id => lujitos_tests.id('mascotas'));
do $$
begin
  perform public.delete_category(lujitos_tests.id('mascotas'));
  raise exception 'PRUEBA FALLIDA: se borró una categoría con movimientos';
exception when sqlstate 'LJ009' then raise notice 'ok - Una categoría con movimientos no se borra sin reasignarlos';
end $$;
select public.delete_category(lujitos_tests.id('mascotas'), lujitos_tests.cat('other-out'));
select lujitos_tests.check(
  (select category_id = lujitos_tests.cat('other-out') from public.transactions where id = lujitos_tests.id('gasto_mascota'))
  and not exists (select 1 from public.categories where id = lujitos_tests.id('mascotas')),
  'Al borrar una categoría sus movimientos pasan a la elegida');
with c as (
  insert into public.categories (user_id, name, type, icon, color)
  values ('33333333-3333-4333-8333-333333333333', 'Vieja', 'expense', 'archivebox.fill', 'stone') returning id
) insert into lujitos_tests.ids select 'vieja', id from c;
update public.categories set archived_at = now() where id = lujitos_tests.id('vieja');
do $$
begin
  perform public.create_transaction('expense', 1000, lujitos_tests.id('bancolombia'), p_category_id => lujitos_tests.id('vieja'));
  raise exception 'PRUEBA FALLIDA: movimiento nuevo con categoría archivada';
exception when check_violation then raise notice 'ok - Una categoría archivada no se ofrece para movimientos nuevos';
end $$;
do $$
begin
  update public.categories set archived_at = now() where slug = 'food';
  if found then
    raise exception 'PRUEBA FALLIDA: se archivó una categoría del sistema';
  end if;
  raise notice 'ok - Las categorías del sistema no se archivan';
end $$;

-- ---------------------------------------------------------------------
-- Historial del saldo (gráfico)
-- ---------------------------------------------------------------------
select lujitos_tests.check(
  (select count(*) from public.account_balance_history(lujitos_tests.id('caso1'),
     (now() at time zone 'America/Bogota')::date - 6, (now() at time zone 'America/Bogota')::date)) = 7,
  'Historial: un punto por día del rango (7 días)');
select lujitos_tests.check(
  (select balance from public.account_balance_history(lujitos_tests.id('caso1'),
     (now() at time zone 'America/Bogota')::date - 6, (now() at time zone 'America/Bogota')::date)
   order by day desc limit 1) = lujitos_tests.bal('caso1'),
  'Historial: el último punto es el saldo actual');

-- ---------------------------------------------------------------------
-- CASO 8: seguridad entre usuarios (D intenta tocar el dinero de C)
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}', true);
select lujitos_tests.check((select count(*) from public.accounts) = 0, 'CASO 8: D no ve las cuentas de C');
select lujitos_tests.check((select count(*) from public.transactions) = 0, 'CASO 8: D no ve los movimientos de C');
select lujitos_tests.check((public.financial_summary() ->> 'accounts')::int = 0, 'CASO 8: el resumen de D no incluye nada de C');
select lujitos_tests.check(
  (select count(*) from public.account_balance_history(lujitos_tests.id('caso1'), current_date - 3, current_date)) = 0,
  'CASO 8: D no puede ver el historial de una cuenta de C');
do $$
begin
  perform public.create_transaction('expense', 1000, lujitos_tests.id('caso1'), p_category_id => lujitos_tests.cat('food'));
  raise exception 'PRUEBA FALLIDA: D gastó desde la cuenta de C';
exception when sqlstate 'LJ006' then raise notice 'ok - CASO 8: D no puede registrar movimientos en cuentas de C';
end $$;
insert into lujitos_tests.ids select 'cuenta_d',
  public.create_account(p_name => 'Cuenta D', p_account_type => 'savings', p_institution => 'bbva', p_initial_balance => 100000);
do $$
begin
  perform public.create_transaction('transfer', 1000, lujitos_tests.id('caso1'), p_destination_account_id => lujitos_tests.id('cuenta_d'));
  raise exception 'PRUEBA FALLIDA: D sacó dinero de la cuenta de C';
exception when sqlstate 'LJ006' then raise notice 'ok - CASO 8: D no puede transferir dinero desde cuentas de C';
end $$;
do $$
begin
  perform public.create_transaction('transfer', 1000, lujitos_tests.id('cuenta_d'), p_destination_account_id => lujitos_tests.id('caso1'));
  raise exception 'PRUEBA FALLIDA: D transfirió a la cuenta de C';
exception when sqlstate 'LJ006' then raise notice 'ok - CASO 8: D no puede transferir hacia cuentas de C';
end $$;
do $$
begin
  perform public.update_transaction(lujitos_tests.id('gasto6'), 1, lujitos_tests.id('cuenta_d'), p_category_id => lujitos_tests.cat('food'));
  raise exception 'PRUEBA FALLIDA: D editó un movimiento de C';
exception when sqlstate 'LJ006' then raise notice 'ok - CASO 8: D no puede editar movimientos de C';
end $$;
do $$
begin
  perform public.void_transaction(lujitos_tests.id('gasto6'));
  raise exception 'PRUEBA FALLIDA: D anuló un movimiento de C';
exception when sqlstate 'LJ006' then raise notice 'ok - CASO 8: D no puede anular movimientos de C';
end $$;
do $$
begin
  perform public.reconcile_account(lujitos_tests.id('caso1'), 0, 'Intruso');
  raise exception 'PRUEBA FALLIDA: D ajustó el saldo de C';
exception when sqlstate 'LJ006' then raise notice 'ok - CASO 8: D no puede ajustar el saldo de C';
end $$;
do $$
begin
  perform public.restore_account(lujitos_tests.id('caso1'));
  raise exception 'PRUEBA FALLIDA: D tocó una cuenta de C';
exception when sqlstate 'LJ006' then raise notice 'ok - CASO 8: D no puede archivar ni reactivar cuentas de C';
end $$;

reset role;
select lujitos_tests.check(
  lujitos_tests.bal('caso1') = 1200000 and lujitos_tests.bal('bancolombia') > 0,
  'CASO 8: los saldos de C siguen intactos tras los intentos de D');

-- Sin sesión no se ejecuta ninguna operación
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
do $$
begin
  perform public.create_transaction('expense', 1000, '33333333-3333-4333-8333-333333333333', p_category_id => null);
  raise exception 'PRUEBA FALLIDA: un visitante ejecutó una operación';
exception when insufficient_privilege then raise notice 'ok - Sin sesión no se pueden ejecutar las operaciones financieras';
end $$;
reset role;

select 'TODAS LAS PRUEBAS DEL MOTOR FINANCIERO PASARON' as resultado;
rollback;
