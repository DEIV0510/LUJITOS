# LUJITOS — Reporte de la Fase 4

Sistema real de cuentas, movimientos y control de dinero. Fecha: 2026-11-11.
**Estado:** implementada y probada (SQL local y en tu proyecto real, API real y pantallas en
pruebas). **Falta la prueba en tu iPhone** (sección 10).

## Revisión de la Fase 3 (antes de empezar)

La Fase 3 estaba completa: 7 tablas con RLS, auditoría, sesión en el llavero y saldos
calculados. Encontré y corregí cuatro huecos de integridad:

| Problema | Riesgo | Corrección |
| --- | --- | --- |
| La app podía escribir cuentas y movimientos directo en las tablas | Editar un monto o «des-anular» sin validaciones de varios pasos | Escrituras solo por funciones RPC; la app ya no tiene permiso de INSERT/UPDATE |
| Al editar un movimiento se podía mover a una cuenta archivada | Movimientos nuevos en cuentas cerradas | El trigger valida también al cambiar de cuenta |
| El saldo inicial se podía cambiar con movimientos ya registrados | Reescribir el historial sin dejar rastro | Bloqueado; se corrige con «Ajustar saldo» |
| Sin regla del signo del saldo inicial | Tarjetas con «deuda» positiva o cuentas negativas al crearlas | Tarjeta ≤ 0 (deuda), demás cuentas ≥ 0 |

## 1. Funcionalidades implementadas

- **Cuentas:**
  - Crear y editar con nombre, entidad de la lista o escrita a mano, tipo, saldo inicial, moneda, últimos 4 dígitos, color, ícono y descripción.
  - Ejemplos rápidos de un toque.
  - Tipos: bancaria, ahorros, corriente, billetera, efectivo, inversión, CDT, fondo, tarjeta de crédito y personalizada.
  - Entidades: Bancolombia, Davivienda, BBVA, Banco de Bogotá, Caja Social, Nu, Nequi y Daviplata, o cualquier otra escrita a mano.
  - Tarjetas: deuda inicial, cupo total, día de corte y día de pago.
  - Archivar avisa si la cuenta tiene saldo y conserva el historial; se puede reactivar.
- **Mis cuentas:**
  - Saldo total, dinero disponible, bancos, billeteras, efectivo, invertido y deuda en tarjetas.
  - Una tarjeta por cuenta con entidad, tipo, saldo, estado y fecha de última actualización.
  - Sección de cuentas archivadas.
  - Botón para ocultar los saldos.
- **Detalle de cuenta:**
  - Resumen: saldo inicial, saldo actual, ingresos, gastos, transferencias, ajustes y cantidad de movimientos.
  - Gráfico de evolución por semana, mes, 3 meses, 6 meses o año.
  - Movimientos de esa cuenta.
  - Acciones: ingreso o gasto (compra y pago en tarjetas), transferir, ajustar saldo, editar y archivar.
  - En tarjetas: cupo total, utilizado, disponible, % de utilización, deuda, próximo corte y pago límite.
- **Movimientos:**
  - Ingreso, gasto, transferencia y ajuste, en un formulario adaptado a cada uno: monto primero, cuenta, categoría, fecha, comercio u origen, descripción y notas.
  - Categorías personalizadas creadas desde el mismo formulario.
  - Advertencias que se pueden confirmar: saldo que quedaría negativo, compra que supera el cupo, transferencia repetida.
- **Editar y anular:**
  - Editar recalcula los saldos.
  - Anular pide un motivo opcional, revierte el efecto (una transferencia restaura las dos cuentas) y conserva el registro tachado.
- **Ajuste de saldo:**
  - Escribes el saldo (o la deuda) real, ves la diferencia y escribes el motivo.
  - Al confirmar se registra un movimiento de ajuste.
  - Si el saldo cambió mientras ajustabas, pide revisar de nuevo.
- **Historial:**
  - Agrupado por mes y día.
  - Filtros: tipo (todos, ingresos, gastos, transferencias, ajustes), cuenta, categoría, fecha inicial y final, valor mínimo y máximo, incluir anulados.
  - Búsqueda por descripción y comercio, sin importar tildes.
- **Categorías:** crear, editar (nombre, ícono, color), archivar y reactivar. Borrar una con movimientos exige elegir a cuál pasan. Las predeterminadas se conservan, más «Intereses y comisiones» para tarjetas.
- **Tarjetas de crédito:** pantalla con tus tarjetas reales (la de demostración queda solo en modo demo).
- **Panel de inicio:**
  - Patrimonio neto, disponible con desglose (bancos, billeteras, efectivo), invertido, deudas, ingresos y gastos del mes y últimos movimientos.
  - Todo viene del servidor y se actualiza después de cada operación.
- **Selectores sin animación**, como pediste.

## 2. Tablas modificadas o creadas

No se creó ninguna tabla. Se ampliaron:

| Tabla / tipo | Cambio |
| --- | --- |
| `account_type` (enum) | + `cdt`, `investment_fund` |
| `accounts` | + `institution_name`, `description`, `statement_day`, `payment_due_day`, `client_request_id`; reglas de signo del saldo inicial y de días solo en tarjetas |
| `transactions` | + `void_reason`, `client_request_id` (único por usuario) |
| `categories` | + `archived_at`; + categoría del sistema «Intereses y comisiones» |
| Vista `account_balances` | + ingresos, gastos, transferencias recibidas/enviadas, ajustes y fecha del último movimiento |
| Esquema `private` | Nuevo, no publicado en la API: implementaciones con privilegios y funciones auxiliares |

## 3. Migraciones SQL (aplicadas en tu proyecto)

| Migración | Contenido |
| --- | --- |
| `20261112090000_account_types_extension.sql` | CDT y fondo de inversión |
| `20261112090100_finance_engine.sql` | Regla única de saldos, columnas nuevas, validaciones, funciones RPC, resumen e historial, permisos |
| `20261112090200_rpc_private_impl.sql` | Funciones con privilegios al esquema `private`; en la API, envoltorios sin privilegios |

## 4. Funciones RPC

| Función | Qué hace |
| --- | --- |
| `create_account` / `update_account` | Crear o editar; valida entidad, tipo, signo del saldo y cupo; idempotente |
| `archive_account` / `restore_account` | Archivar (avisa con saldo, LJ004) o reactivar |
| `create_transaction` | Ingreso, gasto o transferencia; bloquea las cuentas, valida dueño, cuenta activa, fecha, monto, saldo y cupo; evita duplicados |
| `update_transaction` | Editar con las mismas validaciones (sin contar el movimiento que se edita) |
| `void_transaction` | Anular con motivo; repetir la solicitud no cambia nada |
| `reconcile_account` | Ajuste por diferencia con el saldo real, con motivo; detecta saldo cambiado (LJ005) |
| `delete_category` | Borrar una categoría propia; con movimientos exige reasignarlos (LJ009) |
| `financial_summary` | Disponible, bancos, billeteras, efectivo, invertido, deuda, cupo, patrimonio, ingresos y gastos del mes |
| `account_balance_history` | Saldo al cierre de cada día (gráfico), hasta 400 días |
| `transaction_effect` | La única regla contable: cuánto suma o resta un movimiento a una cuenta |

## 5. Componentes creados

- **Cuentas (`src/features/accounts/`):**
  - `AccountForm` (crear y editar), `display` (identificador, deuda, cupo, próxima fecha), `history` (periodos del gráfico) y `validation`.
- **Movimientos (`src/features/transactions/`):**
  - `TransactionForm` (4 tipos y edición), `ReconcileForm` (ajuste), `filters` (búsqueda, filtros, agrupación), `parts` y `validation`.
- **Advertencias:** `src/features/finance/confirmations.ts` pregunta al usuario por las advertencias del servidor.
- **Componentes comunes (`src/components/ui/`):** `SuccessView` (confirmación) y `Pickers` (color, ícono, día del mes).
- **Hook:** `src/hooks/accounts/useBalanceHistory`.
- **Pantallas nuevas:** `account/edit`, `transaction/edit`, `categories`, `category/edit`.
- **Pantallas reescritas:** Mis cuentas, detalle de cuenta, detalle de movimiento, historial y tarjetas.
- **Pantallas actualizadas:** `AccountCard`, `TransactionItem`, `BalanceCard` y el inicio.

## 6. Servicios implementados

- **`src/services/accounts/accountService.ts`:** leer cuentas y saldos; crear, editar, archivar y reactivar.
- **`src/services/transactions/transactionService.ts`:** leer movimientos (con anulados); crear, editar, anular y ajustar saldo.
- **`src/services/categories/categoryService.ts`:** leer, crear, editar, archivar y borrar con reasignación.
- **`src/services/finance/`:**
  - `financeService`: resumen e historial.
  - `errors`: traduce los códigos LJ y conserva el dato del aviso.
  - `mappers`: convierte las filas al modelo de la app.
- **`src/lib/ids.ts`:** clave de idempotencia con `expo-crypto`.

Dependencia nueva: `expo-crypto` ~58.0.8. Además, 10 paquetes de Expo se alinearon a su versión de parche del mismo SDK 58 (lo pedía `expo-doctor`).

## 7. Pruebas realizadas

| Prueba | Qué cubre |
| --- | --- |
| `supabase/tests/finance_engine.test.sql` (71) | Los 8 casos del brief, resumen financiero, saldo insuficiente, cupo, transferencia repetida, idempotencia, validaciones del servidor, ajuste de saldo, reglas de cuentas, archivar, categorías, historial, aislamiento entre usuarios, visitante sin sesión |
| `supabase/tests/rls_security.test.sql` (71) | RLS de la Fase 3 adaptado: la app ya no escribe directo; un usuario no puede editar, anular, archivar ni ajustar lo de otro |
| `scripts/test-integration.mjs` (28) | Por la API real: lo anterior más motor financiero (aviso con saldo resultante, doble envío, pago de tarjeta, editar, anular, ajustar, historial) |
| Unitarias (147 en 12 archivos) | Filtros y búsqueda, tarjetas y fechas de corte, validaciones, gráfico, errores LJ, confirmaciones, envío a las RPC, resumen y 16 pantallas dibujadas con datos de ejemplo |
| TypeScript, ESLint, bundle de iOS, `expo-doctor` | Tipos (incluida la comparación con la base real), estilo, compilación y versiones |

Se comprobó que las pruebas detectan fallos rompiendo el código a propósito: una transferencia que no acredita el destino y un gasto sin aviso de saldo negativo.

## 8. Resultados

| Prueba | Resultado |
| --- | --- |
| SQL local, con y sin permisos automáticos | 71/71 seguridad · 71/71 motor (ambos modos) |
| SQL en tu proyecto real | Seguridad y motor: todas pasaron (se deshacen al final) |
| Integración por la API real | 28/28 |
| Unitarias | 147/147 |
| TypeScript · ESLint | 0 errores · 0 avisos |
| Bundle de iOS | Compila (1.908 módulos) |
| `expo-doctor` | 20/20 |
| Avisos de Supabase | 1: protección de contraseñas filtradas (solo plan Pro) |

**Casos del brief (en la base real):**

| Caso | Resultado |
| --- | --- |
| 1. Ingreso | 1.000.000 + 200.000 = 1.200.000 ✓ |
| 2. Gasto | 1.000.000 − 150.000 = 850.000 ✓ |
| 3. Transferencia | Bancolombia 1.800.000 y Nequi 700.000; total 2.500.000 ✓ |
| 4. Tarjeta | Deuda 700.000; disponible 2.300.000 ✓ |
| 5. Pago de tarjeta | Banco 800.000 y deuda 500.000; el gasto del mes no cambia ✓ |
| 6. Edición | Cambiar 100.000 por 60.000 deja el saldo en 790.000 ✓ |
| 7. Anulación | Anular una transferencia restaura las dos cuentas ✓ |
| 8. Seguridad | Un usuario no consulta, edita, anula, ajusta ni transfiere con cuentas de otro ✓ |

## 9. Errores encontrados y solucionados

1. **Los cuatro huecos de la Fase 3** de la tabla inicial.
2. **9 avisos de seguridad de Supabase:** había funciones con privilegios publicadas en la API. Se movieron al esquema `private`, con envoltorios sin privilegios; quedó 1 aviso (plan Pro).
3. **Comparación de tipos:** la vista de saldos tiene una fecha que puede ser nula y la comprobación no lo contemplaba.
4. **Dependencia circular** entre los formularios de movimiento y de ajuste (Metro avisa): las piezas compartidas pasaron a `parts.tsx`.
5. **Servicios que cargaban el tema completo** (y con él AsyncStorage) solo para la lista de colores.
6. **Metro se detuvo** al reanudar la sesión: se reinició con la caché limpia y regeneró las rutas tipadas.
7. **Versiones de parche nuevas del SDK 58** señaladas por `expo-doctor`: alineadas.

## 10. Probar en tu iPhone

1. El túnel ya está encendido en el PC. Abre Expo Go y entra a LUJITOS; si sale «Gateway Timeout», toca *Reload JS*.
2. **Cuenta:** Mis cuentas → + → toca el ejemplo «Ahorros Bancolombia», saldo 1.000.000 → Guardar.
3. **Ingreso:** en la cuenta → Ingreso → 200.000, categoría Salario → el saldo queda en 1.200.000.
4. **Gasto:** + → Gasto → 150.000 → el saldo baja. Prueba un gasto mayor al saldo: debe preguntarte.
5. **Transferencia:** crea Nequi con 500.000 y transfiere 200.000 desde Bancolombia. Ambos saldos cambian y el total no.
6. **Tarjeta:** crea una tarjeta con deuda 500.000 y cupo 3.000.000. Registra una compra de 200.000 y luego «Pagar» 200.000 desde Bancolombia.
7. **Editar y anular:** abre un movimiento → Editar → cambia el valor. Anula una transferencia: las dos cuentas vuelven.
8. **Ajustar saldo:** en una cuenta → Ajustar saldo → escribe el saldo real y un motivo → confirma.
9. **Historial:** Movimientos → busca «mercado», filtra por Ajustes y prueba «Más filtros».
10. **Categorías:** Configuración → Categorías → crea una, archívala y borra otra con movimientos (te pide a cuál pasarlos).
11. **Inicio:** revisa patrimonio, disponible, deudas y el mes; el ojo oculta los montos.

No se avanza a la Fase 5 sin tu autorización.
