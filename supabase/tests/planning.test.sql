-- =====================================================================
-- LUJITOS · Fase 5 · Pruebas de presupuestos, metas, deudas y planificación
--
-- Los escenarios obligatorios del brief (presupuesto 500.000, meta 8.000.000,
-- deuda 5.000.000, patrimonio 10M − 3M, tarjeta 3M) y además: avisos sin
-- repetir, umbrales configurables, edición y anulación que recalculan,
-- archivar, revertir, idempotencia, sobrepago, metas vencidas o superadas,
-- capacidad de ahorro, aislamiento entre usuarios y auditoría.
-- Todo dentro de una transacción que termina en ROLLBACK: no deja nada.
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
create table lujitos_tests.nums (k text primary key, v numeric);
create function lujitos_tests.id(p_key text) returns uuid
language sql stable as $$ select v from lujitos_tests.ids where k = p_key $$;
create function lujitos_tests.num(p_key text) returns numeric
language sql stable as $$ select v from lujitos_tests.nums where k = p_key $$;
create function lujitos_tests.bal(p_key text) returns bigint
language sql stable as $$
  select b.balance from public.account_balances b join lujitos_tests.ids i on i.v = b.account_id where i.k = p_key
$$;
create function lujitos_tests.cat(p_slug text) returns uuid
language sql stable as $$ select id from public.categories where slug = p_slug and user_id is null $$;
create function lujitos_tests.today() returns date
language sql stable as $$ select (now() at time zone 'America/Bogota')::date $$;
create function lujitos_tests.summary(p_key text) returns numeric
language sql stable as $$ select (public.financial_summary() ->> p_key)::numeric $$;
create function lujitos_tests.plan(p_key text) returns text
language sql stable as $$ select public.planning_snapshot() ->> p_key $$;
create function lujitos_tests.budget(p_key text) returns public.budget_status
language sql stable as $$ select * from public.budget_status where budget_id = lujitos_tests.id(p_key) $$;
create function lujitos_tests.goal(p_key text) returns public.savings_goal_progress
language sql stable as $$ select * from public.savings_goal_progress where goal_id = lujitos_tests.id(p_key) $$;
create function lujitos_tests.debt(p_key text) returns public.debt_overview
language sql stable as $$ select * from public.debt_overview where debt_id = lujitos_tests.id(p_key) $$;
create function lujitos_tests.alerts(p_key text, p_kind text, p_threshold integer) returns bigint
language sql stable as $$
  select count(*) from public.budget_alerts
   where budget_id = lujitos_tests.id(p_key) and kind = p_kind and threshold = p_threshold
$$;
grant usage on schema lujitos_tests to authenticated, anon;
grant all on lujitos_tests.ids, lujitos_tests.nums to authenticated;
grant execute on all functions in schema lujitos_tests to authenticated, anon;

insert into auth.users (id, email, raw_user_meta_data) values
  ('55555555-5555-4555-8555-555555555555', 'usuario.e@lujitos.test', '{"first_name": "Elena"}'),
  ('66666666-6666-4666-8666-666666666666', 'usuario.f@lujitos.test', '{"first_name": "Fabio"}');

select set_config('request.jwt.claims', '{"sub": "55555555-5555-4555-8555-555555555555", "role": "authenticated"}', true);
set local role authenticated;

insert into lujitos_tests.ids select 'banco',
  public.create_account(p_name => 'Bancolombia', p_account_type => 'savings', p_institution => 'bancolombia',
                        p_initial_balance => 5000000);
insert into lujitos_tests.ids select 'nequi',
  public.create_account(p_name => 'Nequi', p_account_type => 'digital_wallet', p_institution => 'nequi');
insert into lujitos_tests.ids select 'tarjeta',
  public.create_account(p_name => 'Visa', p_account_type => 'credit_card', p_institution => 'bancolombia',
                        p_initial_balance => -500000, p_credit_limit => 3000000);

-- =====================================================================
-- PRESUPUESTOS
-- =====================================================================
insert into lujitos_tests.ids select 'comida', public.create_budget(lujitos_tests.cat('food'), 500000, 'monthly');
select public.create_transaction('expense', 100000, lujitos_tests.id('banco'),
  p_category_id => lujitos_tests.cat('food'), p_description => 'Mercado');
insert into lujitos_tests.ids select 'gasto150', public.create_transaction('expense', 150000, lujitos_tests.id('banco'),
  p_category_id => lujitos_tests.cat('food'), p_description => 'Restaurante');
select lujitos_tests.check(
  (lujitos_tests.budget('comida')).spent = 250000
  and (lujitos_tests.budget('comida')).available = 250000
  and (lujitos_tests.budget('comida')).percent_used = 50,
  'PRESUPUESTO: límite 500.000 con gastos de 100.000 + 150.000 → gastado 250.000, disponible 250.000, 50 %');

select public.create_transaction('transfer', 300000, lujitos_tests.id('banco'), p_destination_account_id => lujitos_tests.id('nequi'));
select lujitos_tests.check((lujitos_tests.budget('comida')).spent = 250000,
  'PRESUPUESTO: una transferencia entre cuentas propias no lo afecta');

select public.create_transaction('income', 1000000, lujitos_tests.id('banco'), p_category_id => lujitos_tests.cat('salary'));
select lujitos_tests.check((lujitos_tests.budget('comida')).spent = 250000, 'PRESUPUESTO: un ingreso no lo afecta');

insert into lujitos_tests.ids select 'compra_tarjeta', public.create_transaction('expense', 50000, lujitos_tests.id('tarjeta'),
  p_category_id => lujitos_tests.cat('food'), p_description => 'Domicilio');
select lujitos_tests.check((lujitos_tests.budget('comida')).spent = 300000,
  'PRESUPUESTO: una compra con tarjeta sí es gasto real (300.000)');
select public.create_transaction('transfer', 50000, lujitos_tests.id('banco'), p_destination_account_id => lujitos_tests.id('tarjeta'));
select lujitos_tests.check((lujitos_tests.budget('comida')).spent = 300000,
  'PRESUPUESTO: el pago de la tarjeta no se cuenta otra vez');

select public.void_transaction(lujitos_tests.id('compra_tarjeta'), 'Prueba');
select lujitos_tests.check((lujitos_tests.budget('comida')).spent = 250000,
  'PRESUPUESTO: anular un gasto lo saca del cálculo');

select public.create_transaction('expense', 70000, lujitos_tests.id('banco'), p_category_id => lujitos_tests.cat('transport'));
select lujitos_tests.check((lujitos_tests.budget('comida')).spent = 250000,
  'PRESUPUESTO: un gasto de otra categoría no cuenta');

select lujitos_tests.check(
  lujitos_tests.alerts('comida', 'threshold', 50) = 1 and lujitos_tests.alerts('comida', 'threshold', 75) = 0,
  'AVISOS: al llegar al 50 % queda un aviso de 50 % y ninguno de 75 %');

select public.update_transaction(lujitos_tests.id('gasto150'), 300000, lujitos_tests.id('banco'),
  p_category_id => lujitos_tests.cat('food'), p_description => 'Restaurante');
select lujitos_tests.check(
  (lujitos_tests.budget('comida')).spent = 400000 and (lujitos_tests.budget('comida')).percent_used = 80,
  'PRESUPUESTO: editar un gasto recalcula (100.000 + 300.000 = 400.000, 80 %)');
select lujitos_tests.check(
  lujitos_tests.alerts('comida', 'threshold', 75) = 1 and lujitos_tests.alerts('comida', 'threshold', 50) = 1,
  'AVISOS: aparece el de 75 % y el de 50 % no se repite');

select public.create_transaction('expense', 150000, lujitos_tests.id('banco'), p_category_id => lujitos_tests.cat('food'));
select lujitos_tests.check(
  (lujitos_tests.budget('comida')).spent = 550000
  and (lujitos_tests.budget('comida')).available = -50000
  and (lujitos_tests.budget('comida')).status = 'exceeded',
  'PRESUPUESTO: al superarlo el disponible queda en −50.000 y el estado es «superado»');
select lujitos_tests.check(
  lujitos_tests.alerts('comida', 'threshold', 90) = 1 and lujitos_tests.alerts('comida', 'threshold', 100) = 1
  and lujitos_tests.alerts('comida', 'exceeded', 100) = 1,
  'AVISOS: 90 %, 100 % y «superado», una vez cada uno');
select public.create_transaction('expense', 10000, lujitos_tests.id('banco'), p_category_id => lujitos_tests.cat('food'));
select lujitos_tests.check(
  (select count(*) from public.budget_alerts where budget_id = lujitos_tests.id('comida')) = 5,
  'AVISOS: más gastos en el mismo período no repiten avisos');

-- Presupuesto general desde el mes pasado (para ver el historial)
insert into lujitos_tests.ids select 'general', public.create_budget(null, 2000000, 'monthly',
  p_start_date => (date_trunc('month', lujitos_tests.today()::timestamp) - interval '1 month')::date);
select lujitos_tests.check((lujitos_tests.budget('general')).spent = 630000,
  'PRESUPUESTO GENERAL: suma todos los gastos reales no anulados del mes (630.000)');
select public.create_transaction('expense', 80000, lujitos_tests.id('banco'), p_category_id => lujitos_tests.cat('food'),
  p_transaction_date => (date_trunc('month', lujitos_tests.today()::timestamp) - interval '1 day')::date);
select lujitos_tests.check(
  (lujitos_tests.budget('general')).previous_spent = 80000 and (lujitos_tests.budget('general')).spent = 630000,
  'PRESUPUESTO GENERAL: comparación con el mes anterior (80.000) sin mezclar meses');
select lujitos_tests.check(
  (select count(*) from public.budget_history(lujitos_tests.id('general'), 6)) = 2
  and (select h.spent from public.budget_history(lujitos_tests.id('general'), 6) h order by h.period_start limit 1) = 80000
  and (select h.spent from public.budget_history(lujitos_tests.id('general'), 6) h order by h.period_start desc limit 1) = 630000,
  'HISTORIAL: un período por mes desde el inicio del presupuesto (80.000 y 630.000)');
select lujitos_tests.check(
  (select count(*) from public.budget_alerts where budget_id = lujitos_tests.id('comida')) = 5,
  'AVISOS: un gasto de un mes anterior no genera avisos del mes actual');

do $$
begin
  perform public.create_budget(lujitos_tests.cat('food'), 100000, 'monthly');
  raise exception 'PRUEBA FALLIDA: se crearon dos presupuestos activos iguales';
exception when sqlstate 'LJ012' then raise notice 'ok - PRESUPUESTO: no se crean dos presupuestos activos iguales';
end $$;
do $$
begin
  perform public.create_budget(lujitos_tests.cat('salary'), 100000, 'monthly');
  raise exception 'PRUEBA FALLIDA: presupuesto con categoría de ingreso';
exception when sqlstate 'LJ007' then raise notice 'ok - PRESUPUESTO: solo usa categorías de gasto';
end $$;
do $$
begin
  perform public.create_budget(null, 0, 'monthly');
  raise exception 'PRUEBA FALLIDA: presupuesto con límite 0';
exception when sqlstate 'LJ007' then raise notice 'ok - PRESUPUESTO: el límite debe ser mayor que cero';
end $$;

-- Umbrales configurables, archivar, reactivar y borrar
insert into lujitos_tests.ids select 'transporte',
  public.create_budget(lujitos_tests.cat('transport'), 100000, 'monthly', p_alert_thresholds => array[80]);
select lujitos_tests.check(
  (select count(*) from public.budget_alerts where budget_id = lujitos_tests.id('transporte')) = 0,
  'AVISOS: con 70 % gastado y el aviso en 80 % todavía no hay aviso');
select public.create_transaction('expense', 15000, lujitos_tests.id('banco'), p_category_id => lujitos_tests.cat('transport'));
select lujitos_tests.check(
  lujitos_tests.alerts('transporte', 'threshold', 80) = 1
  and (select count(*) from public.budget_alerts where budget_id = lujitos_tests.id('transporte')) = 1,
  'AVISOS: umbrales configurables (solo se avisa en el 80 % elegido)');

select public.archive_budget(lujitos_tests.id('transporte'));
select lujitos_tests.check((lujitos_tests.budget('transporte')).status = 'archived', 'PRESUPUESTO: archivar');
select public.create_transaction('expense', 50000, lujitos_tests.id('banco'), p_category_id => lujitos_tests.cat('transport'));
select lujitos_tests.check(
  (select count(*) from public.budget_alerts where budget_id = lujitos_tests.id('transporte')) = 1,
  'AVISOS: un presupuesto archivado no avisa');
select public.archive_budget(lujitos_tests.id('transporte'), false);
select lujitos_tests.check(
  (lujitos_tests.budget('transporte')).status = 'exceeded' and (lujitos_tests.budget('transporte')).spent = 135000
  and lujitos_tests.alerts('transporte', 'exceeded', 100) = 1,
  'PRESUPUESTO: al reactivarlo se recalcula (135.000, superado) y avisa');

insert into lujitos_tests.nums select 'movimientos', count(*) from public.transactions;
select public.delete_budget(lujitos_tests.id('transporte'));
select lujitos_tests.check(
  not exists (select 1 from public.budgets where id = lujitos_tests.id('transporte'))
  and (select count(*) from public.transactions) = lujitos_tests.num('movimientos'),
  'PRESUPUESTO: borrarlo no borra ningún movimiento');

update public.budget_alerts set seen_at = now() where budget_id = lujitos_tests.id('comida');
select lujitos_tests.check(
  (select count(*) from public.budget_alerts where budget_id = lujitos_tests.id('comida') and seen_at is not null) = 5,
  'AVISOS: la app marca como vistos los suyos');
do $$
begin
  update public.budget_alerts set spent = 0 where budget_id = lujitos_tests.id('comida');
  raise exception 'PRUEBA FALLIDA: la app cambió el valor de un aviso';
exception when insufficient_privilege then raise notice 'ok - AVISOS: la app solo puede marcarlos como vistos';
end $$;

-- =====================================================================
-- METAS DE AHORRO
-- =====================================================================
insert into lujitos_tests.ids select 'ahorros',
  public.create_account(p_name => 'Ahorro programado', p_account_type => 'savings', p_institution => 'davivienda');
insert into lujitos_tests.nums select 'patrimonio0', lujitos_tests.summary('net_worth');
insert into lujitos_tests.nums select 'banco0', lujitos_tests.bal('banco');

insert into lujitos_tests.ids select 'viaje',
  public.create_savings_goal('Viaje', 8000000, p_initial_saved => 2000000, p_target_date => lujitos_tests.today() + 300,
                             p_kind => 'travel');
select public.add_goal_movement(lujitos_tests.id('viaje'), 'contribution', 500000);
select lujitos_tests.check(
  (lujitos_tests.goal('viaje')).saved = 2500000
  and (lujitos_tests.goal('viaje')).remaining = 5500000
  and (lujitos_tests.goal('viaje')).percent = 31.25,
  'META: 8.000.000 con 2.000.000 iniciales + aporte de 500.000 → 2.500.000 ahorrados, faltan 5.500.000, 31,25 %');
select lujitos_tests.check(lujitos_tests.summary('net_worth') = lujitos_tests.num('patrimonio0'),
  'META: el aporte no crea dinero ni cambia el patrimonio');
select lujitos_tests.check((lujitos_tests.goal('viaje')).unassigned, 'META: sin cuenta queda marcada «sin cuenta asignada»');

insert into lujitos_tests.ids select 'casa',
  public.create_savings_goal('Casa', 1000000, p_account_id => lujitos_tests.id('ahorros'),
                             p_target_date => lujitos_tests.today() + 60, p_kind => 'home');
insert into lujitos_tests.ids select 'aporte_casa',
  public.add_goal_movement(lujitos_tests.id('casa'), 'contribution', 300000, p_account_id => lujitos_tests.id('banco'));
select lujitos_tests.check(
  lujitos_tests.bal('ahorros') = 300000 and lujitos_tests.bal('banco') = lujitos_tests.num('banco0') - 300000
  and lujitos_tests.summary('net_worth') = lujitos_tests.num('patrimonio0'),
  'META: aporte con dinero = transferencia a la cuenta de la meta; el patrimonio no cambia');
select lujitos_tests.check(
  (select t.purpose from public.transactions t join public.savings_goal_movements m on m.transaction_id = t.id
    where m.id = lujitos_tests.id('aporte_casa')) = 'goal_contribution'
  and (lujitos_tests.goal('casa')).account_balance = 300000 and (lujitos_tests.goal('casa')).account_allocated = 300000,
  'META: el aporte queda enlazado a su transferencia y a la cuenta');
select lujitos_tests.check(
  (lujitos_tests.goal('casa')).monthly_needed = 350000
  and (lujitos_tests.goal('casa')).weekly_needed = 77778
  and (lujitos_tests.goal('casa')).daily_needed = 11667,
  'META: faltan 700.000 en 60 días → 350.000 al mes, 77.778 a la semana, 11.667 al día');

do $$
begin
  perform public.add_goal_movement(lujitos_tests.id('casa'), 'withdrawal', 400000);
  raise exception 'PRUEBA FALLIDA: se retiró más de lo ahorrado';
exception when sqlstate 'LJ010' then raise notice 'ok - META: no se retira más de lo ahorrado';
end $$;
insert into lujitos_tests.ids select 'retiro_casa',
  public.add_goal_movement(lujitos_tests.id('casa'), 'withdrawal', 100000, p_account_id => lujitos_tests.id('banco'));
select lujitos_tests.check(
  (lujitos_tests.goal('casa')).saved = 200000 and lujitos_tests.bal('ahorros') = 200000,
  'META: retiro de 100.000 hacia Bancolombia (queda 200.000)');

select public.update_goal_movement(lujitos_tests.id('aporte_casa'), 400000);
select lujitos_tests.check(
  (lujitos_tests.goal('casa')).saved = 300000 and lujitos_tests.bal('ahorros') = 300000
  and lujitos_tests.bal('banco') = lujitos_tests.num('banco0') - 300000,
  'META: editar el aporte (300.000 → 400.000) actualiza la meta y su transferencia');

do $$
begin
  perform public.void_goal_movement(lujitos_tests.id('aporte_casa'));
  raise exception 'PRUEBA FALLIDA: la meta quedó en negativo';
exception when sqlstate 'LJ010' then raise notice 'ok - META: no se revierte un aporte si la meta quedaría en negativo';
end $$;
select public.void_goal_movement(lujitos_tests.id('retiro_casa'));
select public.void_goal_movement(lujitos_tests.id('aporte_casa'), 'Prueba');
select lujitos_tests.check(
  (lujitos_tests.goal('casa')).saved = 0 and lujitos_tests.bal('ahorros') = 0
  and lujitos_tests.bal('banco') = lujitos_tests.num('banco0')
  and (select t.deleted_at is not null from public.transactions t join public.savings_goal_movements m on m.transaction_id = t.id
        where m.id = lujitos_tests.id('aporte_casa')),
  'META: revertir devuelve el dinero a la cuenta de origen y conserva el registro');

insert into lujitos_tests.ids select 'aporte2',
  public.add_goal_movement(lujitos_tests.id('casa'), 'contribution', 250000, p_account_id => lujitos_tests.id('banco'));
select public.void_transaction(
  (select transaction_id from public.savings_goal_movements where id = lujitos_tests.id('aporte2')), 'Desde Movimientos');
select lujitos_tests.check(
  (select voided_at is not null from public.savings_goal_movements where id = lujitos_tests.id('aporte2'))
  and (lujitos_tests.goal('casa')).saved = 0,
  'META: anular la transferencia desde Movimientos también revierte el aporte');

insert into lujitos_tests.ids select 'solicitud', gen_random_uuid();
select public.add_goal_movement(lujitos_tests.id('viaje'), 'contribution', 100000, p_request_id => lujitos_tests.id('solicitud'));
select public.add_goal_movement(lujitos_tests.id('viaje'), 'contribution', 100000, p_request_id => lujitos_tests.id('solicitud'));
select lujitos_tests.check(
  (select count(*) from public.savings_goal_movements where client_request_id = lujitos_tests.id('solicitud')) = 1
  and (lujitos_tests.goal('viaje')).saved = 2600000,
  'META: un aporte enviado dos veces (misma solicitud) se guarda una sola vez');

insert into lujitos_tests.ids select 'moto', public.create_savings_goal('Moto', 1000000, p_initial_saved => 900000);
select public.add_goal_movement(lujitos_tests.id('moto'), 'contribution', 300000);
select lujitos_tests.check(
  (lujitos_tests.goal('moto')).saved = 1200000 and (lujitos_tests.goal('moto')).percent = 120
  and (lujitos_tests.goal('moto')).exceeded_by = 200000 and (lujitos_tests.goal('moto')).remaining = 0
  and (lujitos_tests.goal('moto')).status = 'completed',
  'META superada: 120 %, 200.000 por encima, faltan 0, estado «cumplida»');

insert into lujitos_tests.ids select 'curso',
  public.create_savings_goal('Curso', 2000000, p_start_date => '2025-01-01', p_target_date => '2025-06-01', p_kind => 'education');
select lujitos_tests.check(
  (lujitos_tests.goal('curso')).status = 'overdue' and (lujitos_tests.goal('curso')).monthly_needed is null
  and (lujitos_tests.goal('curso')).days_left < 0,
  'META vencida: estado «vencida» y sin recomendación negativa');
select public.update_savings_goal(lujitos_tests.id('curso'), 'Curso', 2000000, 0, lujitos_tests.today() + 90, '2025-01-01',
  'education', null, null, null, null);
select lujitos_tests.check(
  (lujitos_tests.goal('curso')).status = 'active' and (lujitos_tests.goal('curso')).monthly_needed = 666667,
  'META: al mover la fecha vuelve a recomendar (2.000.000 en 3 meses → 666.667 al mes)');

do $$
begin
  perform public.delete_savings_goal(lujitos_tests.id('viaje'));
  raise exception 'PRUEBA FALLIDA: se borró una meta con aportes';
exception when sqlstate 'LJ013' then raise notice 'ok - META: con aportes no se borra (se archiva)';
end $$;
select public.archive_savings_goal(lujitos_tests.id('viaje'));
select lujitos_tests.check((lujitos_tests.goal('viaje')).status = 'archived', 'META: archivar conserva el historial');
do $$
begin
  perform public.add_goal_movement(lujitos_tests.id('viaje'), 'contribution', 1000);
  raise exception 'PRUEBA FALLIDA: aporte a una meta archivada';
exception when sqlstate 'LJ006' then raise notice 'ok - META: una meta archivada no recibe aportes';
end $$;
select public.archive_savings_goal(lujitos_tests.id('viaje'), false);
select public.delete_savings_goal(lujitos_tests.id('curso'));
select lujitos_tests.check(
  not exists (select 1 from public.savings_goals where id = lujitos_tests.id('curso'))
  and (lujitos_tests.goal('viaje')).status = 'active',
  'META: reactivar, y borrar una meta sin aportes');
do $$
begin
  perform public.create_savings_goal('Tarjeta', 1000, p_account_id => lujitos_tests.id('tarjeta'));
  raise exception 'PRUEBA FALLIDA: meta en una tarjeta';
exception when sqlstate 'LJ007' then raise notice 'ok - META: no se guarda en una tarjeta ni en una deuda';
end $$;

-- =====================================================================
-- DEUDAS
-- =====================================================================
insert into lujitos_tests.nums select 'patrimonio1', lujitos_tests.summary('net_worth');
insert into lujitos_tests.ids select 'carro',
  public.create_debt('Crédito carro', 5000000, 5000000, 'vehicle', 'Banco de Bogotá', 1.5, 'monthly',
    p_installment_amount => 500000, p_frequency => 'monthly', p_first_payment_date => lujitos_tests.today(),
    p_payment_account_id => lujitos_tests.id('banco'));
insert into lujitos_tests.ids select 'carro_cuenta', account_id from public.debts where id = lujitos_tests.id('carro');
select lujitos_tests.check(
  lujitos_tests.summary('loan_debt') = 5000000
  and lujitos_tests.summary('net_worth') = lujitos_tests.num('patrimonio1') - 5000000,
  'DEUDA: registrar una deuda de 5.000.000 la suma a los pasivos');

insert into lujitos_tests.nums select 'patrimonio2', lujitos_tests.summary('net_worth');
insert into lujitos_tests.nums select 'banco1', lujitos_tests.bal('banco');
insert into lujitos_tests.nums select 'gastos_mes', lujitos_tests.summary('month_expense');
insert into lujitos_tests.nums select 'general1', (lujitos_tests.budget('general')).spent;
select public.register_debt_payment(lujitos_tests.id('carro'), 'installment', 500000);
select lujitos_tests.check(
  (lujitos_tests.debt('carro')).outstanding = 4500000
  and (lujitos_tests.debt('carro')).total_paid = 500000
  and (lujitos_tests.debt('carro')).percent_paid = 10,
  'DEUDA: 5.000.000 con un pago de 500.000 → pendiente 4.500.000, total pagado 500.000 (10 %)');
select lujitos_tests.check(lujitos_tests.bal('banco') = lujitos_tests.num('banco1') - 500000,
  'DEUDA: el pago descuenta la cuenta de origen');
select lujitos_tests.check(
  lujitos_tests.summary('net_worth') = lujitos_tests.num('patrimonio2')
  and lujitos_tests.summary('month_expense') = lujitos_tests.num('gastos_mes')
  and (lujitos_tests.budget('general')).spent = lujitos_tests.num('general1'),
  'DEUDA: pagar no cambia el patrimonio ni cuenta como gasto (no hay doble conteo)');
select lujitos_tests.check(
  (lujitos_tests.debt('carro')).next_payment_date = (lujitos_tests.today() + interval '1 month')::date
  and (lujitos_tests.debt('carro')).installments_paid = 1,
  'DEUDA: la próxima cuota pasa al mes siguiente');

do $$
declare
  v_detail text;
begin
  perform public.register_debt_payment(lujitos_tests.id('carro'), 'extra', 5000000, p_allow_negative => true);
  raise exception 'PRUEBA FALLIDA: se pagó más de lo que se debe sin advertir';
exception when sqlstate 'LJ011' then
  get stacked diagnostics v_detail = pg_exception_detail;
  if v_detail is distinct from '4500000' then
    raise exception 'PRUEBA FALLIDA: el aviso de sobrepago no dice cuánto se debe (%)', v_detail;
  end if;
  raise notice 'ok - DEUDA: pagar de más pide confirmación y dice cuánto se debe (4.500.000)';
end $$;

select public.register_debt_payment(lujitos_tests.id('carro'), 'interest', 100000);
select lujitos_tests.check(
  (lujitos_tests.debt('carro')).outstanding = 4600000 and (lujitos_tests.debt('carro')).interest_registered = 100000
  and lujitos_tests.summary('month_expense') = lujitos_tests.num('gastos_mes') + 100000
  and (lujitos_tests.budget('general')).spent = lujitos_tests.num('general1') + 100000,
  'DEUDA: un interés aumenta la deuda (4.600.000) y sí es un gasto');

select public.register_debt_payment(lujitos_tests.id('carro'), 'installment', 500000, p_interest_portion => 100000);
select lujitos_tests.check(
  (lujitos_tests.debt('carro')).outstanding = 4200000 and (lujitos_tests.debt('carro')).total_paid = 1000000
  and (lujitos_tests.debt('carro')).interest_registered = 200000 and (lujitos_tests.debt('carro')).installments_paid = 2
  and (lujitos_tests.debt('carro')).next_payment_date = (lujitos_tests.today() + interval '2 months')::date,
  'DEUDA: cuota de 500.000 con 100.000 de intereses → baja solo el capital (4.200.000)');

insert into lujitos_tests.ids select 'solicitud_pago', gen_random_uuid();
select public.register_debt_payment(lujitos_tests.id('carro'), 'extra', 200000, p_request_id => lujitos_tests.id('solicitud_pago'));
select public.register_debt_payment(lujitos_tests.id('carro'), 'extra', 200000, p_request_id => lujitos_tests.id('solicitud_pago'));
select lujitos_tests.check(
  (lujitos_tests.debt('carro')).outstanding = 4000000
  and (select count(*) from public.transactions where client_request_id = lujitos_tests.id('solicitud_pago')) = 1,
  'DEUDA: un pago enviado dos veces (misma solicitud) se registra una vez');

insert into lujitos_tests.nums select 'banco2', lujitos_tests.bal('banco');
insert into lujitos_tests.ids select 'pago_extra',
  (public.register_debt_payment(lujitos_tests.id('carro'), 'extra', 300000) ->> 'transaction_id')::uuid;
select public.update_transaction(lujitos_tests.id('pago_extra'), 100000, lujitos_tests.id('banco'),
  p_destination_account_id => lujitos_tests.id('carro_cuenta'));
select lujitos_tests.check((lujitos_tests.debt('carro')).outstanding = 3900000,
  'DEUDA: editar un pago (300.000 → 100.000) recalcula el pendiente (3.900.000)');
select public.void_transaction(lujitos_tests.id('pago_extra'), 'Pago repetido');
select lujitos_tests.check(
  (lujitos_tests.debt('carro')).outstanding = 4000000 and lujitos_tests.bal('banco') = lujitos_tests.num('banco2'),
  'DEUDA: revertir un pago devuelve el pendiente y el dinero a la cuenta de origen');

insert into lujitos_tests.ids select 'ana',
  public.create_debt('Préstamo de Ana', 200000, 200000, 'personal', 'Ana', p_payment_account_id => lujitos_tests.id('banco'));
select public.register_debt_payment(lujitos_tests.id('ana'), 'extra', 250000, p_allow_overpay => true);
select lujitos_tests.check(
  (lujitos_tests.debt('ana')).outstanding = 0 and (lujitos_tests.debt('ana')).credit_balance = 50000
  and (lujitos_tests.debt('ana')).status = 'paid' and (lujitos_tests.debt('ana')).percent_paid = 100,
  'DEUDA: un sobrepago confirmado deja saldo a favor (50.000) y la deuda pagada');

insert into lujitos_tests.ids select 'tio',
  public.create_debt('Préstamo tío', 1000000, 1000000, 'personal', p_start_date => lujitos_tests.today() - 60,
    p_installment_amount => 100000, p_frequency => 'monthly', p_first_payment_date => lujitos_tests.today() - 10);
select lujitos_tests.check((lujitos_tests.debt('tio')).status = 'overdue',
  'DEUDA: una cuota sin pagar con fecha pasada la marca como vencida');
select public.delete_debt(lujitos_tests.id('tio'));
select lujitos_tests.check(
  not exists (select 1 from public.debts where id = lujitos_tests.id('tio')),
  'DEUDA: una deuda sin movimientos se puede borrar');

do $$
begin
  perform public.delete_debt(lujitos_tests.id('carro'));
  raise exception 'PRUEBA FALLIDA: se borró una deuda con pagos';
exception when sqlstate 'LJ013' then raise notice 'ok - DEUDA: con pagos no se borra (se archiva)';
end $$;
do $$
begin
  perform public.archive_debt(lujitos_tests.id('carro'));
  raise exception 'PRUEBA FALLIDA: se archivó una deuda con saldo sin advertir';
exception when sqlstate 'LJ004' then raise notice 'ok - DEUDA: archivar con saldo pendiente pide confirmación';
end $$;
select public.archive_debt(lujitos_tests.id('carro'), true, true);
select lujitos_tests.check(
  (lujitos_tests.debt('carro')).status = 'archived' and lujitos_tests.summary('loan_debt') = 0,
  'DEUDA: archivada deja de sumar en los totales');
select public.archive_debt(lujitos_tests.id('carro'), false);
select lujitos_tests.check(lujitos_tests.summary('loan_debt') = 4000000, 'DEUDA: reactivarla la vuelve a sumar');

do $$
begin
  perform public.create_transaction('income', 1000, lujitos_tests.id('carro_cuenta'), p_category_id => lujitos_tests.cat('salary'));
  raise exception 'PRUEBA FALLIDA: una deuda recibió un ingreso';
exception when sqlstate 'LJ007' then raise notice 'ok - DEUDA: no recibe ingresos';
end $$;
do $$
begin
  perform public.create_account(p_name => 'Falsa', p_account_type => 'loan', p_institution => 'custom', p_institution_name => 'X');
  raise exception 'PRUEBA FALLIDA: deuda creada como cuenta suelta';
exception when sqlstate 'LJ007' then raise notice 'ok - DEUDA: solo se crea desde Deudas';
end $$;
do $$
begin
  perform public.update_account(lujitos_tests.id('carro_cuenta'), 'Otra', 'savings', 'custom', 'X', 0, null, null, null, null,
    null, null, null);
  raise exception 'PRUEBA FALLIDA: una deuda se convirtió en cuenta de ahorros';
exception when sqlstate 'LJ007' then raise notice 'ok - DEUDA: no se convierte en otro tipo de cuenta';
end $$;
do $$
begin
  perform public.update_debt(lujitos_tests.id('carro'), 'Crédito carro', 5000000, 6000000, 'vehicle', 'Banco de Bogotá', 1.5,
    'monthly', null, null, 500000, 'monthly', lujitos_tests.today(), lujitos_tests.id('banco'), null, null);
  raise exception 'PRUEBA FALLIDA: cambió el saldo inicial de una deuda con pagos';
exception when sqlstate 'LJ007' then raise notice 'ok - DEUDA: con pagos el saldo inicial no cambia (se ajusta)';
end $$;
select public.update_debt(lujitos_tests.id('carro'), 'Crédito del carro', 5000000, 5000000, 'vehicle', 'Banco de Bogotá', 1.4,
  'monthly', null, null, 500000, 'monthly', lujitos_tests.today(), lujitos_tests.id('banco'), 'Placa ABC', null);
select lujitos_tests.check(
  (select name from public.accounts where id = lujitos_tests.id('carro_cuenta')) = 'Crédito del carro'
  and (select interest_rate from public.debts where id = lujitos_tests.id('carro')) = 1.4
  and (lujitos_tests.debt('carro')).outstanding = 4000000,
  'DEUDA: editar sus datos no toca el saldo');

-- =====================================================================
-- PATRIMONIO, TARJETA Y PLANIFICACIÓN (usuario F, cuentas nuevas)
-- =====================================================================
select set_config('request.jwt.claims', '{"sub": "66666666-6666-4666-8666-666666666666", "role": "authenticated"}', true);

insert into lujitos_tests.ids select 'f_banco',
  public.create_account(p_name => 'BBVA', p_account_type => 'savings', p_institution => 'bbva', p_initial_balance => 10000000);
insert into lujitos_tests.ids select 'f_nequi',
  public.create_account(p_name => 'Nequi F', p_account_type => 'digital_wallet', p_institution => 'nequi');
insert into lujitos_tests.ids select 'f_tarjeta',
  public.create_account(p_name => 'Mastercard', p_account_type => 'credit_card', p_institution => 'davivienda',
                        p_initial_balance => -500000, p_credit_limit => 3000000);
insert into lujitos_tests.ids select 'f_deuda',
  public.create_debt('Libre inversión', 3000000, 2500000, 'bank_loan', 'BBVA', p_installment_amount => 400000,
    p_frequency => 'monthly', p_first_payment_date => lujitos_tests.today() + 5, p_payment_account_id => lujitos_tests.id('f_banco'));
select lujitos_tests.check(
  lujitos_tests.summary('assets') = 10000000 and lujitos_tests.summary('liabilities') = 3000000
  and lujitos_tests.summary('net_worth') = 7000000,
  'PATRIMONIO: activos 10.000.000 − pasivos 3.000.000 = 7.000.000');
select lujitos_tests.check(public.financial_summary() ->> 'savings_rate' is null,
  'PLANIFICACIÓN: sin ingresos el % de ahorro queda vacío (no se divide por cero)');
select public.create_transaction('transfer', 1000000, lujitos_tests.id('f_banco'), p_destination_account_id => lujitos_tests.id('f_nequi'));
select lujitos_tests.check(lujitos_tests.summary('net_worth') = 7000000,
  'PATRIMONIO: una transferencia entre cuentas propias no lo cambia');

select public.create_transaction('expense', 200000, lujitos_tests.id('f_tarjeta'), p_category_id => lujitos_tests.cat('shopping'));
select lujitos_tests.check(
  lujitos_tests.bal('f_tarjeta') = -700000 and lujitos_tests.summary('credit_available') = 2300000,
  'TARJETA: cupo 3.000.000, deuda 500.000 + compra 200.000 → deuda 700.000 y disponible 2.300.000');
select public.create_transaction('transfer', 200000, lujitos_tests.id('f_banco'), p_destination_account_id => lujitos_tests.id('f_tarjeta'));
select lujitos_tests.check(
  lujitos_tests.bal('f_tarjeta') = -500000 and lujitos_tests.bal('f_banco') = 8800000
  and lujitos_tests.summary('month_expense') = 200000,
  'TARJETA: pago de 200.000 → deuda 500.000, banco −200.000 y sin un segundo gasto');
select public.register_debt_payment(lujitos_tests.id('f_deuda'), 'installment', 400000);
select lujitos_tests.check(
  lujitos_tests.summary('net_worth') = 6800000 and lujitos_tests.summary('loan_debt') = 2100000,
  'PATRIMONIO: la compra lo baja (6.800.000); el pago de la tarjeta y de la cuota no');

select public.create_transaction('income', 3000000, lujitos_tests.id('f_banco'), p_category_id => lujitos_tests.cat('salary'));
select public.create_transaction('expense', 1000000, lujitos_tests.id('f_banco'), p_category_id => lujitos_tests.cat('housing'));
select public.create_transaction('expense', 800000, lujitos_tests.id('f_banco'), p_category_id => lujitos_tests.cat('food'));
select public.create_transaction('expense', 200000, lujitos_tests.id('f_banco'), p_category_id => lujitos_tests.cat('entertainment'));
select lujitos_tests.check(
  lujitos_tests.plan('income_avg')::bigint = 3000000 and lujitos_tests.plan('expense_avg')::bigint = 2200000
  and lujitos_tests.plan('essential_avg')::bigint = 1800000 and lujitos_tests.plan('fixed_avg')::bigint = 1000000
  and lujitos_tests.plan('variable_avg')::bigint = 1200000 and lujitos_tests.plan('obligations_monthly')::bigint = 400000,
  'PLANIFICACIÓN: ingresos 3.000.000, gastos 2.200.000 (esenciales 1.800.000, fijos 1.000.000), cuotas 400.000');
select lujitos_tests.check(lujitos_tests.plan('savings_capacity')::bigint = 800000,
  'PLANIFICACIÓN: capacidad de ahorro = 3.000.000 − 1.800.000 esenciales − 400.000 de cuotas = 800.000');
select lujitos_tests.check(
  lujitos_tests.plan('savings_avg')::bigint = 800000 and lujitos_tests.plan('savings_rate')::numeric = 26.67
  and lujitos_tests.summary('savings_rate') = 26.67,
  'PLANIFICACIÓN: ahorro del mes 800.000 (26,67 % de los ingresos)');
select lujitos_tests.check(
  lujitos_tests.plan('preliminary')::boolean and lujitos_tests.plan('basis') = 'current_month',
  'PLANIFICACIÓN: con menos de 3 meses de historial se marca como preliminar');
select lujitos_tests.check(
  (select f.income = 3000000 and f.expense = 2200000 and f.fixed_expense = 1000000 and f.essential_expense = 1800000
     from public.monthly_flows(3) f order by f.month_start desc limit 1)
  and (select count(*) from public.monthly_flows(3)) = 3,
  'PLANIFICACIÓN: flujo del mes actual y de los meses anteriores');
select lujitos_tests.check(
  (select s.category_id = lujitos_tests.cat('housing') and s.total = 1000000
     from public.spending_by_category(date_trunc('month', lujitos_tests.today()::timestamp)::date, lujitos_tests.today()) s
    limit 1),
  'GASTO POR CATEGORÍA: la mayor primero (Vivienda 1.000.000)');

-- =====================================================================
-- AISLAMIENTO: F no ve ni toca nada de E
-- =====================================================================
select lujitos_tests.check(
  (select count(*) from public.budgets) = 0 and (select count(*) from public.budget_status) = 0
  and (select count(*) from public.budget_alerts) = 0 and (select count(*) from public.savings_goals) = 0
  and (select count(*) from public.savings_goal_progress) = 0 and (select count(*) from public.savings_goal_movements) = 0
  and (select count(*) from public.debts) = 1 and (select count(*) from public.debt_overview) = 1,
  'AISLAMIENTO: F solo ve sus propios presupuestos, avisos, metas y deudas');
select lujitos_tests.check(
  (select count(*) from public.budget_history(lujitos_tests.id('comida'), 6)) = 0,
  'AISLAMIENTO: F no ve el historial del presupuesto de E');

do $$
begin
  perform public.update_budget(lujitos_tests.id('comida'), null, 1, 'monthly', null, null, null, null);
  raise exception 'PRUEBA FALLIDA: F editó un presupuesto de E';
exception when sqlstate 'LJ006' then raise notice 'ok - AISLAMIENTO: F no edita presupuestos de E';
end $$;
do $$
begin
  perform public.archive_budget(lujitos_tests.id('comida'));
  raise exception 'PRUEBA FALLIDA: F archivó un presupuesto de E';
exception when sqlstate 'LJ006' then raise notice 'ok - AISLAMIENTO: F no archiva presupuestos de E';
end $$;
do $$
begin
  perform public.delete_budget(lujitos_tests.id('comida'));
  raise exception 'PRUEBA FALLIDA: F borró un presupuesto de E';
exception when sqlstate 'LJ006' then raise notice 'ok - AISLAMIENTO: F no borra presupuestos de E';
end $$;
do $$
begin
  perform public.add_goal_movement(lujitos_tests.id('casa'), 'contribution', 1000);
  raise exception 'PRUEBA FALLIDA: F aportó a una meta de E';
exception when sqlstate 'LJ006' then raise notice 'ok - AISLAMIENTO: F no aporta a metas de E';
end $$;
do $$
begin
  perform public.void_goal_movement(lujitos_tests.id('aporte2'));
  raise exception 'PRUEBA FALLIDA: F revirtió un aporte de E';
exception when sqlstate 'LJ006' then raise notice 'ok - AISLAMIENTO: F no revierte aportes de E';
end $$;
do $$
begin
  perform public.delete_savings_goal(lujitos_tests.id('moto'));
  raise exception 'PRUEBA FALLIDA: F borró una meta de E';
exception when sqlstate 'LJ006' then raise notice 'ok - AISLAMIENTO: F no borra metas de E';
end $$;
do $$
begin
  perform public.create_savings_goal('Ajena', 1000, p_account_id => lujitos_tests.id('ahorros'));
  raise exception 'PRUEBA FALLIDA: F usó una cuenta de E';
exception when sqlstate 'LJ006' then raise notice 'ok - AISLAMIENTO: F no asigna cuentas de E a sus metas';
end $$;
do $$
begin
  perform public.register_debt_payment(lujitos_tests.id('carro'), 'extra', 1000, p_account_id => lujitos_tests.id('f_banco'));
  raise exception 'PRUEBA FALLIDA: F pagó una deuda de E';
exception when sqlstate 'LJ006' then raise notice 'ok - AISLAMIENTO: F no registra pagos en deudas de E';
end $$;
do $$
begin
  perform public.register_debt_payment(lujitos_tests.id('f_deuda'), 'extra', 1000, p_account_id => lujitos_tests.id('banco'));
  raise exception 'PRUEBA FALLIDA: F pagó con una cuenta de E';
exception when sqlstate 'LJ006' then raise notice 'ok - AISLAMIENTO: F no paga con cuentas de E';
end $$;
do $$
begin
  perform public.archive_debt(lujitos_tests.id('carro'), true, true);
  raise exception 'PRUEBA FALLIDA: F archivó una deuda de E';
exception when sqlstate 'LJ006' then raise notice 'ok - AISLAMIENTO: F no archiva deudas de E';
end $$;
do $$
begin
  insert into public.budgets (user_id, limit_amount, period) values ('66666666-6666-4666-8666-666666666666', 1000, 'monthly');
  raise exception 'PRUEBA FALLIDA: la app insertó un presupuesto sin RPC';
exception when insufficient_privilege then raise notice 'ok - Escrituras solo por RPC: presupuestos';
end $$;
do $$
begin
  update public.debts set original_amount = 1;
  raise exception 'PRUEBA FALLIDA: la app editó una deuda sin RPC';
exception when insufficient_privilege then raise notice 'ok - Escrituras solo por RPC: deudas';
end $$;
do $$
begin
  insert into public.savings_goal_movements (user_id, goal_id, kind, amount)
  values ('66666666-6666-4666-8666-666666666666', lujitos_tests.id('casa'), 'contribution', 1000);
  raise exception 'PRUEBA FALLIDA: la app insertó un aporte sin RPC';
exception when insufficient_privilege then raise notice 'ok - Escrituras solo por RPC: aportes de metas';
end $$;
update public.budget_alerts set seen_at = null;

reset role;
select lujitos_tests.check(
  (select count(*) from public.budget_alerts where budget_id = lujitos_tests.id('comida') and seen_at is not null) = 5
  and (select count(*) from public.savings_goal_movements where user_id = '55555555-5555-4555-8555-555555555555') = 6
  and (select outstanding from public.debt_overview where debt_id = lujitos_tests.id('carro')) = 4000000,
  'AISLAMIENTO: los datos de E siguen intactos tras los intentos de F');

-- Sin sesión no se lee ni se ejecuta nada
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
do $$
begin
  perform count(*) from public.budget_status;
  raise exception 'PRUEBA FALLIDA: un visitante leyó presupuestos';
exception when insufficient_privilege then raise notice 'ok - Sin sesión no se leen presupuestos';
end $$;
do $$
begin
  perform public.create_debt('X', 1, 1);
  raise exception 'PRUEBA FALLIDA: un visitante creó una deuda';
exception when insufficient_privilege then raise notice 'ok - Sin sesión no se ejecutan las operaciones de la Fase 5';
end $$;
reset role;

-- =====================================================================
-- AUDITORÍA (sin montos ni textos)
-- =====================================================================
select lujitos_tests.check(
  (select count(*) from public.audit_logs where user_id = '55555555-5555-4555-8555-555555555555' and action = 'budget.created') = 3
  and exists (select 1 from public.audit_logs where action = 'budget.archived')
  and exists (select 1 from public.audit_logs where action = 'budget.restored')
  and exists (select 1 from public.audit_logs where action = 'budget.deleted'),
  'AUDITORÍA: crear, archivar, reactivar y borrar presupuestos queda anotado');
select lujitos_tests.check(
  exists (select 1 from public.audit_logs where action = 'goal.created')
  and exists (select 1 from public.audit_logs where action = 'goal.archived')
  and exists (select 1 from public.audit_logs where action = 'goal_movement.created')
  and exists (select 1 from public.audit_logs where action = 'goal_movement.updated' and changed_fields = '{amount}')
  and exists (select 1 from public.audit_logs where action = 'goal_movement.voided'),
  'AUDITORÍA: metas y sus aportes (creados, editados, revertidos)');
select lujitos_tests.check(
  exists (select 1 from public.audit_logs where action = 'debt.created')
  and exists (select 1 from public.audit_logs where action = 'debt.updated')
  and exists (select 1 from public.audit_logs where action = 'debt.deleted'),
  'AUDITORÍA: deudas creadas, editadas y borradas');
select lujitos_tests.check(
  not exists (select 1 from public.audit_logs l, unnest(l.changed_fields) f where f !~ '^[a-z_]+$'),
  'AUDITORÍA: solo guarda nombres de campos (ni nombres ni montos)');

select 'TODAS LAS PRUEBAS DE LA FASE 5 PASARON' as resultado;
rollback;
