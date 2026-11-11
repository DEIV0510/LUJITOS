@AGENTS.md

## LUJITOS — reglas del proyecto

- App financiera personal solo para iPhone (Expo SDK 58, Expo Router en `src/app`).
- Todo texto visible y la documentación en español de Colombia.
- Se trabaja por fases (ver `README.md`). No avanzar a la siguiente fase sin aprobación.
- Nunca datos financieros reales. Los ficticios viven solo en `src/features/demo/data.ts`
  y las pantallas los leen por `src/features/demo/selectors.ts`.
- Dinero: enteros en centavos en la app, `numeric(16,2)` en la base. Formato y cálculo
  solo con `src/lib/money.ts`. Transferencias y pagos de tarjeta no son gasto.
- Diseño: colores, tipografía, espacios y sombras solo desde `src/theme` (`useAppTheme()`);
  íconos solo con `components/ui/Icon` (SF Symbols disponibles desde iOS 16). Ver `docs/DISENO.md`.
- Verde/rojo solo para información financiera. Ningún dato importante se corta con «…».
- Reanimated 4: cambiar valores animados con `.set()`, nunca `x.value = …`.
- Antes de entregar: `npm run check`, `npx expo-doctor` y `npm run bundle:ios` en cero.
- Decisiones técnicas: `docs/ARQUITECTURA.md`. Actualizarla si una decisión cambia.
