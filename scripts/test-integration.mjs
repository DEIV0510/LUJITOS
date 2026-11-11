/**
 * Pruebas de integración contra el proyecto REAL de Supabase (por la API
 * pública, con la clave publicable, igual que la app).
 *
 *   npm run test:integration
 *
 * Necesita:
 *   .env.local       EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *   .env.test.local  TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD,
 *                    TEST_USER_B_EMAIL, TEST_USER_B_PASSWORD
 *                    (usuarios de prueba confirmados; ver docs/SUPABASE.md)
 *
 * Comprueba: inicio de sesión, perfil creado por el registro, categorías del
 * sistema, persistencia y renovación de la sesión, aislamiento entre usuarios
 * (RLS) y cierre de sesión. Los datos que crea se marcan y se archivan al final.
 * No imprime tokens ni contraseñas.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

function readEnv(file) {
  try {
    return Object.fromEntries(
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .filter((line) => line.trim() && !line.trim().startsWith('#') && line.includes('='))
        .map((line) => {
          const index = line.indexOf('=');
          return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
}

const env = { ...readEnv('.env.local'), ...readEnv('.env.test.local'), ...process.env };
const required = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'TEST_USER_A_EMAIL',
  'TEST_USER_A_PASSWORD',
  'TEST_USER_B_EMAIL',
  'TEST_USER_B_PASSWORD',
];
const missing = required.filter((key) => !env[key]);
if (missing.length) {
  console.error(`Faltan variables: ${missing.join(', ')}. Ver docs/SUPABASE.md.`);
  process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  ✗ ${name}\n      ${error.message}`);
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Cliente con almacenamiento en memoria (el de la app usa el llavero). */
function newClient(storage = new Map()) {
  return {
    storage,
    client: createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: 'pkce',
        storage: {
          getItem: async (key) => storage.get(key) ?? null,
          setItem: async (key, value) => void storage.set(key, value),
          removeItem: async (key) => void storage.delete(key),
        },
      },
    }),
  };
}

const marker = `prueba-integracion-${Date.now()}`;
const a = newClient();
const b = newClient();
let accountA;

console.log('\nAutenticación');
await test('Credenciales incorrectas se rechazan', async () => {
  const { error } = await newClient().client.auth.signInWithPassword({ email: env.TEST_USER_A_EMAIL, password: 'contraseña-incorrecta-1A' });
  assert(error && error.code === 'invalid_credentials', `Se esperaba invalid_credentials y llegó ${error?.code ?? 'éxito'}`);
});
await test('El usuario A inicia sesión', async () => {
  const { data, error } = await a.client.auth.signInWithPassword({ email: env.TEST_USER_A_EMAIL, password: env.TEST_USER_A_PASSWORD });
  assert(!error, error?.message);
  assert(data.session?.access_token, 'No llegó sesión');
});
await test('El usuario B inicia sesión', async () => {
  const { error } = await b.client.auth.signInWithPassword({ email: env.TEST_USER_B_EMAIL, password: env.TEST_USER_B_PASSWORD });
  assert(!error, error?.message);
});
await test('La sesión persiste: un cliente nuevo con el mismo almacenamiento la recupera', async () => {
  const reopened = newClient(a.storage);
  const { data } = await reopened.client.auth.getSession();
  assert(data.session?.user.email === env.TEST_USER_A_EMAIL.toLowerCase(), 'No se recuperó la sesión guardada');
});
await test('La sesión se renueva con el refresh token', async () => {
  const { data, error } = await a.client.auth.refreshSession();
  assert(!error && data.session, error?.message ?? 'Sin sesión renovada');
});

console.log('\nPerfil y categorías');
await test('El registro creó el perfil con valores de Colombia', async () => {
  const { data, error } = await a.client.from('profiles').select('*');
  assert(!error, error?.message);
  assert(data.length === 1, `Se esperaba 1 perfil visible y hay ${data.length}`);
  const [profile] = data;
  assert(profile.currency === 'COP' && profile.country === 'CO' && profile.timezone === 'America/Bogota', 'Valores por defecto incorrectos');
});
await test('Se ven las 23 categorías del sistema', async () => {
  const { data, error } = await a.client.from('categories').select('id').is('user_id', null);
  assert(!error, error?.message);
  assert(data.length === 23, `Hay ${data.length}`);
});

console.log('\nDatos propios');
await test('A crea una cuenta y un movimiento; el saldo se calcula en la base', async () => {
  const { data: account, error } = await a.client
    .from('accounts')
    .insert({ name: marker, institution: 'custom', account_type: 'cash', initial_balance: 100000 })
    .select('id')
    .single();
  assert(!error, error?.message);
  accountA = account.id;
  const { data: food } = await a.client.from('categories').select('id').eq('slug', 'food').single();
  const insert = await a.client
    .from('transactions')
    .insert({ account_id: accountA, category_id: food.id, type: 'expense', amount: 25000, description: marker });
  assert(!insert.error, insert.error?.message);
  const { data: balance } = await a.client.from('account_balances').select('balance').eq('account_id', accountA).single();
  assert(Number(balance.balance) === 75000, `Saldo ${balance.balance}, se esperaba 75000`);
});
await test('La base rechaza un monto negativo aunque la app no lo valide', async () => {
  const { data: food } = await a.client.from('categories').select('id').eq('slug', 'food').single();
  const { error } = await a.client.from('transactions').insert({ account_id: accountA, category_id: food.id, type: 'expense', amount: -1 });
  assert(error?.code === '23514', `Se esperaba 23514 y llegó ${error?.code ?? 'éxito'}`);
});

console.log('\nAislamiento entre usuarios (RLS)');
await test('B no ve la cuenta de A', async () => {
  const { data } = await b.client.from('accounts').select('id').eq('id', accountA);
  assert(data.length === 0, 'B pudo leer la cuenta de A');
});
await test('B no ve los movimientos ni el saldo de A', async () => {
  const tx = await b.client.from('transactions').select('id').eq('account_id', accountA);
  const balance = await b.client.from('account_balances').select('account_id').eq('account_id', accountA);
  assert(tx.data.length === 0 && balance.data.length === 0, 'B pudo leer datos de A');
});
await test('B no puede modificar la cuenta de A', async () => {
  const { data } = await b.client.from('accounts').update({ name: 'intruso' }).eq('id', accountA).select('id');
  assert(data.length === 0, 'B modificó la cuenta de A');
  const check = await a.client.from('accounts').select('name').eq('id', accountA).single();
  assert(check.data.name === marker, 'El nombre cambió');
});
await test('B no puede registrar movimientos en la cuenta de A', async () => {
  const { data: food } = await b.client.from('categories').select('id').eq('slug', 'food').single();
  const { error } = await b.client.from('transactions').insert({ account_id: accountA, category_id: food.id, type: 'expense', amount: 1 });
  assert(error, 'B registró un movimiento en la cuenta de A');
});
await test('B solo ve su propio perfil', async () => {
  const { data } = await b.client.from('profiles').select('email');
  assert(data.length === 1 && data[0].email === env.TEST_USER_B_EMAIL.toLowerCase(), 'B ve perfiles ajenos');
});
await test('Sin sesión no se lee nada', async () => {
  const anon = newClient().client;
  const { data, error } = await anon.from('accounts').select('id');
  assert(error || data.length === 0, 'Un visitante leyó cuentas');
});

console.log('\nCierre de sesión');
await test('Archivar la cuenta de prueba', async () => {
  const { error } = await a.client.from('accounts').update({ is_active: false }).eq('id', accountA);
  assert(!error, error?.message);
});
await test('Cerrar sesión elimina la sesión guardada y revoca el refresh token', async () => {
  const { data: before } = await a.client.auth.getSession();
  const refreshToken = before.session.refresh_token;
  const { error } = await a.client.auth.signOut();
  assert(!error, error?.message);
  const { data } = await a.client.auth.getSession();
  assert(!data.session, 'La sesión sigue guardada');
  assert(![...a.storage.keys()].some((key) => key.includes('auth-token') && a.storage.get(key)), 'Quedó el token en el almacenamiento');
  const reuse = await newClient().client.auth.refreshSession({ refresh_token: refreshToken });
  assert(reuse.error, 'El refresh token sigue sirviendo tras cerrar sesión');
});
await b.client.auth.signOut();

console.log(`\n${passed} pasaron, ${failed} fallaron.`);
process.exit(failed ? 1 : 0);
