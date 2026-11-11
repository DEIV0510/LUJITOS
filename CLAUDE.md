@AGENTS.md

## LUJITOS — reglas del proyecto

- App financiera personal solo para iPhone (Expo SDK 58, Expo Router en `src/app`).
- Todo texto visible y la documentación en español de Colombia.
- Se trabaja por fases (ver `README.md`). No avanzar a la siguiente fase sin aprobación.
- Nunca datos financieros reales ni inventados que parezcan reales.
- Dinero: enteros en centavos en la app, `numeric(16,2)` en la base. Toda operación en
  `src/lib/money` con pruebas. Transferencias y pagos de tarjeta no son gasto.
- Colores, espacios y tipografía solo desde `src/theme` (`useAppTheme()`).
- Antes de entregar: `npm run check`, `npx expo-doctor` y `npm run bundle:ios` en cero.
- Decisiones técnicas: `docs/ARQUITECTURA.md`. Actualizarla si una decisión cambia.
