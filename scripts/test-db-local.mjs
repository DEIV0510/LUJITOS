/**
 * Prueba las migraciones y la seguridad RLS en un PostgreSQL local (PGlite,
 * PostgreSQL compilado a WebAssembly). No necesita Supabase ni credenciales.
 *
 *   npm run test:db
 *
 * Se ejecuta dos veces, porque un proyecto de Supabase puede crearse con o sin
 * «Automatically expose new tables»:
 *   A. con permisos automáticos para las tablas nuevas,
 *   B. sin permisos automáticos (solo los que conceden las migraciones).
 * En cada pasada: aplica supabase/migrations/*.sql en orden y ejecuta
 * supabase/tests/rls_security.test.sql mostrando cada «ok».
 */
import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const migrationsDir = join(root, 'supabase', 'migrations');
const stub = await readFile(join(root, 'supabase', 'tests', 'local', 'supabase-stub.sql'), 'utf8');
const TEST_FILES = [
  ['Pruebas de seguridad e integridad (RLS)', 'rls_security.test.sql'],
  ['Pruebas del motor financiero (Fase 4)', 'finance_engine.test.sql'],
  ['Pruebas de presupuestos, metas, deudas y planificación (Fase 5)', 'planning.test.sql'],
];
const tests = await Promise.all(
  TEST_FILES.map(async ([title, file]) => ({ title, sql: await readFile(join(root, 'supabase', 'tests', file), 'utf8') })),
);
/** Categorías del sistema: 23 de la Fase 3 + «Intereses y comisiones» (Fase 4). */
const SYSTEM_CATEGORIES = 24;
const migrations = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
const seedFile = migrations.find((file) => file.endsWith('_default_categories.sql'));
if (!seedFile) {
  console.error('✗ No se encontró la migración de categorías por defecto');
  process.exit(1);
}

const variants = [
  { label: 'A. Con «Automatically expose new tables»', stub },
  {
    label: 'B. Sin «Automatically expose new tables» (recomendado)',
    stub: stub
      .split('\n')
      .filter((line) => !line.startsWith('alter default privileges'))
      .join('\n'),
  },
];

for (const variant of variants) {
  console.log(`\n=== ${variant.label} ===`);
  const db = new PGlite();
  let passed = 0;
  const verbose = variant === variants[0];
  const onNotice = (notice) => {
    if (notice.message?.startsWith('ok - ')) {
      passed += 1;
      if (verbose) console.log(`  ✓ ${notice.message.slice(5)}`);
    }
  };
  const run = async (label, sql) => {
    try {
      const results = await db.exec(sql, { onNotice });
      if (label) console.log(`✓ ${label}`);
      return results;
    } catch (error) {
      console.error(`\n✗ ${label ?? 'Pruebas'}\n  ${error.message}`);
      process.exit(1);
    }
  };

  await run('Entorno simulado de Supabase (roles, auth.users, auth.uid)', variant.stub);
  for (const file of migrations) {
    await run(`Migración ${file}`, await readFile(join(migrationsDir, file), 'utf8'));
  }
  for (const test of tests) {
    passed = 0;
    if (verbose) console.log(`\n${test.title}:`);
    const results = await run(null, test.sql);
    const final = results.flatMap((result) => result.rows ?? []).find((row) => row.resultado);
    console.log(`${passed} comprobaciones superadas.`);
    if (!final) {
      console.error('✗ La prueba no llegó al final.');
      process.exit(1);
    }
    console.log(final.resultado);
  }

  // La semilla de categorías se puede reaplicar sin duplicar.
  await run('Las categorías del sistema no se duplican al reaplicar la semilla', await readFile(join(migrationsDir, seedFile), 'utf8'));
  const { rows } = await db.query('select count(*)::int as n from public.categories where user_id is null');
  if (rows[0].n !== SYSTEM_CATEGORIES) {
    console.error(`✗ Se esperaban ${SYSTEM_CATEGORIES} categorías del sistema y hay ${rows[0].n}`);
    process.exit(1);
  }
  await db.close();
}
