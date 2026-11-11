# LUJITOS

Gestor de finanzas personales para iPhone. Colombia, español, pesos colombianos (COP),
zona horaria America/Bogota. **TU DINERO, BAJO CONTROL.**

Estado: **Fase 2 completa** (identidad visual y todas las pantallas con navegación).
Los datos son **de demostración**: nada se guarda todavía (eso llega en la Fase 3).

## Requisitos

- Node.js 20 o superior (probado con 24.16.0) y npm.
- iPhone con **Expo Go** actualizado desde App Store (debe abrir proyectos SDK 58).
- Cuenta Expo con sesión iniciada en el PC (`npx expo login`) y en Expo Go, para el túnel.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm install` | Instala dependencias (la primera vez). |
| `npm run start:tunnel` | **Forma habitual**: túnel de Expo, funciona en cualquier red. |
| `npm start` | Red local (PC e iPhone en la misma Wi-Fi). |
| `npm run start:clear` | Red local borrando la caché de Metro. |
| `npm run check` | TypeScript + ESLint. |
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
- [Instrucciones para agentes de código](AGENTS.md)

## Fases

1. Configuración del proyecto y entorno — **hecha**
2. Identidad visual y diseño de pantallas — **hecha**
3. Autenticación y base de datos
4. Inicio y cuentas
5. Movimientos y cálculos financieros
6. Presupuestos y objetivos de ahorro
7. Deudas, tarjetas y calendario
8. Estadísticas e informes
9. Asesor financiero con IA
10. Importaciones y conexiones bancarias compatibles
11. Seguridad, pruebas y optimización
12. Compilación y publicación en App Store
