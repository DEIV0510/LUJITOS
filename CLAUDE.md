@AGENTS.md

## LUJITOS — reglas del proyecto

- App financiera personal solo para iPhone (Expo SDK 58, Expo Router en `src/app`).
- Todo texto visible y la documentación en español de Colombia.
- Se trabaja por fases (ver `README.md`). No avanzar a la siguiente fase sin aprobación.
- Datos: las pantallas leen de `useFinanceData()` (real por defecto, demo si se activa).
  Los ficticios viven solo en `src/features/demo/` y nunca se muestran como datos del usuario.
- Supabase: solo URL y clave publicable en la app (`.env.local`). Nunca service_role, nunca
  contraseñas en código ni en el chat. El conector MCP de Supabase de esta máquina es de otra
  cuenta: usar la CLI con el login del usuario (docs/SUPABASE.md).
- Base de datos: todo cambio va en una migración nueva en `supabase/migrations/` con RLS, y
  `npm run test:db` debe pasar. Pantallas privadas nuevas van dentro de `src/app/(app)/`.
- Sesión: solo en SecureStore (`src/lib/supabase-storage.ts`); nunca imprimir tokens.
- Dinero: PESOS ENTEROS en la app y BIGINT en la base. Formato y lectura solo con
  `src/lib/money.ts`. Transferencias, ajustes y pagos de tarjeta no son ingreso ni gasto.
- Diseño: colores, tipografía, espacios y sombras solo desde `src/theme` (`useAppTheme()`);
  íconos solo con `components/ui/Icon` (SF Symbols disponibles desde iOS 16). Ver `docs/DISENO.md`.
- Verde/rojo solo para información financiera. Ningún dato importante se corta con «…».
- Reanimated 4: cambiar valores animados con `.set()`, nunca `x.value = …`.
- Antes de entregar: `npm run check` (tipos, lint, unitarias, SQL), `npx expo-doctor` y
  `npm run bundle:ios` en cero.
- Decisiones técnicas: `docs/ARQUITECTURA.md`. Actualizarla si una decisión cambia.
