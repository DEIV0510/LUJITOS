/**
 * Prueba las migraciones y la seguridad RLS en un PostgreSQL local (PGlite,
 * PostgreSQL compilado a WebAssembly). No necesita Supabase ni credenciales.
 *
 *   npm run test:db
 *
 * 1. Crea una base vacía en memoria con la simulación de Supabase.
 * 2. Aplica supabase/migrations/*.sql en orden.
 * 3. Ejecuta supabase/tests/rls_security.test.sql y muestra cada «ok».
 */
import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const migrationsDir = join(root, 'supabase', 'migrations');
const db = new PGlite();
let passed = 0;

const onNotice = (notice) => {
  if (notice.message?.startsWith('ok - ')) {
    passed += 1;
    console.log(`  ✓ ${notice.message.slice(5)}`);
  }
};

async function run(label, sql) {
  try {
    const results = await db.exec(sql, { onNotice });
    if (label) console.log(`✓ ${label}`);
    return results;
  } catch (error) {
    console.error(`\n✗ ${label ?? 'Pruebas'}\n  ${error.message}`);
    process.exit(1);
  }
}

await run('Entorno simulado de Supabase (roles, auth.users, auth.uid)', await readFile(join(root, 'supabase', 'tests', 'local', 'supabase-stub.sql'), 'utf8'));

const migrations = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
for (const file of migrations) {
  await run(`Migración ${file}`, await readFile(join(migrationsDir, file), 'utf8'));
}

console.log('\nPruebas de seguridad e integridad:');
const results = await run(null, await readFile(join(root, 'supabase', 'tests', 'rls_security.test.sql'), 'utf8'));
const final = results.flatMap((result) => result.rows ?? []).find((row) => row.resultado);
console.log(`\n${passed} comprobaciones superadas.`);
if (!final) {
  console.error('✗ La prueba no llegó al final.');
  process.exit(1);
}
console.log(final.resultado);

// Las migraciones deben poder aplicarse sobre una base que ya las tiene (idempotencia de semillas).
await run('Las categorías del sistema no se duplican al reaplicar la semilla', await readFile(join(migrationsDir, migrations[migrations.length - 1]), 'utf8'));
const { rows } = await db.query("select count(*)::int as n from public.categories where user_id is null");
if (rows[0].n !== 23) {
  console.error(`✗ Se esperaban 23 categorías del sistema y hay ${rows[0].n}`);
  process.exit(1);
}
await db.close();
