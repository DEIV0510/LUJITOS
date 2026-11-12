# LUJITOS

Gestor de finanzas personales para iPhone. Colombia, español, pesos colombianos (COP),
zona horaria America/Bogota. **TU DINERO, BAJO CONTROL.**

Estado: **Fase 4** (2026-11-11) — motor financiero real: cuentas de todo tipo (bancos,
billeteras, efectivo, inversiones, CDT, tarjetas con cupo), ingresos, gastos, transferencias y
ajustes de saldo; editar y anular con trazabilidad; saldos, patrimonio y resumen calculados en
PostgreSQL por funciones transaccionales. Reportes: [docs/FASE4.md](docs/FASE4.md) ·
[docs/FASE3.md](docs/FASE3.md).

## Requisitos

- Node.js 20 o superior (probado con 24.16.0) y npm.
- iPhone con **Expo Go** actualizado desde App Store (debe abrir proyectos SDK 58).
- Cuenta Expo con sesión iniciada en el PC (`npx expo login`) y en Expo Go, para el túnel.
- Proyecto de Supabase y `.env.local` con su URL y clave publicable: ver
  [docs/SUPABASE.md](docs/SUPABASE.md).

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm install` | Instala dependencias (la primera vez). |
| `npm run start:tunnel` | **Forma habitual**: túnel de Expo, funciona en cualquier red. |
| `npm start` | Red local (PC e iPhone en la misma Wi-Fi). |
| `npm run start:clear` | Red local borrando la caché de Metro. |
| `npm run check` | TypeScript + ESLint + pruebas unitarias + pruebas SQL locales. |
| `npm test` | Pruebas unitarias (jest-expo). |
| `npm run test:db` | Migraciones, seguridad RLS y motor financiero en PostgreSQL local. |
| `npm run test:db:remote` | Las mismas pruebas SQL en el proyecto real (se deshacen al final). |
| `npm run test:integration` | Auth, motor financiero y aislamiento entre usuarios por la API real. |
| `npm run db:push` | Aplica las migraciones al proyecto vinculado. |
| `npm run db:types` | Regenera los tipos desde la base real (se comparan en `typecheck`). |
| `npm run db:advisors` | Avisos de seguridad y rendimiento de Supabase. |
| `npm run bundle:ios` | Compila el bundle de iOS para comprobar que no hay errores. |
| `npx expo-doctor` | Revisa configuración y versiones. |

Para añadir librerías: `npx expo install <paquete>` (nunca `npm install <paquete>`).
En PowerShell, si `npm` da error de scripts deshabilitados, usar `npm.cmd`.

## Abrir en el iPhone

1. En la terminal de VS Code, dentro de la carpeta del proyecto: `npm.cmd run start:tunnel`.
2. En el iPhone, abrir **Expo Go** con la misma cuenta Expo del PC.
3. Tocar LUJITOS en **Development servers**, o escanear el QR con la **Cámara**.
4. Al terminar, **Ctrl+C** en la terminal cierra el túnel.

Si el inicio de sesión en la terminal falla al abrir el navegador (fallo de la CLI en
Windows): `$env:BROWSER = 'none'; npx.cmd expo login` y abrir a mano el enlace que imprime.

Red local en vez de túnel: el PC cambia entre redes Wi-Fi y tiene Radmin VPN, así que hay
que fijar la IP del Wi-Fi: `$env:REACT_NATIVE_PACKAGER_HOSTNAME = '<IP>'; npm.cmd start`.

## Pantallas (Fase 2)

- **Pestañas:** Inicio · Cuentas · Movimientos · Estadísticas · Asesor IA.
- **Registro rápido** (botón «+»): ingreso, gasto o transferencia.
- **Detalle:** cuenta, movimiento, nueva cuenta.
- **Módulos** (desde el perfil): presupuestos, metas de ahorro, deudas, tarjetas de
  crédito, calendario financiero, pagos recurrentes, notificaciones y configuración.

## Documentación

- [Arquitectura y decisiones técnicas](docs/ARQUITECTURA.md)
- [Sistema de diseño e identidad](docs/DISENO.md)
- [Supabase: proyecto, variables, migraciones, auth y pruebas](docs/SUPABASE.md)
- [Reporte de la Fase 4](docs/FASE4.md)
- [Reporte de la Fase 3](docs/FASE3.md)
- [Instrucciones para agentes de código](AGENTS.md)

## Fases

1. Configuración del proyecto y entorno — **hecha**
2. Identidad visual y diseño de pantallas — **hecha**
3. Autenticación y base de datos — **hecha**
4. Cuentas, movimientos y control de dinero — **en curso**
5. Movimientos y cálculos financieros
6. Presupuestos y objetivos de ahorro
7. Deudas, tarjetas y calendario
8. Estadísticas e informes
9. Asesor financiero con IA
10. Importaciones y conexiones bancarias compatibles
11. Seguridad, pruebas y optimización
12. Compilación y publicación en App Store
