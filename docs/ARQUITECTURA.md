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

En su lugar: `src/theme/tokens.ts` (colores semánticos claro/oscuro, espaciado, radios,
tipografía) y el hook `useAppTheme()`. Las pantallas nunca escriben colores sueltos, así
que la identidad de la Fase 2 cambia un solo archivo. Si NativeWind 5 sale estable, migrar
es barato porque los nombres ya son semánticos.

## 4. Estructura

```
src/
  app/            Solo rutas (Expo Router). Cada archivo es una pantalla.
  components/     Componentes visuales reutilizables (botones, tarjetas, filas).
  features/       Un módulo por dominio: accounts, transactions, budgets, savings,
                  debts, cards, calendar, statistics, assistant. Cada uno con sus
                  componentes, hooks, esquemas Zod y consultas.
  hooks/          Hooks compartidos.
  services/       Clientes externos: Supabase (Fase 3), asesor IA (Fase 9).
  lib/            Lógica central y probada: dinero, fechas, saldos, proyecciones.
  constants/      Datos fijos (locale es-CO, COP, America/Bogota).
  types/          Tipos globales y los generados desde la base de datos.
  utils/          Funciones pequeñas sin dependencias de dominio.
  theme/          Tokens y hook del tema.
assets/           images, icons, fonts.
supabase/         migrations (SQL versionado) y functions (Edge Functions).
tests/            Pruebas de integración; las unitarias van junto a su archivo.
docs/             Esta documentación.
```

Se usa `src/app` en lugar de `app/` en la raíz porque es la convención actual de Expo
y deja todo el código bajo un mismo alias (`@/…`).

### Rutas previstas

```
src/app/
  _layout.tsx               Tema, sesión y bloqueo
  (auth)/                   Entrar, crear cuenta, recuperar acceso
  (tabs)/                   index (Inicio) · accounts · transactions · statistics · assistant
  transaction/new.tsx       Registro rápido en hoja modal: ingreso, gasto, transferencia, ajuste
  accounts/[id].tsx         Detalle e historial de una cuenta
  budgets/ savings/ debts/ cards/ calendar/ recurring/ settings/
```

Barra inferior nativa de iOS o barra propia: se decide en la Fase 2 con el diseño.

## 5. Dinero y cálculos (regla de la casa)

- **Base de datos**: montos en `numeric(16,2)` y `currency char(3)` con `'COP'` por defecto.
- **App**: los montos viajan como enteros en centavos. Nunca se suma con decimales de
  JavaScript. Toda operación vive en `src/lib/money` y tiene pruebas (Fase 5).
- **Saldo actual** = saldo inicial + suma de movimientos. Se calcula, no se escribe a mano;
  `account_snapshots` guarda la foto diaria para las gráficas de evolución.
- **Transferencias** entre cuentas propias: no cuentan como ingreso ni gasto.
- **Tarjetas de crédito**: la compra es el gasto (aumenta la deuda de la tarjeta). El pago
  de la tarjeta es una transferencia de la cuenta bancaria a la tarjeta, no otro gasto.
  Así nada se cuenta dos veces.
- **Fechas**: `timestamptz` en UTC; los meses y semanas se calculan en `America/Bogota`.

## 6. Datos y validación (Fases 3 y 5)

- Supabase: Postgres, Auth, RLS y Edge Functions. Tablas previstas: `profiles`, `accounts`,
  `transactions`, `categories`, `budgets`, `budget_categories`, `savings_goals`, `debts`,
  `recurring_transactions`, `account_snapshots`, `import_batches`, `institution_connections`,
  `transaction_rules`, `notifications`, `user_preferences`.
- Formularios: React Hook Form + Zod 4. Los mismos esquemas validan en la app y antes
  de escribir en la base. Hace falta `@hookform/resolvers` para unirlos.
- Caché y sincronización: se propondrá TanStack Query al empezar la Fase 3 (no instalado).

## 7. Seguridad

- RLS en todas las tablas: cada fila tiene `user_id` y solo la ve `auth.uid()`.
- En la app solo va la clave pública de Supabase (`EXPO_PUBLIC_…`). La clave de servicio
  y la de Claude viven como secretos de Edge Functions, nunca en el teléfono.
- Sesión: la clave de cifrado en SecureStore y la sesión cifrada en almacenamiento local,
  porque iOS puede rechazar valores grandes en el llavero (patrón recomendado por Supabase).
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
| expo-font | ~58.0.11 | Sí | Fase 2 |
| expo-haptics | ~58.0.7 | Sí | Fase 2 |
| @supabase/supabase-js | 2.119.0 (JS) | Sí | Fase 3 |
| expo-secure-store | ~58.0.2 | Sí | Fase 3 |
| expo-local-authentication | ~58.0.2 | Sin Face ID | Fase 3 / 11 |
| react-hook-form | 7.91.0 (JS) | Sí | Fase 5 |
| zod | 4.6.7 (JS) | Sí | Fase 5 |
| jest-expo | ~58.0.14 | — | Fase 5 |
| expo-notifications | ~58.1.8 | Sí | Fase 7 |
| react-native-svg / Skia | 15.16.0 / 2.14.0 | Sí | Fase 8 (elegir una) |
| expo-image-picker / expo-camera | ~58.0.10 / ~58.0.14 | Sí | Fase 10 |
| eas-cli | 27.7.2 | — | Con `npx`, Fase 12 |

Regla: instalar siempre con `npx expo install <paquete>`, que elige la versión del SDK.

## 9. Calidad

- `npm run check`: TypeScript + ESLint. Debe quedar en cero antes de cada entrega.
- `npx expo-doctor`: configuración y versiones.
- `npm run bundle:ios`: compila el bundle real de iOS (Hermes) para detectar errores
  que el editor no ve.
- Pruebas automáticas con jest-expo desde la Fase 5, cuando exista lógica de dinero.

### Avisos conocidos

`npm audit` reporta 5 avisos moderados en `glob` y `minimatch`, dentro de la CLI de Expo
y de ESLint. Son herramientas de desarrollo, no van dentro de la app. `npm audit fix --force`
rompería las versiones del SDK; se revisan cuando Expo publique parches.
