/**
 * Crea dos usuarios de PRUEBA ya confirmados (dominio reservado .test, nunca
 * reciben correos) en el proyecto vinculado, para npm run test:integration.
 *
 *   node scripts/create-test-users.mjs
 *
 * - Las contraseñas se generan aquí al azar y se guardan SOLO en
 *   .env.test.local (ignorado por git). No se imprimen.
 * - Usa la CLI de Supabase con TU sesión (npx supabase login) y el proyecto
 *   vinculado (npx supabase link). No usa la clave service_role.
 * - Borrar los usuarios de prueba: npm run test:users:clean
 */
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (existsSync('.env.test.local')) {
  console.log('Ya existe .env.test.local: se reutilizan esos usuarios de prueba.');
  process.exit(0);
}

function password() {
  // Cumple la política: minúscula, mayúscula, número; 24 caracteres.
  return `Lj${randomBytes(15).toString('base64url')}9a`;
}

const suffix = randomBytes(3).toString('hex');
const users = [
  { key: 'A', id: randomUUID(), email: `prueba.a.${suffix}@lujitos.test`, password: password(), first: 'Prueba', last: 'Usuario A' },
  { key: 'B', id: randomUUID(), email: `prueba.b.${suffix}@lujitos.test`, password: password(), first: 'Prueba', last: 'Usuario B' },
];

const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sql = users
  .map(
    (user) => `
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', ${literal(user.id)}, 'authenticated', 'authenticated',
  ${literal(user.email)}, extensions.crypt(${literal(user.password)}, extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}',
  ${literal(JSON.stringify({ first_name: user.first, last_name: user.last, terms_accepted: 'true' }))},
  now(), now(), '', '', '', ''
);
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  gen_random_uuid(), ${literal(user.id)}, ${literal(user.id)},
  ${literal(JSON.stringify({ sub: user.id, email: user.email, email_verified: true }))},
  'email', now(), now(), now()
);
update public.profiles set onboarding_completed_at = now() where id = ${literal(user.id)};`,
  )
  .join('\n');

const dir = mkdtempSync(join(tmpdir(), 'lujitos-'));
const file = join(dir, 'usuarios-prueba.sql');
writeFileSync(file, `begin;\n${sql}\ncommit;\n`);
try {
  execFileSync('npx', ['--yes', 'supabase@3.1.0', 'db', 'query', '--remote', '--yes', '-f', file], {
    stdio: ['ignore', 'ignore', 'inherit'],
    shell: process.platform === 'win32',
  });
} catch {
  console.error('No se pudieron crear los usuarios. ¿Iniciaste sesión (npx supabase login) y vinculaste el proyecto (npx supabase link)?');
  process.exit(1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

writeFileSync(
  '.env.test.local',
  [
    '# Usuarios de PRUEBA para npm run test:integration (no subir a git).',
    ...users.flatMap((user) => [`TEST_USER_${user.key}_EMAIL=${user.email}`, `TEST_USER_${user.key}_PASSWORD=${user.password}`]),
    '',
  ].join('\n'),
);
console.log(`Usuarios de prueba creados: ${users.map((user) => user.email).join(', ')}`);
console.log('Credenciales guardadas en .env.test.local (ignorado por git).');
