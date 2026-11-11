# LUJITOS — Reporte de la Fase 3

Backend, Supabase, autenticación, base de datos y seguridad. Fecha: 2026-11-11.
**Estado: terminada.** Todas las comprobaciones del brief pasaron, también en el iPhone.

## 1. Resumen técnico

- **Backend:** proyecto Supabase `lujitos` (ref `pntkbflfolpkcvcqwagr`), organización DeiV,
  East US. Creado sin «Automatically expose new tables» y con «Enable automatic RLS».
- **Cliente:** `src/lib/supabase.ts` con la URL y la clave **publicable** (`.env.local`, fuera
  de git). Flujo PKCE para los enlaces de correo. Renovación del token solo con la app en
  primer plano (`AppState`).
- **Sesión:** solo en el llavero de iOS (Expo SecureStore, en trozos de 1.800 caracteres,
  `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`). Nunca en AsyncStorage. Si «Recordar sesión» está
  apagado, la sesión vive solo en memoria.
- **Autenticación:**
  - Registro con validación, medidor de contraseña y aceptación de términos; detecta el correo ya registrado.
  - Confirmación por correo.
  - Inicio de sesión con «Recordar sesión».
  - Recuperación por enlace con nueva contraseña.
  - Cierre de sesión con confirmación.
- **Estados de sesión:** cargando, sin sesión, con sesión, onboarding, recuperación, sin
  conexión (conserva la sesión y ofrece reintentar) y sesión vencida (vuelve a la
  bienvenida con «Tu sesión terminó»). Las rutas privadas viven en `src/app/(app)/` y se
  protegen con `Stack.Protected` + `redirectTo` (`src/features/auth/AppNavigator.tsx`).
- **Onboarding:** 5 pasos, con «Omitir» en los no esenciales.
- **Datos reales:** cuentas, categorías y movimientos desde Supabase (`FinanceDataProvider`)
  y estados vacíos cuando no hay información. La demostración solo aparece si se activa en
  Configuración y siempre con aviso.
- **Dinero:** pesos colombianos enteros (`BIGINT`), montos siempre positivos. Las
  transferencias no cuentan como ingreso ni gasto, y el pago de tarjeta es una transferencia.
- **Errores:** mensajes en español para cada caso; los técnicos se registran sin datos
  sensibles (`src/lib/logger.ts`).
- **Auditoría:** `audit_logs` la escriben triggers. Nunca guarda montos, textos, contraseñas
  ni tokens.

No se implementó (fases siguientes): cálculo de patrimonio, dashboard financiero completo,
conexiones bancarias y Claude API.

## 2. Tablas creadas

| Tabla | Para qué |
| --- | --- |
| `profiles` | Nombre, apellido, correo, avatar, país `CO`, moneda `COP`, zona `America/Bogota`, términos y onboarding. Se crea sola al registrarse. |
| `accounts` | Cuentas (8 tipos: bank, digital_wallet, cash, savings, checking, credit_card, investment, other). `initial_balance` BIGINT, cupo, últimos 4 dígitos, archivado. |
| `categories` | 23 del sistema (8 de ingreso y 15 de gasto, visibles para todos y no editables) y personalizadas por usuario. |
| `transactions` | income, expense, transfer, adjustment. Monto BIGINT > 0, origen/destino, borrado lógico. |
| `account_snapshots` | Saldo diario por cuenta (para gráficas de evolución). |
| `user_preferences` | Tema, notificaciones, Face ID, ocultar montos, moneda. Se crea sola al registrarse. |
| `audit_logs` | Auditoría de operaciones sensibles (solo lectura de los propios). |
| `account_balances` (vista) | Saldo actual = inicial + movimientos no borrados. Respeta RLS (`security_invoker`). |

## 3. Migraciones aplicadas (proyecto real)

| Migración | Contenido |
| --- | --- |
| `20261111120000_core_schema.sql` | Tipos, tablas, índices, restricciones y vista de saldos |
| `20261111120100_row_level_security.sql` | RLS, permisos explícitos y permisos por columna |
| `20261111120200_auth_and_integrity_triggers.sql` | Perfil automático, correo sincronizado y validaciones de movimientos/cuentas |
| `20261111120300_default_categories.sql` | 23 categorías del sistema (se puede reaplicar sin duplicar) |
| `20261111120400_lock_rls_auto_enable.sql` | Cierra la función que crea «Enable automatic RLS» |
| `20261111120500_audit_logs.sql` | Auditoría con triggers |

Las 6 están registradas en `supabase_migrations.schema_migrations` del proyecto.

## 4. Políticas RLS

RLS activado en las 7 tablas. El rol anónimo no tiene ningún permiso. Los permisos se
conceden de forma explícita, sin depender de los automáticos de Supabase.

| Tabla | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| profiles | propio (`id = auth.uid()`) | solo el trigger de registro | propio, columnas permitidas (no el correo) | no |
| user_preferences | propias | solo el trigger | propias, columnas permitidas | no |
| accounts | propias | propias | propias (el dueño no cambia) | no: se archivan |
| categories | sistema + propias | propias (nunca del sistema) | propias | propias sin movimientos |
| transactions | propios | propios | propios | no: borrado lógico |
| account_snapshots | propios | propios | no | no |
| audit_logs | propios | no: solo triggers | no | no |

Además:
- **Cuentas ajenas:** claves foráneas compuestas `(account_id, user_id)`. Un movimiento,
  transferencia o histórico no puede apuntar a la cuenta de otro usuario aunque se conozca
  su UUID.
- **Categorías ajenas:** la validación respeta RLS, así que una categoría privada de otro
  usuario «no existe».
- **Sin DELETE en datos financieros:** es la estrategia explícita de integridad histórica
  (archivar y borrado lógico, ambos auditados). El borrado definitivo solo ocurre al
  eliminar el usuario, en cascada.

## 5. Dependencias instaladas

| Paquete | Versión | Uso |
| --- | --- | --- |
| @supabase/supabase-js | 2.119.0 | Cliente de Supabase |
| expo-secure-store | ~58.0.2 | Sesión en el llavero |
| react-native-url-polyfill | 4.0.0 | Requisito de supabase-js en React Native |
| zod | 4.6.7 | Validación de formularios |
| react-native-worklets | 0.13.0 | Declarada explícitamente (la pide Reanimated 4) |
| jest-expo + jest 30 + @types/jest | ~58.0.14 / ~30.5.2 | Pruebas (desarrollo) |
| @electric-sql/pglite | 0.5.16 | PostgreSQL local para probar migraciones y RLS (desarrollo) |
| @testing-library/react-native | 14.1.0 | Pruebas de navegación y pantallas (desarrollo) |

Expo SDK 58 sin cambios. Todo instalado con `npx expo install`.

## 6. Archivos creados y modificados (desde la Fase 2)

**Creados:**
- **Supabase:** `supabase/config.toml`, 6 migraciones, `supabase/tests/` (RLS, limpieza, entorno local).
- **Cliente:** `src/lib/supabase.ts`, `supabase-storage.ts`, `logger.ts`.
- **Servicios:** `src/services/auth/` (servicio y errores) y `src/services/database/` (perfil, finanzas, errores).
- **Hooks:** `src/hooks/auth/` (AuthProvider).
- **Tipos:** `src/types/database.ts`, `database.generated.ts` y `database.check.ts`.
- **Auth:** `src/features/auth/` (navegador, guardas, validación, componentes, pantallas de estado).
- **Datos:** `src/features/data/` (FinanceDataProvider, resúmenes, «próximamente», aviso de demo) y `src/features/home/LiveHome.tsx`.
- **Pantallas:**
  - `src/app/(auth)/`: bienvenida, registro, inicio de sesión, revisar correo, olvidé mi contraseña.
  - `src/app/onboarding.tsx`, `reset-password.tsx`, `auth/callback.tsx`, `legal.tsx`.
  - `src/components/ui/InputField.tsx`.
- **Scripts y pruebas:** `scripts/` (pruebas de base local, integración, usuarios de prueba) y 8 archivos en `tests/unit/`.
- **Configuración y documentación:** `.env.example`, `docs/SUPABASE.md` y este reporte.

**Movidos:** las pantallas privadas de la Fase 2 pasaron a `src/app/(app)/` (19 archivos,
mismas direcciones).

**Modificados:**
- **Componentes y pantallas:** `src/app/_layout.tsx`, AnimatedSplash, AccountCard,
  BalanceCard, TransactionItem, Headers, Buttons, TransactionForm, HomeSections.
- **Lógica y datos:** `money.ts` (pesos enteros), `types/finance.ts`, datos y selectores
  de demostración, `institutions.ts`, respuestas de demostración del asesor.
- **Configuración y documentación:** `app.json`, `tsconfig.json`, `package.json`,
  `README.md`, `ARQUITECTURA.md`, `CLAUDE.md`.

## 7. Pruebas ejecutadas y resultados (2026-11-11)

| Prueba | Resultado |
| --- | --- |
| TypeScript (`tsc --noEmit`, incluida la comparación de tipos con la base real) | 0 errores |
| ESLint | 0 problemas |
| Unitarias (`npm test`, 9 archivos) | **95/95** |
| SQL local (`npm run test:db`), con y sin permisos automáticos | **66/66** en ambos modos |
| SQL en el proyecto real (`npm run test:db:remote`) | **66/66**, todo dentro de una transacción que se deshace |
| Integración por la API real (`npm run test:integration`) | **21/21** |
| Bundle de iOS (`npm run bundle:ios`) | Compila (1.899 módulos) |
| `npx expo-doctor` | 20/20 |
| Avisos de Supabase (`npm run db:advisors`) | 1: protección de contraseñas filtradas (solo plan Pro) |

**Qué cubren:**
- **Unitarias:** validaciones, sesión en el llavero, registro y registro duplicado, inicio y
  cierre de sesión, recuperación, estados de sesión (sin conexión, sesión vencida, cierre
  propio), protección de rutas con el router real (27 casos), onboarding con «Omitir»,
  registro de errores sin datos sensibles y reglas contables.
- **SQL:**
  - Registro y perfil automático, categorías del sistema, saldos.
  - Transferencias que no son ingreso ni gasto, borrado lógico, cuentas archivadas.
  - Restricciones de montos y transferencias.
  - Aislamiento A/B (leer, modificar, crear a nombre de otro, usar cuentas o categorías ajenas).
  - Acceso anónimo, auditoría completa y borrado en cascada del usuario.
- **Integración:**
  - Credenciales incorrectas, inicio de sesión, persistencia y renovación de la sesión.
  - Registro duplicado, perfil y categorías.
  - Cuenta, movimiento y saldo calculado en la base; monto negativo rechazado.
  - Auditoría y aislamiento entre usuarios por la API.
  - Cierre de sesión que revoca el refresh token.

Se comprobó que las pruebas detectan fallos rompiendo el código a propósito: políticas
abiertas, clave foránea simple, vista sin `security_invoker`, auditoría escribible o con
valores, sin `redirectTo`, sin manejo de red y sin validar el nombre en el onboarding.

**En el iPhone (Expo Go):**
- **Comprobado por el usuario y verificado en la base:**
  - Bienvenida sin sesión, registro con correo real, enlace de confirmación, onboarding,
    perfil creado e inicio vacío con su nombre.
  - Cuenta creada (05:53 UTC).
  - Movimiento creado y borrado (aparecen en la auditoría).
  - Correo de recuperación (05:54) e inicio de sesión con la contraseña nueva (05:55).
  - Sesión guardada y vigente al reabrir.
  - Cierre de sesión.
- El inicio de sesión y la recuperación no aparecen en la auditoría porque ocurrieron antes
  de crearla (06:02 UTC).

## 8. Configuraciones pendientes

1. **SMTP propio** (Authentication → Emails → SMTP Settings, por ejemplo Resend o Brevo).
   El servidor de correo incluido solo envía a los miembros de la organización y pocas veces
   por hora. Hace falta antes de que otras personas usen la app.
2. **Protección de contraseñas filtradas:** exige plan Pro.
3. **Face ID:** no funciona en Expo Go. Se activa con una compilación propia (EAS, Fase 11/12).
4. **Plan gratuito:** el proyecto se pausa tras 7 días sin uso; se reactiva desde el panel.
5. **Otra computadora:** copiar `.env.example` como `.env.local` con la URL y la clave
   publicable, e iniciar sesión en la CLI (`npx supabase login`).
6. **Contraseña de la base de datos:** la generó Supabase y no está guardada (la CLI no la
   necesita). Si hiciera falta, se cambia en Project Settings → Database.

## 9. Probar en el iPhone

1. En el PC, dentro de la carpeta del proyecto: `npm.cmd run start:tunnel`.
2. En el iPhone: Expo Go → LUJITOS (o escanear el QR con la Cámara).
3. **Registro:** «Crear cuenta» con tu correo real → abrir el enlace del correo **en el
   mismo iPhone** con el túnel encendido → onboarding.
4. **Datos:** «Agregar cuenta» → registrar un gasto con «+» → el saldo baja.
5. **Persistencia:** cerrar Expo Go por completo y volver a abrir: entra sin pedir contraseña.
6. **Cierre de sesión:** Configuración → Cerrar sesión → vuelve a la bienvenida.
7. **Inicio de sesión:** «Iniciar sesión» con tu correo y contraseña.
8. **Recuperación:** «¿Olvidaste tu contraseña?» → enlace del correo en el iPhone → nueva
   contraseña → entrar con ella.
9. **Rutas protegidas:** sin sesión, la app siempre abre en la bienvenida; las pantallas
   privadas no se pueden abrir.
