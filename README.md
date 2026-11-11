# LUJITOS

Gestor de finanzas personales para iPhone. Colombia, español, pesos colombianos (COP),
zona horaria America/Bogota.

Estado: **Fase 1 completa** (entorno). Todavía no hay módulos financieros.

## Requisitos

- Node.js 20 o superior (probado con 24.16.0) y npm.
- iPhone con **Expo Go** actualizado desde App Store (debe abrir proyectos SDK 58).
- PC e iPhone en la misma red Wi-Fi.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm install` | Instala dependencias (la primera vez). |
| `npm start` | Abre el servidor de desarrollo y muestra el código QR. |
| `npm run start:clear` | Igual, borrando la caché de Metro. |
| `npm run start:tunnel` | Para redes donde el iPhone no ve al PC. |
| `npm run check` | TypeScript + ESLint. |
| `npm run bundle:ios` | Compila el bundle de iOS para comprobar que no hay errores. |
| `npx expo-doctor` | Revisa configuración y versiones. |

Para añadir librerías: `npx expo install <paquete>` (nunca `npm install <paquete>`).

## Abrir en el iPhone

1. En VS Code: **Terminal → Nueva terminal**, y ejecutar `npm start`.
2. Si Windows pregunta por el Firewall para **Node.js**, marcar **Redes privadas** y
   pulsar **Permitir acceso**.
3. En el iPhone, abrir la app **Cámara** y apuntar al código QR de la terminal.
   Tocar el aviso **Abrir en Expo Go**.
4. Debe aparecer la pantalla «LUJITOS ya abre en tu iPhone» con el diagnóstico.

Si no conecta:

- Revisar que la red Wi-Fi del PC esté como **Privada** (Configuración de Windows →
  Red e Internet → Wi-Fi → la red → Tipo de perfil de red → Privada).
- O usar `npm run start:tunnel`. La primera vez pide instalar `@expo/ngrok`: responder `Y`.

## Documentación

- [Arquitectura y decisiones técnicas](docs/ARQUITECTURA.md)
- [Instrucciones para agentes de código](AGENTS.md)

## Fases

1. Configuración del proyecto y entorno — **hecha**
2. Identidad visual y diseño de pantallas
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
