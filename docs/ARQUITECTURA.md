# LUJITOS — Arquitectura técnica

Decisiones tomadas en la Fase 1 (10 de noviembre de 2026). Cada versión se comprobó
contra `expo@58.0.23` (`bundledNativeModules.json`) y la documentación oficial del SDK 58.

## 1. Plataforma

| Pieza | Versión | Motivo |
| --- | --- | --- |
| Expo SDK | 58 (`expo ~58.0.23`) | Último SDK estable y el único que abre el Expo Go actual de iOS (58.0.7). |
| React Native | 0.88.1 | Nueva arquitectura y Hermes, ambas por defecto. |
| React | 19.3.0 | Fijado por el SDK. `react-dom` se fija igual para evitar choques de versiones. |
| TypeScript | 6.0 | `strict` + `noUncheckedIndexedAccess`: un índice que no existe no pasa como número. |
| Expo Router | ~58.0.30 | Rutas por archivos en `src/app`, rutas tipadas activadas. |
| Reanimated | 4.7.1 + worklets 0.13.0 | Animaciones en el hilo de interfaz. |

Solo iPhone: `platforms: ["ios"]`, `supportsTablet: false`, orientación vertical,
modo claro y oscuro automático. Identificador provisional: `com.lujitos.finance`.

## 2. Expo Go o compilación propia

Las fases 1 a 9 se prueban en **Expo Go**. Dos cosas obligan a crear una compilación
de desarrollo con EAS (requiere cuenta de Apple Developer, 99 USD al año):

- **Face ID**: Expo Go no lo soporta en iOS (documentación de `expo-local-authentication`).
- Publicar en App Store (Fase 12) y cualquier librería nativa que no venga en Expo Go.

Las notificaciones locales y remotas sí funcionan en Expo Go para iOS.

## 3. Estilos: tokens propios, sin NativeWind

Se descartó NativeWind por ahora:

- La versión estable (4.2.7) depende de Tailwind 3, una línea que ya se reemplazó.
- La versión 5 sigue en candidata (`5.0.0-rc.1`, 2 de noviembre de 2026). La base visual
  de una app financiera no debe depender de una versión sin cerrar.
- Reanimated y los gráficos necesitan los valores crudos del tema; con Tailwind habría
  que duplicarlos.

En su lugar, el sistema de diseño vive en `src/theme/` (`colors.ts`, `typography.ts`,
`spacing.ts`, `radius.ts`, `shadows.ts`, `ThemeProvider.tsx`) y se lee con `useAppTheme()`.
Las pantallas nunca escriben colores sueltos: usan nombres semánticos (`surface`,
`textSecondary`, `positive`…). Si NativeWind 5 sale estable, migrar es barato.
Detalle de la identidad: [DISENO.md](DISENO.md).

## 4. Estructura

```
src/
  app/                Solo rutas (Expo Router). Cada archivo es una pantalla.
  components/
    ui/               Primitivas: AppText, Icon, botones, tarjeta, filas, hoja inferior,
                      control segmentado, estados vacío/carga, aviso de demostración.
    finance/          BalanceCard, AccountCard, TransactionItem, CategoryIcon,
                      BudgetProgress, SavingsProgress, MoneyInput, MetricCard, AmountText.
    charts/           ChartCard, BarChart, LineChart, DonutChart, StackedBar (SVG).
    navigation/       BottomNavigation y botón flotante «Agregar».
    brand/            Símbolo, logotipo y apertura animada.
    layout/           Screen (áreas seguras) y encabezados.
    calendar/         CalendarGrid.
  features/
    demo/             DATOS FICTICIOS (data.ts) y sus consultas (selectors.ts).
    home/             Secciones del Inicio.
    transactions/     Formulario de registro.
    advisor/          Respuestas de ejemplo del asesor.
    privacy/          Ocultar o mostrar montos en toda la app.
    data/             FinanceDataProvider (real/demo), summaries.ts, ComingSoon.
    auth/             Validaciones (Zod), componentes y protección de rutas.
  hooks/auth/         AuthProvider + useAuth: sesión, perfil y estados.
  services/auth/      Registro, inicio y cierre de sesión, recuperación, enlaces.
  services/database/  Perfil, preferencias, cuentas, categorías y movimientos.
  lib/                money.ts, dates.ts, haptics.ts, supabase.ts, supabase-storage.ts.
  constants/          app.ts, categories.ts, institutions.ts.
  types/              finance.ts (modelo de la app), database.ts (tablas, escrito a mano),
                      database.generated.ts (desde la base real) y database.check.ts.
  utils/              color.ts.
  theme/              Sistema de diseño.
assets/images/        icon.png (1024, sin transparencia) y splash-icon.png.
supabase/             config.toml (auth), migrations/ (6 migraciones), tests/ (RLS y auditoría).
scripts/              Pruebas de base local e integración, usuarios de prueba.
tests/unit/           Pruebas unitarias (jest-expo).
docs/                 ARQUITECTURA.md, DISENO.md.
```

Se usa `src/app` en lugar de `app/` en la raíz porque es la convención actual de Expo
y deja todo el código bajo un mismo alias (`@/…`).

### Rutas

```
src/app/
  _layout.tsx               Fuentes, tema, privacidad, pila de navegación y apertura
  (tabs)/_layout.tsx        Barra inferior propia + botón flotante
  (tabs)/index              Inicio
  (tabs)/accounts           Mis cuentas
  (tabs)/transactions       Mis movimientos
  (tabs)/statistics         Estadísticas
  (tabs)/assistant          Asesor IA (vista previa)
  account/[id]  account/new           Detalle de cuenta · nueva cuenta (hoja modal)
  transaction/[id]  transaction/new   Detalle de movimiento · registro rápido (hoja modal)
  profile  notifications  settings
  budgets  savings  debts  cards  calendar  recurring
  (auth)/welcome · sign-in · sign-up · check-email · forgot-password
  onboarding                5 pasos tras el primer registro
  reset-password            Destino del enlace de recuperación
  auth/callback             Destino del enlace de confirmación
  legal                     Términos y privacidad
```

Las pantallas privadas viven en el grupo `(app)` (no cambia ninguna dirección). El
layout raíz usa `Stack.Protected` con `navigationGuards()` (`src/features/auth/navigation.ts`):

| Estado | Zona accesible |
| --- | --- |
| Cargando sesión | Ninguna: se mantiene la apertura animada |
| Sin sesión | `(auth)` (con «Tu sesión terminó» si venció o se revocó sin que el usuario la cerrara) |
| Con sesión, sin onboarding | `onboarding` |
| Con sesión y onboarding | `(app)` |
| Recuperación de contraseña | Solo `reset-password` |
| Sesión guardada sin internet | «Sin conexión» con «Reintentar»: la sesión no se borra |
| Sin variables de Supabase | Guía de configuración |

Mensajes en español para cada caso (`src/services/auth/authErrors.ts`,
`src/services/database/errors.ts`): sin conexión, credenciales incorrectas, sesión
vencida, error de base de datos, correo ya registrado (Supabase no da error en ese caso:
se detecta por el usuario sin identidades), correo sin confirmar (con «Reenviar»), enlace
vencido o abierto en otro dispositivo, límite de intentos y operación exitosa. Nunca se
muestra el mensaje técnico. Los errores técnicos se registran con `logError()`
(`src/lib/logger.ts`): contexto, tipo, código y mensaje sin correos, tokens, claves, IDs
ni números de 4+ cifras; solo en desarrollo hasta la Fase 11.

Barra inferior propia (no la nativa de iOS) porque necesita el botón flotante de
«Agregar» y el indicador de la marca. Respeta el área segura inferior.

### Datos reales y datos de demostración

`FinanceDataProvider` (`src/features/data`) es la única fuente de datos de las pantallas:

- **Modo real (por defecto):** cuentas (con saldo de la vista `account_balances`),
  categorías y movimientos del usuario en Supabase. Sin cuentas → estado vacío con
  «Agregar cuenta».
- **Modo demostración:** datos ficticios de `src/features/demo`, siempre con aviso y
  botón para volver. Se activa en Configuración. Nunca se mezcla con lo real.

Inicio, Cuentas, Movimientos, detalle de cuenta/movimiento y los formularios funcionan
con datos reales. Estadísticas y los módulos de las fases 6–8 muestran «Llega en la Fase X»
en modo real (`LiveGate`). El proveedor se monta con `key` = id de usuario: al cambiar de
usuario no puede quedar ningún dato del anterior en memoria.

## 5. Dinero y cálculos (regla de la casa)

- **Pesos colombianos enteros en todas partes** (decisión de la Fase 3): `BIGINT` en la
  base y enteros en la app. COP no usa centavos en la práctica y así no hay conversiones.
  Los enteros de JavaScript son exactos hasta 9 × 10¹⁵. Formato y lectura en `src/lib/money.ts`.
- Los importes de movimientos son siempre positivos (`CHECK amount > 0`); el tipo define
  si suma o resta. Los ajustes llevan `adjustment_sign` (+1/−1).
- **Saldo actual** = saldo inicial + ingresos + transferencias recibidas − gastos −
  transferencias enviadas ± ajustes. Se calcula SIEMPRE en PostgreSQL con una única regla
  (`public.transaction_effect`), que usan la vista `account_balances`, el historial del
  gráfico (`account_balance_history`) y las validaciones. No hay saldos guardados aparte
  (`account_snapshots` queda sin uso para no tener dos verdades).
- **Tarjetas**: el saldo es negativo = deuda. Compra (gasto) la aumenta; intereses y comisiones
  son gastos con su categoría; el pago es una transferencia banco → tarjeta (reduce la deuda y
  el banco, no es gasto). Cupo disponible = cupo − deuda. El cupo nunca suma al patrimonio.
- **Resumen** (`financial_summary`): disponible = bancos + billeteras + efectivo; invertido =
  inversión + CDT + fondos; deuda = tarjetas; patrimonio neto = suma de saldos de cuentas
  activas (las tarjetas restan). Ingresos y gastos del mes excluyen transferencias y ajustes.
- **Transferencias** entre cuentas propias: no cuentan como ingreso ni gasto.
- **Tarjetas de crédito**: la compra es el gasto (aumenta la deuda de la tarjeta). El pago
  de la tarjeta es una transferencia de la cuenta bancaria a la tarjeta, no otro gasto.
  Así nada se cuenta dos veces.
- **Fechas**: `transaction_date` es `date` (día de Bogotá); marcas de tiempo en `timestamptz`.
- **Integridad histórica**: las cuentas no se borran, se archivan (`is_active`, `archived_at`);
  los movimientos se ANULAN (`deleted_at` + `void_reason`) y dejan de contar. Un anulado no se
  edita. El saldo inicial no cambia si la cuenta ya tiene movimientos (se corrige con
  «Ajustar saldo», que registra la diferencia con su motivo).
- **Cuentas de otros usuarios**: los movimientos y los históricos usan claves foráneas
  compuestas `(account_id, user_id)`: aunque alguien conozca el UUID de una cuenta ajena,
  la base rechaza la referencia.

## 6. Base de datos (Fases 3, 4 y 5)

Tablas creadas (todas con RLS): `profiles`, `accounts`, `categories`, `transactions`,
`account_snapshots`, `user_preferences`, `audit_logs`, `budgets`, `budget_alerts`,
`savings_goals`, `savings_goal_movements`, `debts`, más las vistas (security_invoker)
`account_balances`, `budget_status`, `savings_goal_progress` y `debt_overview`.
Pendientes para sus fases: `recurring_transactions`, `import_batches`,
`institution_connections`, `transaction_rules`. Guía completa: [SUPABASE.md](SUPABASE.md).

**Fase 5.** Las deudas son cuentas de tipo `loan` (saldo negativo = lo que se debe) más una
fila en `debts` con sus datos: un pago es una transferencia y un interés es un gasto, así
que la regla única de saldos, el patrimonio y los presupuestos funcionan sin casos
especiales y nada se cuenta dos veces. `transactions.purpose` solo etiqueta (cuota, abono,
interés, aporte, retiro). Las metas guardan asignaciones (no dinero); si se mueve dinero, la
transferencia queda enlazada al aporte y un trigger los mantiene alineados. Lo gastado,
ahorrado y pendiente se calcula en las vistas; los avisos de presupuesto los escribe un
trigger una sola vez por período. Escrituras solo por RPC (mismo patrón `private`/`public`).
Las cuentas `loan` no aparecen en Mis cuentas ni en los formularios de movimientos: se
manejan desde Deudas. Fórmulas: [PRESUPUESTOS_METAS_DEUDAS.md](PRESUPUESTOS_METAS_DEUDAS.md).

| Tabla | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| profiles | propio | solo el trigger de registro | propio, columnas permitidas (no el correo) | no |
| user_preferences | propias | solo el trigger | propias, columnas permitidas | no |
| accounts | propias | solo RPC `create_account` | solo RPC `update_account` / `archive_account` | no: se archivan |
| categories | sistema + propias | propias (nunca del sistema) | propias (archivar) | RPC `delete_category` (reasigna) |
| transactions | propios | solo RPC `create_transaction` / `reconcile_account` | solo RPC `update_transaction` / `void_transaction` | no: anulación |
| account_snapshots | propios | propios | no | no |
| audit_logs | propios | no: solo triggers | no | no |
| budgets | propios | solo RPC `create_budget` | solo RPC `update_budget` / `archive_budget` | RPC `delete_budget` (no toca movimientos) |
| budget_alerts | propios | no: solo el trigger de avisos | solo `seen_at` (marcar visto) | en cascada con su presupuesto |
| savings_goals | propias | solo RPC `create_savings_goal` | solo RPC `update_savings_goal` / `archive_savings_goal` | RPC `delete_savings_goal` (sin aportes) |
| savings_goal_movements | propios | solo RPC `add_goal_movement` | solo RPC `update_goal_movement` / `void_goal_movement` | no: se revierten |
| debts | propias | solo RPC `create_debt` | solo RPC `update_debt` / `archive_debt` | RPC `delete_debt` (sin movimientos) |

**Motor financiero (Fase 4).** Toda escritura de cuentas y movimientos pasa por funciones
RPC (`supabase/migrations/20261112090100_finance_engine.sql`). Cada una toma el usuario de
`auth.uid()` (nunca de la app), comprueba que todas las cuentas sean suyas y estén activas,
bloquea las cuentas involucradas en orden fijo (`FOR UPDATE`: dos operaciones simultáneas no
se cruzan ni se bloquean entre sí), valida montos, fechas, categorías y cupos, y acepta una
clave de idempotencia (`client_request_id`): un doble toque o un reintento no duplica. Las
implementaciones SECURITY DEFINER viven en el esquema `private` (la API no lo publica); en
`public` quedan envoltorios SECURITY INVOKER. Advertencias confirmables: `LJ001` saldo
negativo, `LJ002` cupo, `LJ003` transferencia repetida en 2 minutos, `LJ004` archivar con
saldo; errores: `LJ005`–`LJ009` (`src/services/finance/errors.ts`).

**Auditoría (`audit_logs`).** Triggers SECURITY DEFINER anotan registro, confirmación de
correo, inicio de sesión, cambio de contraseña y de correo (desde `auth.users`); cuentas
creadas, editadas, archivadas o reactivadas; movimientos creados, editados, borrados
(lógico) o restaurados; categorías propias; perfil y preferencias. Solo guarda la acción,
el UUID del registro y los **nombres** de los campos cambiados: nunca montos, textos,
nombres, correos, contraseñas ni tokens. Lo rechazado no se anota (se deshace con la
operación). Si falla la anotación de un evento de Auth, el acceso no se bloquea. Se borra en
cascada con el usuario.

**Por qué no hay DELETE en datos financieros.** El brief pide integridad histórica y no
borrar movimientos de forma irreversible sin una estrategia explícita. La estrategia es:
cuentas archivadas (`is_active = false`, `archived_at`) y movimientos con borrado lógico
(`deleted_at`), ambos reversibles y auditados. El borrado definitivo solo ocurre al
eliminar el usuario (derecho de supresión, en cascada).

El rol anónimo no tiene ningún permiso sobre estas tablas. Los permisos se conceden de
forma explícita en la migración de RLS (primero `revoke all`, luego solo lo necesario a
`authenticated`), así que no dependen de «Automatically expose new tables»: el proyecto se
creó con esa opción apagada y `npm run test:db` prueba ambos casos. Validaciones del lado de la
base: montos positivos, forma de transferencias (origen ≠ destino, sin categoría),
categoría obligatoria y del tipo correcto en ingresos/gastos, sin movimientos nuevos en
cuentas archivadas, dueño inmutable.

Validación en la app con Zod 4 (`src/features/auth/validation.ts`). React Hook Form no se
instaló: los formularios actuales no lo necesitan.

## 7. Seguridad

- RLS en todas las tablas: cada fila tiene `user_id` y solo la ve `auth.uid()`.
- En la app solo va la clave pública de Supabase (`EXPO_PUBLIC_…`). La clave de servicio
  y la de Claude viven como secretos de Edge Functions, nunca en el teléfono.
- Sesión: **solo en el llavero de iOS** (Expo SecureStore, accesible tras el primer
  desbloqueo y solo en este dispositivo). Como iOS puede rechazar valores grandes, la sesión
  se parte en trozos de 1.800 caracteres (`src/lib/supabase-storage.ts`). Nunca en AsyncStorage.
- «Recordar sesión» desactivado: la sesión vive solo en memoria.
- Renovación automática del token solo con la app en primer plano (`AppState`), flujo PKCE
  en los enlaces de correo y nada de la sesión en los logs.
- Nunca contraseñas de bancos, nunca número completo de tarjeta (solo los últimos 4).
- Sin scraping bancario. Conexiones solo por Open Finance con entidades compatibles (Fase 10).
- Asesor IA: consentimiento explícito y datos mínimos (totales y categorías, no el detalle
  completo), siempre a través de una Edge Function.
- Exportar y borrar todos los datos del usuario desde Configuración.

## 8. Compatibilidad comprobada (SDK 58)

| Paquete | Versión | Expo Go iOS | Se instala en |
| --- | --- | --- | --- |
| expo-router | ~58.0.30 | Sí | Instalado |
| react-native-reanimated / worklets | 4.7.1 / 0.13.0 | Sí | Instalado |
| react-native-safe-area-context | ~5.11.1 | Sí | Instalado |
| react-native-screens | ~4.30.1 | Sí | Instalado |
| expo-font + @expo-google-fonts/inter | ~58.0.11 / 0.4.2 | Sí | Instalado (Fase 2) |
| react-native-svg | 15.16.0 | Sí | Instalado (Fase 2): símbolo y gráficos |
| expo-symbols | ~58.0.4 | Sí | Instalado (Fase 2): íconos SF Symbols |
| expo-haptics | ~58.0.7 | Sí | Instalado (Fase 2) |
| expo-splash-screen / expo-system-ui | ~58.0.13 / ~58.0.7 | Sí | Instalado (Fase 2) |
| @react-native-async-storage/async-storage | 2.2.0 | Sí | Instalado (Fase 2): preferencia de tema |
| @supabase/supabase-js | 2.119.0 (JS) | Sí | Instalado (Fase 3) |
| expo-secure-store | ~58.0.2 | Sí | Instalado (Fase 3): sesión en el llavero |
| react-native-url-polyfill | 4.0.0 (JS) | Sí | Instalado (Fase 3): lo exige la guía de Supabase |
| expo-local-authentication | ~58.0.2 | Sin Face ID | Fase 3 / 11 |
| react-hook-form | 7.91.0 (JS) | Sí | Fase 5 |
| zod | 4.6.7 (JS) | Sí | Instalado (Fase 3): validaciones |
| jest-expo + jest 30 | ~58.0.14 | — | Instalado (Fase 3, desarrollo) |
| @electric-sql/pglite | 0.5.16 | — | Instalado (Fase 3, desarrollo): pruebas SQL locales |
| @testing-library/react-native | 14.1.0 | — | Instalado (Fase 3, desarrollo): pruebas de navegación |
| expo-notifications | ~58.1.8 | Sí | Fase 7 |
| @shopify/react-native-skia | 2.14.0 | Sí | Solo si los gráficos SVG se quedan cortos |
| expo-image-picker / expo-camera | ~58.0.10 / ~58.0.14 | Sí | Fase 10 |
| eas-cli | 27.7.2 | — | Con `npx`, Fase 12 |

Regla: instalar siempre con `npx expo install <paquete>`, que elige la versión del SDK.

## 9. Calidad

- `npm run check`: TypeScript + ESLint + unitarias + SQL local. Debe quedar en cero antes
  de cada entrega. El TypeScript incluye `src/types/database.check.ts`, que compara los
  tipos escritos a mano con los generados desde la base real (`npm run db:types`).
- `npx expo-doctor`: configuración y versiones.
- `npm run bundle:ios`: compila el bundle real de iOS (Hermes) para detectar errores
  que el editor no ve.
- `npm test`: 95 pruebas unitarias (validaciones, sesión en el llavero, flujos de auth,
  estados de sesión de `AuthProvider`, registro de errores, onboarding, protección de
  rutas, reglas contables). `tests/unit/navigation-router.test.tsx` abre la
  app con el router real (`expo-router/testing-library`) en cada estado de sesión y
  dirección: así se detectó y corrigió «Unmatched Route» al abrir sin sesión.
- Rutas protegidas: cada `Stack.Protected` lleva `redirectTo` a la pantalla del estado
  actual (`navigationGuards().home`). Sin eso, Expo Router redirige al grupo `/(auth)`, que
  no tiene índice, y muestra «Unmatched Route». Los grupos usan `unstable_settings.anchor`
  (`initialRouteName` está obsoleto en Expo Router 58) y las pestañas solo muestran las
  pantallas declaradas con `Tabs.Screen`.
- `npm run test:db`: migraciones + 66 comprobaciones de RLS, integridad y auditoría en
  PostgreSQL local (PGlite), con y sin permisos automáticos. Se verificó que detectan
  fallos rompiendo políticas a propósito.
- `npm run test:db:remote` (66 comprobaciones) y `npm run test:integration` (21 pruebas por
  la API, incluidos auditoría y registro duplicado): lo mismo contra el proyecto real.
  Ambas pasaron el 2026-11-11.
- `npm run db:advisors`: avisos de Supabase. Solo queda «Leaked Password Protection», que
  exige plan Pro.
- Reanimated 4: los valores animados se cambian con `.set()` (no `x.value = …`); las
  reglas del compilador de React en ESLint lo exigen.

### Revisión visual sin Mac

En Windows no hay simulador de iOS. Para revisar desbordes en 360, 375 y 390 pt, en modo
claro y oscuro, se puede exportar una vista web temporal: instalar `react-native-web` con
`npm i --no-save`, añadir `"web"` a `platforms` solo durante el export
(`npx expo export --platform web`) y deshacer ambos cambios. En web no se dibujan los
SF Symbols ni funciona `adjustsFontSizeToFit`: la prueba final es siempre el iPhone.

### Avisos conocidos

`npm audit` reporta 5 avisos moderados en `glob` y `minimatch`, dentro de la CLI de Expo
y de ESLint. Son herramientas de desarrollo, no van dentro de la app. `npm audit fix --force`
rompería las versiones del SDK; se revisan cuando Expo publique parches.
