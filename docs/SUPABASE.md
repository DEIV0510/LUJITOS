# LUJITOS — Supabase paso a paso

Guía para conectar la app con su base de datos. Todo se hace con **tu** cuenta de
Supabase (organización «DeiV»). Nunca se usa la clave secreta `service_role` en la app.

## Proyecto actual

| Dato | Valor |
| --- | --- |
| Organización | DeiV (plan gratuito) |
| Proyecto | `lujitos` · ref `pntkbflfolpkcvcqwagr` · East US (North Virginia) |
| URL | `https://pntkbflfolpkcvcqwagr.supabase.co` |
| Creado | 2026-11-11, con Data API activa, **sin** «Automatically expose new tables» y **con** «Enable automatic RLS» |

La contraseña de la base de datos la generó Supabase y no está guardada en ningún lado:
no hace falta (la CLI entra con tu sesión). Si algún día la necesitas, cámbiala en
**Project Settings → Database → Reset database password**.

## 1. Crear el proyecto (solo si hubiera que rehacerlo)

1. Entra a [supabase.com/dashboard](https://supabase.com/dashboard) → organización **DeiV**.
2. **New project**.
3. **Project name:** `lujitos`.
4. **Database password:** pulsa **Generate a password**. No la pegues en ningún chat ni
   archivo del proyecto.
5. **Region:** East US (North Virginia).
6. **Security:** deja **Enable Data API** activo, **desmarca** «Automatically expose new
   tables» (las migraciones conceden los permisos exactos) y **marca** «Enable automatic RLS».
7. **Create new project** y espera a que diga *Healthy* (1–2 minutos).

Plan gratuito: el proyecto se pausa tras 7 días sin uso; se reactiva desde el panel.

## 2. Variables de entorno (datos públicos)

1. En el proyecto: botón **Connect** → pestaña **Mobile** → **Expo React Native**
   (o **Project Settings → API Keys**).
2. Copia la **Project URL** y la **Publishable key** (`sb_publishable_…`).
3. En la carpeta del proyecto, copia `.env.example` como `.env.local` y pega ambos valores.
4. Reinicia Expo para que los lea: `npm run start:tunnel`.

`.env.local` está en `.gitignore`. Si la app muestra «Falta conectar Supabase», revisa
que la URL termine en `.supabase.co` y que la clave no sea la de ejemplo.

## 3. Vincular la CLI y ejecutar las migraciones

En la terminal de VS Code, dentro de la carpeta del proyecto:

```bash
npx --yes supabase@3.1.0 login
```
Pulsa Enter, autoriza en el navegador con la cuenta **DeiV** y escribe en la terminal el
código que muestra la página. (En PowerShell usa `npx.cmd` si `npx` da error de scripts.)

```bash
npx --yes supabase@3.1.0 link --project-ref pntkbflfolpkcvcqwagr
```
No pide la contraseña de la base: la CLI 3 crea un rol temporal con tu sesión.

```bash
npm run db:push
```
La CLI 3 apunta a una base local si no se le pasa `--remote`; el script ya lo incluye.
Aplica en orden los archivos de `supabase/migrations/`:

| Migración | Contenido |
| --- | --- |
| `20261111120000_core_schema.sql` | Tipos, tablas, índices, vista `account_balances` |
| `20261111120100_row_level_security.sql` | RLS y permisos por columna |
| `20261111120200_auth_and_integrity_triggers.sql` | Perfil automático y validaciones |
| `20261111120300_default_categories.sql` | 23 categorías del sistema |
| `20261111120400_lock_rls_auto_enable.sql` | Quita a `anon`/`authenticated` el permiso de llamar `rls_auto_enable()`, la función que crea «Enable automatic RLS» |

Después de una migración nueva: `npm run db:types` regenera
`src/types/database.generated.ts` y `npm run typecheck` avisa si `src/types/database.ts`
quedó desalineado (`src/types/database.check.ts`).

## 4. Autenticación por correo y enlaces de recuperación

La configuración está versionada en `supabase/config.toml` (sección `[auth]`):

- Confirmación de correo obligatoria.
- Contraseñas de 8+ caracteres con mayúscula, minúscula y número.
- `site_url = "lujitos://"` y enlaces permitidos `lujitos://**` y `exp://**`
  (Expo Go usa direcciones `exp://` que cambian en cada arranque del túnel).
- Un correo de confirmación o recuperación cada 60 segundos como máximo.

Ya está aplicada (2026-11-11). Si cambias `config.toml`, revisa primero y luego aplica:

```bash
npx --yes supabase@3.1.0 config diff
npx --yes supabase@3.1.0 config push
```
`config.toml` está alineado con el proyecto en todo lo demás (pooler, OTP de 8 dígitos,
MFA TOTP, almacenamiento vectorial apagado), así que `config diff` debe mostrar solo lo que
cambiaste. Equivalente manual en el panel:
**Authentication → URL Configuration** (Site URL y Redirect URLs) y
**Authentication → Providers → Email** / **Sign In / Providers** (confirmación y contraseñas).

**Correo de prueba de Supabase:** el servidor de correo incluido solo envía a los
miembros de tu organización y unas pocas veces por hora. Para probar en tu iPhone
regístrate con **tu propio correo**. Para usuarios reales hace falta un SMTP propio
(**Authentication → Emails → SMTP Settings**), por ejemplo Resend o Brevo.

Los enlaces de los correos traen un código de un solo uso (flujo PKCE): ábrelos **en el
mismo iPhone** donde iniciaste el registro o pediste la recuperación, con el servidor de
Expo encendido.

## 5. Usuarios de prueba

```bash
npm run test:users
```
Crea dos usuarios confirmados con dominio `@lujitos.test` (nunca reciben correos) y guarda
sus contraseñas aleatorias en `.env.test.local` (ignorado por git). Para borrarlos con todos
sus datos: `npm run test:users:clean`.

## 6. Pruebas

| Comando | Qué prueba | Necesita |
| --- | --- | --- |
| `npm test` | 51 pruebas: validaciones, sesión en el llavero, flujos de auth, protección de rutas, reglas contables | Nada |
| `npm run test:db` | Migraciones + 52 comprobaciones de RLS e integridad en PostgreSQL local (PGlite) | Nada |
| `npm run test:db:remote` | Las mismas 52 comprobaciones en tu proyecto real (todo dentro de una transacción que se deshace) | Proyecto vinculado |
| `npm run test:integration` | Por la API real: inicio y cierre de sesión, persistencia y renovación de sesión, perfil, aislamiento entre usuarios | `.env.local` + usuarios de prueba |

## 7. Comprobar que tus datos están protegidos

- En el panel: **Database → Tables**: las 6 tablas muestran **RLS enabled**.
- `npm run db:advisors` (o **Advisors → Security Advisor**): la única alerta es
  «Leaked Password Protection Disabled», que solo se puede activar en el plan Pro.
- `npm run test:db:remote` termina con «TODAS LAS PRUEBAS DE SEGURIDAD PASARON».
- Prueba manual: crea dos cuentas de LUJITOS con dos correos distintos; lo que registres
  en una no aparece en la otra.

## Qué NO va nunca en la app ni en git

- La clave `service_role` / secret.
- La contraseña de la base de datos.
- `.env.local`, `.env.test.local` y `supabase/.temp/`.
