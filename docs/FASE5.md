# LUJITOS — Reporte de la Fase 5

Presupuestos, metas de ahorro, deudas, planificación, panel y recordatorios, con
datos reales en Supabase. Fecha: 2026-11-12. Cómo se calcula cada cifra:
[PRESUPUESTOS_METAS_DEUDAS.md](PRESUPUESTOS_METAS_DEUDAS.md).

## 1. Funcionalidades implementadas

**Presupuestos**
- Crear, editar, archivar, reactivar y eliminar (eliminar no toca ningún movimiento).
- Por categoría de gasto o general; semanal, mensual, anual o con fechas propias; fecha de fin opcional.
- Gastado, disponible, % usado, días restantes, estado y período anterior (el general se compara con el mes anterior).
- Historial por período desde que empezó el presupuesto y lista de los gastos del período.
- Avisos configurables (por defecto 50, 75, 90 y 100 %) y «superado», guardados una vez por período, sin repetirse.
- Solo cuentan gastos reales; transferencias, ingresos, pagos de tarjeta y anulados no. Editar o anular recalcula.

**Metas de ahorro**
- Crear, editar, archivar, reactivar y eliminar (solo sin aportes).
- Nombre, descripción, objetivo, ahorro inicial, fechas, tipo, cuenta opcional, color e ícono.
- Ahorrado, falta, %, superada por, días restantes, estado (en curso, cumplida, vencida, archivada).
- Aportes y retiros: crear, editar, revertir, historial. Con cuenta, opción de mover dinero real (transferencia enlazada).
- No crea dinero ni cambia el patrimonio. Meta sin cuenta marcada «sin cuenta asignada». Aviso si lo separado supera el saldo de la cuenta.
- Ahorro recomendado al mes, a la semana y al día. Meta vencida: sin recomendación negativa y con «Cambiar la fecha».

**Deudas**
- Registrar, editar, archivar, reactivar y eliminar (solo sin movimientos).
- Acreedor, tipo, valor prestado, saldo pendiente, tasa mensual o anual (o sin interés), fechas, cuota, frecuencia, cuenta de pago, descripción.
- Pendiente, total pagado, pagado antes de registrarla, intereses, cuotas, % pagado, próxima cuota, fecha límite, estado (al día, vencida, pagada, archivada), historial.
- Pagar cuota (con la parte de intereses opcional), abono extra, registrar interés, corregir saldo.
- Editar o revertir un pago desde su movimiento; el seguimiento se recalcula.
- Sobrepago: pide confirmación y deja saldo a favor. Sin doble conteo: el pago es transferencia.
- Las tarjetas de crédito de la Fase 4 aparecen en Deudas (sin un segundo sistema de tarjetas).

**Planificación**
- Mes: ingresos, gastos, ahorro y % de ahorro (vacío si no hay ingresos).
- Patrimonio: activos, pasivos, patrimonio neto, deudas totales.
- Capacidad de ahorro = ingreso promedio − gasto esencial − cuotas de deudas; gastos fijos y variables.
- Proyección a 3, 6 y 12 meses con supuestos visibles; preliminar si hay poco historial; sin datos no se proyecta.
- Categorías propias marcables como gasto fijo o esencial.

**Panel de Inicio**
- Presupuesto del mes, gasto por categoría, metas, deudas, próximos pagos (14 días), capacidad de ahorro y franja de avisos nuevos.
- Cada bloque abre su módulo; solo aparece lo que tiene datos. La campana cuenta avisos sin ver y cuotas vencidas.

**Avisos y recordatorios**
- Próximos 30 días: cuotas, pagos de tarjeta, metas cercanas, presupuestos superados.
- Avisos de presupuesto de los últimos 60 días (se marcan como vistos al abrir).
- «Recordatorios en este iPhone»: notificaciones locales con `expo-notifications`; el permiso se pide solo al activarlo.

## 2. Base de datos

**Migraciones** (aplicadas en el proyecto `lujitos` el 2026-11-12):

| Migración | Contenido |
| --- | --- |
| `20261112150000_loan_account_type.sql` | Tipo de cuenta `loan` (va solo: un valor nuevo de enum no se usa en la misma transacción) |
| `20261112150100_budgets_goals_debts.sql` | Todo lo demás (abajo) |

**Tablas nuevas** (RLS, solo lectura de lo propio; escrituras solo por RPC):
`budgets`, `budget_alerts` (la app solo puede marcar `seen_at`), `savings_goals`,
`savings_goal_movements`, `debts`.

**Vistas nuevas** (security invoker): `budget_status`, `savings_goal_progress`, `debt_overview`.

**Cambios en tablas existentes:** `accounts` (saldo inicial ≤ 0 también en `loan`),
`transactions.purpose` (etiqueta de cuota, abono, interés, aporte o retiro),
`categories.is_fixed` e `is_essential` (valores por defecto en las del sistema),
índice de gastos por categoría y fecha.

**Integridad:** claves foráneas compuestas (id, user_id) hacia cuentas y metas,
restricciones de forma (cuotas, tasa, fechas, umbrales), unicidad de presupuesto
activo, de aviso por período y de la clave de idempotencia por usuario; triggers
de avisos de presupuesto, de sincronización aporte ↔ transferencia y de
auditoría (sin montos ni textos).

## 3. Funciones RPC

Implementación SECURITY DEFINER en el esquema `private`, envoltorio sin
privilegios en `public` (como en la Fase 4). Todas toman el usuario de
`auth.uid()`, validan propiedad, bloquean filas y aceptan clave de idempotencia
donde crean algo.

| Función | Uso |
| --- | --- |
| `create_budget`, `update_budget`, `archive_budget`, `delete_budget` | Presupuestos |
| `create_savings_goal`, `update_savings_goal`, `archive_savings_goal`, `delete_savings_goal` | Metas |
| `add_goal_movement`, `update_goal_movement`, `void_goal_movement` | Aportes y retiros |
| `create_debt`, `update_debt`, `archive_debt`, `delete_debt` | Deudas |
| `register_debt_payment` | Cuota, abono o interés |
| `budget_history`, `monthly_flows`, `spending_by_category`, `planning_snapshot` | Lecturas calculadas (respetan RLS) |
| `financial_summary` (ampliada) | Activos, pasivos, deuda de préstamos, deudas totales, ahorro y % de ahorro del mes |

Cambios en funciones de la Fase 4: `check_movement` (una deuda no recibe
ingresos; interés y desembolso sin límite de saldo; aviso de sobrepago),
`create_transaction` y `update_transaction` (usan la nueva validación),
`create_account` y `update_account` (las deudas se manejan desde Deudas),
`protect_account_owner` y `audit_row_change`.

## 4. Archivos

**Nuevos**
- `supabase/migrations/20261112150000_loan_account_type.sql`, `20261112150100_budgets_goals_debts.sql`
- `supabase/tests/planning.test.sql`
- `src/types/planning.ts`
- `src/services/planning/` — `budgetService.ts`, `goalService.ts`, `debtService.ts`, `planningService.ts`, `mappers.ts`
- `src/features/planning/` — `BudgetForm.tsx`, `GoalForm.tsx`, `GoalMovementForm.tsx`, `DebtForm.tsx`, `DebtPaymentForm.tsx`, `cards.tsx`, `ui.tsx`, `labels.ts`, `validation.ts`, `projections.ts`, `reminders.ts`, `useReminderSync.ts`
- `src/features/planning/screens/` — `BudgetScreens.tsx`, `GoalScreens.tsx`, `DebtScreens.tsx`, `PlanningScreen.tsx`, `AlertsScreen.tsx`
- `src/features/home/PlanningSections.tsx`, `src/lib/notifications.ts`
- Rutas: `budget/[id]`, `budget/edit`, `goal/[id]`, `goal/edit`, `goal/movement`, `debt/[id]`, `debt/edit`, `debt/payment`, `planning`
- `tests/unit/planning-rules.test.ts`, `planning-services.test.ts`, `planning-screens.test.tsx`
- `docs/FASE5.md`, `docs/PRESUPUESTOS_METAS_DEUDAS.md`

**Modificados**
- Datos: `FinanceDataProvider.tsx` (presupuestos, avisos, metas, aportes, deudas, planificación, gasto del mes y sus acciones; las cuentas de deuda van aparte), `summaries.ts`
- Servicios y tipos: `errors.ts` (LJ010–LJ013), `financeService.ts`, `mappers.ts`, `transactionService.ts`, `categoryService.ts`, `database.ts`, `database.check.ts`, `database.generated.ts`, `finance.ts`
- Pantallas: `budgets.tsx`, `savings.tsx`, `debts.tsx`, `notifications.tsx` (datos reales; ejemplo solo en modo demostración), `_layout.tsx`, `profile.tsx`, `category/edit.tsx`, `accounts.tsx`, `statistics.tsx`, `LiveHome.tsx`, `HomeSections.tsx`
- Otros: `confirmations.ts` (sobrepago), `ReconcileForm.tsx` (deudas), `display.ts`, `TransactionItem.tsx`, `institutions.ts`
- `scripts/test-db-local.mjs`, `scripts/test-integration.mjs`, `package.json` (`expo-notifications`, `expo` 58.0.25)

## 5. Pruebas y resultados

| Prueba | Resultado |
| --- | --- |
| `npm run test:db` (PGlite, con y sin permisos automáticos) | 71 + 71 + **106 nuevas** = 248 comprobaciones por variante, todas pasan |
| `npm run test:db:remote` (proyecto real, se deshace al final) | Las 3 suites pasan |
| `npm run test:integration` (API real, usuarios de prueba) | **36/36** (8 nuevas de la Fase 5) |
| `npm test` | **191/191** en 15 suites (44 nuevas) |
| `npm run typecheck` · `npm run lint` | Sin errores |
| `npx expo-doctor` | 20/20 |
| `npm run bundle:ios` | Compila |
| `npm run db:advisors` | Solo «Leaked Password Protection» (requiere plan Pro) |

**Escenarios obligatorios** (en `planning.test.sql` y por la API):
- Presupuesto 500.000 con gastos 100.000 + 150.000 → gastado 250.000, disponible 250.000, 50 %; la transferencia no lo afecta. ✓
- Meta 8.000.000 con 2.000.000 + aporte 500.000 → 2.500.000, faltan 5.500.000, 31,25 %; patrimonio igual. ✓
- Deuda 5.000.000 con pago 500.000 → pendiente 4.500.000, pagado 500.000, la cuenta baja 500.000. ✓
- Activos 10.000.000 − pasivos 3.000.000 = 7.000.000; transferencias propias no lo cambian. ✓
- Tarjeta cupo 3.000.000, deuda 500.000 + compra 200.000 → 700.000 y disponible 2.300.000; pago 200.000 → 500.000, banco −200.000, sin un segundo gasto. ✓
- Crear, editar, archivar, revertir, idempotencia, sobrepago, metas vencidas y superadas, avisos sin repetir, umbrales configurables. ✓
- Cerrar sesión y volver a entrar recupera presupuesto, meta y deuda (API). ✓
- Aislamiento: el otro usuario no ve ni modifica nada (SQL y API); sin sesión no se lee ni se ejecuta nada. ✓

## 6. Errores encontrados y solucionados

- Las pruebas de integración insertaban una categoría sin `user_id` y el RLS la rechazó: la app sí lo envía; se corrigió la prueba y se añadió limpieza de restos de corridas fallidas.
- El aviso de sobrepago se probaba con un pago que además dejaba la cuenta en negativo (salía LJ001 primero): se separaron las confirmaciones (`p_allow_negative` y `p_allow_overpay`).
- Conteos de auditoría y aportes mal estimados en la primera versión de las pruebas SQL: corregidos al valor real.
- Lint: lectura del permiso de notificaciones con `setState` dentro de un efecto; se reescribió con una promesa y versión.
- `expo-doctor` pidió `expo` 58.0.25 (parche del mismo SDK): actualizado con `npx expo install --fix`.

## 7. Configuración pendiente y limitaciones

- **Notificaciones:** son locales y, según la documentación de Expo, funcionan en Expo Go en iOS; **aún no están probadas en tu iPhone**. Las push remotas (desde un servidor) requerirían un development build y no se usan.
- Las categorías del sistema traen marcas fijas/esenciales por defecto y no se editan; las propias sí.
- La proyección no incluye intereses futuros ni rendimientos (se dice en pantalla).
- Siguen pendientes de antes: SMTP propio, protección de contraseñas filtradas (plan Pro), Face ID con development build.

## 8. Probar en tu iPhone

1. `npm.cmd run start:tunnel` y abrir LUJITOS en Expo Go.
2. Perfil → **Presupuestos** → crear uno general mensual y otro de Alimentación; registrar gastos y ver el % y los avisos.
3. **Metas** → crear una con cuenta y fecha; aportar (con y sin mover dinero), editar y revertir.
4. **Deudas** → registrar un préstamo con cuota mensual; pagar una cuota (con intereses), un abono y un interés; revisar el historial.
5. **Planificación** → revisar capacidad de ahorro y proyección (saldrá preliminar).
6. **Avisos** → activar «Recordatorios en este iPhone», aceptar el permiso y confirmar que llega una notificación (por ejemplo, una cuota de mañana).
7. Volver a **Inicio**: presupuesto, gasto por categoría, metas, deudas y próximos pagos.
