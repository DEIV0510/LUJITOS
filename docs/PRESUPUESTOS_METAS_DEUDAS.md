# LUJITOS — Presupuestos, metas, deudas y cálculos

Cómo funcionan los módulos de la Fase 5 y de dónde sale cada cifra. Todos los
cálculos se hacen en PostgreSQL (vistas y funciones de
`supabase/migrations/20261112150100_budgets_goals_debts.sql`); la app solo los
muestra. Montos en pesos enteros (BIGINT).

## Regla de base (Fase 4, sin cambios)

Saldo de una cuenta = saldo inicial + movimientos no anulados, según una sola
regla (`transaction_effect`): ingreso +, gasto −, transferencia − en origen y +
en destino, ajuste ±. Las escrituras pasan solo por funciones RPC que validan,
bloquean las cuentas y aceptan una clave de idempotencia.

## Presupuestos

| Dato | Cálculo |
| --- | --- |
| Período | Semanal: lunes a domingo · Mensual: mes calendario · Anual: año calendario · Personalizado: de la fecha inicial a la final |
| Gastado | Suma de **gastos** no anulados del período, de la categoría (o de todas, si es general) |
| Disponible | Límite − gastado (negativo si se superó) |
| % usado | Gastado × 100 / límite (dos decimales) |
| Período anterior | Lo gastado en el período inmediatamente anterior (comparación del general) |
| Estado | `archived`, `scheduled` (aún no empieza), `ended` (ya terminó), `exceeded` (gastado > límite) o `active` |

No cuentan: transferencias, ingresos, pagos de tarjeta (son transferencias),
ajustes de saldo ni movimientos anulados. Una compra con tarjeta **sí** cuenta
(es gasto real). Editar o anular un gasto recalcula solo, porque nada se guarda
aparte.

**Avisos.** Umbrales configurables (por defecto 50, 75, 90 y 100 %) y «superado»
(gastado > límite). Un trigger sobre `transactions` revisa los presupuestos del
período actual al registrar o editar un gasto, y también se revisan al crear,
editar o reactivar un presupuesto. Cada aviso se guarda en `budget_alerts` una
sola vez por presupuesto, período y umbral (restricción única): no se repite.
La comparación es exacta en enteros: gastado × 100 ≥ umbral × límite. Un gasto
fechado en un período anterior no genera avisos del período actual. Un
presupuesto archivado no avisa.

**Duplicados.** Solo puede haber un presupuesto activo por categoría (o general)
y período (semanal, mensual o anual); los personalizados pueden coexistir.

**Borrar** elimina el presupuesto y sus avisos; ningún movimiento se toca.
**Archivar** lo pausa y conserva su historial.

## Metas de ahorro

| Dato | Cálculo |
| --- | --- |
| Ahorrado | Ahorro inicial + aportes − retiros (no revertidos); nunca se muestra negativo |
| Falta | máx(objetivo − ahorrado, 0) |
| % | Ahorrado × 100 / objetivo (puede pasar de 100) |
| Superada por | máx(ahorrado − objetivo, 0) |
| Días restantes | Fecha objetivo − hoy (Bogotá) |
| Al mes | ⌈falta / ⌈días / 30,4375⌉⌉ |
| A la semana | ⌈falta / ⌈días / 7⌉⌉ |
| Al día | ⌈falta / días⌉ |
| Estado | `archived`, `completed` (ahorrado ≥ objetivo), `overdue` (fecha pasada), `active` |

**No crea dinero.** Un aporte es una asignación de dinero que ya tienes: no
cambia saldos ni patrimonio. Si la meta tiene cuenta y eliges «mover dinero
desde» otra cuenta, el servidor registra además una **transferencia** real entre
tus cuentas (enlazada al aporte); una transferencia tampoco cambia el patrimonio.
Un retiro con cuenta devuelve el dinero con otra transferencia.

**Sin cuenta asignada.** Se muestra como tal y la meta solo lleva la cuenta de lo
separado. Con cuenta, se avisa si lo separado en metas de esa cuenta supera su
saldo.

**Recomendación.** Solo para metas activas con fecha. Si la fecha pasó, la meta
queda «vencida», no se recomienda nada negativo y se ofrece cambiar la fecha.

**Editar o revertir.** Editar un aporte con transferencia corrige también la
transferencia. Revertir lo deja de contar y anula su transferencia (el dinero
vuelve a la cuenta de origen); el registro se conserva. Si la transferencia se
edita o anula desde Movimientos, el aporte la sigue (trigger). No se puede
retirar más de lo ahorrado ni revertir un aporte si la meta quedaría en negativo
(LJ010). Una meta con aportes no se borra: se archiva (LJ013).

## Deudas

Cada deuda tiene una cuenta de tipo **`loan`** (saldo negativo = lo que se debe),
igual que una tarjeta, y una fila en `debts` con sus datos (acreedor, tipo,
valor prestado, tasa, fechas, cuota, frecuencia, cuenta de pago). Las tarjetas
de crédito siguen siendo las cuentas de la Fase 4: no hay un segundo sistema.

| Operación | Cómo se registra | Efecto |
| --- | --- | --- |
| Cuota o abono | Transferencia cuenta de pago → deuda (`purpose` = `debt_installment` / `debt_extra`) | La cuenta baja, la deuda baja. No es gasto. El patrimonio no cambia |
| Cuota con intereses | Primero un gasto «Intereses y comisiones» sobre la deuda por la parte de intereses; luego la transferencia por el total | La deuda baja solo por el capital |
| Interés | Gasto «Intereses y comisiones» sobre la deuda (`debt_interest`) | La deuda sube. Es gasto y baja el patrimonio |
| Corregir saldo | Ajuste de saldo (`reconcile_account`) con motivo | Igual que en cualquier cuenta |

| Dato | Cálculo |
| --- | --- |
| Pendiente | máx(−saldo de la cuenta, 0) |
| Saldo a favor | máx(saldo, 0) (si se pagó de más) |
| Pagado antes de registrarla | máx(valor prestado − saldo al registrarla, 0) |
| Total pagado (en LUJITOS) | Suma de transferencias recibidas por la deuda |
| Intereses registrados | Suma de gastos sobre la deuda |
| % pagado | (pagado antes + total pagado) / (pagado antes + total pagado + pendiente) |
| Próxima cuota | Fecha del próximo pago + (cuotas pagadas × frecuencia). Una cuota sin pagar con fecha pasada → «vencida» |

**Sobrepago.** Un pago mayor que lo pendiente pide confirmación (LJ011, con lo
que se debe); si se confirma, queda saldo a favor y la deuda figura pagada.
**Editar o revertir un pago** = editar o anular su movimiento: el seguimiento se
recalcula. Una deuda no recibe ingresos, no se crea como cuenta suelta y no
cambia de tipo. Con pagos no se borra (LJ013); archivarla con saldo pide
confirmación (LJ004) y deja de sumar en los totales.

## Planificación

| Dato | Cálculo (`financial_summary`, `planning_snapshot`) |
| --- | --- |
| Activos | Suma de saldos positivos de cuentas activas |
| Pasivos | Suma de saldos negativos (tarjetas, deudas, sobregiros) |
| Patrimonio neto | Activos − pasivos (= suma de saldos). El cupo y las metas no suman |
| Deudas totales | Deuda de tarjetas + deuda de préstamos |
| % de ahorro del mes | (ingresos − gastos) × 100 / ingresos; **vacío si no hay ingresos** |
| Base de los promedios | Hasta 3 meses completos (sin el actual; el primer mes cuenta si empezaste antes del día 6). Sin meses completos: lo que va del mes, marcado como **preliminar** |
| Gastos esenciales | Categorías marcadas «esencial» (sistema: comida, transporte, vivienda, servicios, salud, educación, impuestos) |
| Gastos fijos | Categorías marcadas «fijo» (vivienda, servicios, educación, suscripciones, gimnasio, impuestos); variables = total − fijos |
| Obligaciones | Cuotas de deudas activas llevadas a valor mensual (semanal × 52/12, quincenal × 26/12, trimestral / 3, anual / 12) |
| Capacidad de ahorro | Ingreso promedio − gasto esencial promedio − obligaciones |

Las categorías propias se marcan como fijas o esenciales al crearlas o editarlas.

**Proyección a 3, 6 y 12 meses** (`src/features/planning/projections.ts`):
patrimonio + ahorro promedio × meses; deuda de préstamos − cuotas × meses (sin
bajar de cero). Supuestos mostrados en pantalla: el ahorro promedio se repite,
las cuotas van completas a capital (sin intereses futuros), sin rendimientos ni
gastos extraordinarios. Sin movimientos no se proyecta nada.

## Recordatorios

Calculados de los datos (`src/features/planning/reminders.ts`): cuotas de deudas,
pago de tarjetas con deuda (día límite), metas con fecha cercana y presupuestos
superados. Son **notificaciones locales** (`expo-notifications`): el iPhone las
programa a las 9:00 de Bogotá — cuotas y tarjetas un día antes, metas una semana
antes — y un presupuesto superado se avisa una vez. El permiso se pide solo al
activar «Recordatorios en este iPhone» en Avisos. Nada se envía a un servidor.

## Códigos de error nuevos

| Código | Significado |
| --- | --- |
| LJ010 | La meta quedaría con menos de cero (retiro o reversión) |
| LJ011 | El pago supera lo que se debe (se puede confirmar: queda saldo a favor) |
| LJ012 | Ya hay un presupuesto activo para esa categoría y período |
| LJ013 | Tiene historial: se archiva en vez de borrarse |
