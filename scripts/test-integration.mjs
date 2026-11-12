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
await test('Registro duplicado: Supabase responde sin identidades y la app lo detecta', async () => {
  // Con confirmación de correo, Supabase no da error para no revelar qué correos
  // existen: devuelve un usuario sin identidades. authService.signUp lo traduce
  // a «Ya existe una cuenta con ese correo».
  const { data, error } = await newClient().client.auth.signUp({
    email: env.TEST_USER_A_EMAIL,
    password: `Duplicado${Date.now()}x`,
  });
  assert(!error, `Llegó un error: ${error?.code}`);
  assert(data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0, 'El usuario duplicado trae identidades');
  assert(!data.session, 'El registro duplicado abrió una sesión');
});

console.log('\nPerfil y categorías');
await test('El registro creó el perfil con valores de Colombia', async () => {
  const { data, error } = await a.client.from('profiles').select('*');
  assert(!error, error?.message);
  assert(data.length === 1, `Se esperaba 1 perfil visible y hay ${data.length}`);
  const [profile] = data;
  assert(profile.currency === 'COP' && profile.country === 'CO' && profile.timezone === 'America/Bogota', 'Valores por defecto incorrectos');
});
await test('Se ven las 24 categorías del sistema (incluye intereses y comisiones)', async () => {
  const { data, error } = await a.client.from('categories').select('id').is('user_id', null);
  assert(!error, error?.message);
  assert(data.length === 24, `Hay ${data.length}`);
});

console.log('\nDatos propios');
let foodId;
let bankA;
let cardA;
await test('A crea una cuenta y un gasto por las funciones RPC; el saldo se calcula en la base', async () => {
  const created = await a.client.rpc('create_account', {
    p_name: marker, p_account_type: 'cash', p_institution: 'cash', p_initial_balance: 100000,
  });
  assert(!created.error, created.error?.message);
  accountA = created.data;
  const { data: food } = await a.client.from('categories').select('id').eq('slug', 'food').single();
  foodId = food.id;
  const tx = await a.client.rpc('create_transaction', {
    p_type: 'expense', p_amount: 25000, p_account_id: accountA, p_category_id: foodId, p_description: marker,
  });
  assert(!tx.error, tx.error?.message);
  const { data: balance } = await a.client.from('account_balances').select('balance').eq('account_id', accountA).single();
  assert(Number(balance.balance) === 75000, `Saldo ${balance.balance}, se esperaba 75000`);
});
await test('La app ya no puede insertar movimientos directo en la tabla', async () => {
  const { error } = await a.client.from('transactions').insert({ account_id: accountA, category_id: foodId, type: 'expense', amount: 1 });
  assert(error, 'Se insertó un movimiento sin pasar por create_transaction');
});
await test('El servidor rechaza un monto negativo aunque la app no lo valide', async () => {
  const { error } = await a.client.rpc('create_transaction', { p_type: 'expense', p_amount: -1, p_account_id: accountA, p_category_id: foodId });
  assert(error?.code === 'LJ007', `Se esperaba LJ007 y llegó ${error?.code ?? 'éxito'}`);
});

console.log('\nMotor financiero (API)');
await test('Gasto mayor al saldo: el servidor advierte (LJ001) con el saldo resultante', async () => {
  const { error } = await a.client.rpc('create_transaction', { p_type: 'expense', p_amount: 100000, p_account_id: accountA, p_category_id: foodId });
  assert(error?.code === 'LJ001' && error.details === '-25000', `Llegó ${error?.code} / ${error?.details}`);
});
await test('Misma solicitud dos veces (doble toque): un solo movimiento', async () => {
  const requestId = crypto.randomUUID();
  const args = { p_type: 'expense', p_amount: 1000, p_account_id: accountA, p_category_id: foodId, p_request_id: requestId };
  const first = await a.client.rpc('create_transaction', args);
  const second = await a.client.rpc('create_transaction', args);
  assert(!first.error && !second.error && first.data === second.data, 'Se duplicó el movimiento');
});
await test('Transferencia y tarjeta: pago reduce la deuda y no es gasto; resumen consistente', async () => {
  const bank = await a.client.rpc('create_account', {
    p_name: `${marker}-banco`, p_account_type: 'savings', p_institution: 'bancolombia', p_initial_balance: 1000000,
  });
  const card = await a.client.rpc('create_account', {
    p_name: `${marker}-tarjeta`, p_account_type: 'credit_card', p_institution: 'bancolombia',
    p_initial_balance: -700000, p_credit_limit: 3000000,
  });
  assert(!bank.error && !card.error, bank.error?.message ?? card.error?.message);
  bankA = bank.data;
  cardA = card.data;
  const before = await a.client.rpc('financial_summary', {});
  const pay = await a.client.rpc('create_transaction', {
    p_type: 'transfer', p_amount: 200000, p_account_id: bankA, p_destination_account_id: cardA, p_description: 'Pago tarjeta',
  });
  assert(!pay.error, pay.error?.message);
  const { data: rows } = await a.client.from('account_balances').select('account_id, balance').in('account_id', [bankA, cardA]);
  const byId = Object.fromEntries(rows.map((row) => [row.account_id, Number(row.balance)]));
  assert(byId[bankA] === 800000 && byId[cardA] === -500000, `Saldos ${JSON.stringify(byId)}`);
  const after = await a.client.rpc('financial_summary', {});
  assert(Number(after.data.month_expense) === Number(before.data.month_expense), 'El pago contó como gasto');
  assert(Number(after.data.net_worth) === Number(before.data.net_worth), 'El pago cambió el patrimonio');
});
await test('Editar y anular por RPC recalculan los saldos', async () => {
  const tx = await a.client.rpc('create_transaction', { p_type: 'expense', p_amount: 100000, p_account_id: bankA, p_category_id: foodId });
  const edit = await a.client.rpc('update_transaction', { p_transaction_id: tx.data, p_amount: 60000, p_account_id: bankA, p_category_id: foodId });
  assert(!edit.error, edit.error?.message);
  let { data } = await a.client.from('account_balances').select('balance').eq('account_id', bankA).single();
  assert(Number(data.balance) === 740000, `Tras editar: ${data.balance}`);
  const voided = await a.client.rpc('void_transaction', { p_transaction_id: tx.data, p_reason: 'Prueba' });
  assert(!voided.error, voided.error?.message);
  ({ data } = await a.client.from('account_balances').select('balance').eq('account_id', bankA).single());
  assert(Number(data.balance) === 800000, `Tras anular: ${data.balance}`);
});
await test('Ajuste de saldo: registra la diferencia con el motivo', async () => {
  const result = await a.client.rpc('reconcile_account', {
    p_account_id: bankA, p_observed_balance: 790000, p_expected_balance: 800000, p_reason: 'Cuota de manejo',
  });
  assert(!result.error && Number(result.data.difference) === -10000, result.error?.message ?? JSON.stringify(result.data));
});
await test('Historial del saldo para el gráfico', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await a.client.rpc('account_balance_history', { p_account_id: bankA, p_from: today, p_to: today });
  assert(!error && data.length === 1, error?.message ?? `Puntos: ${data?.length}`);
});

console.log('\nAuditoría');
await test('El inicio de sesión, la cuenta y el movimiento quedan en la auditoría de A', async () => {
  const { data, error } = await a.client.from('audit_logs').select('action, entity_id, changed_fields');
  assert(!error, error?.message);
  const actions = new Set(data.map((row) => row.action));
  assert(actions.has('auth.signed_in'), 'No quedó el inicio de sesión');
  assert(data.some((row) => row.action === 'account.created' && row.entity_id === accountA), 'No quedó la cuenta creada');
  assert(actions.has('transaction.created'), 'No quedó el movimiento');
  assert(!JSON.stringify(data).includes(marker) && !JSON.stringify(data).includes('25000'), 'La auditoría guardó textos o montos');
});
await test('La app no puede escribir en la auditoría', async () => {
  const { error } = await a.client.from('audit_logs').insert({ action: 'auth.signed_in' });
  assert(error, 'Se pudo insertar en la auditoría');
});
await test('B no ve la auditoría de A', async () => {
  const { data } = await b.client.from('audit_logs').select('entity_id').eq('entity_id', accountA);
  assert(data.length === 0, 'B leyó la auditoría de A');
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
  const { error } = await b.client.rpc('update_account', {
    p_account_id: accountA, p_name: 'intruso', p_account_type: 'cash', p_institution: 'cash', p_institution_name: null,
    p_initial_balance: 0, p_credit_limit: null, p_last_four_digits: null, p_color: null, p_icon: null, p_description: null,
    p_statement_day: null, p_payment_due_day: null,
  });
  assert(error?.code === 'LJ006', `Se esperaba LJ006 y llegó ${error?.code ?? 'éxito'}`);
  const check = await a.client.from('accounts').select('name').eq('id', accountA).single();
  assert(check.data.name === marker, 'El nombre cambió');
});
await test('B no puede registrar movimientos ni transferir desde la cuenta de A', async () => {
  const spend = await b.client.rpc('create_transaction', { p_type: 'expense', p_amount: 1, p_account_id: accountA, p_category_id: foodId });
  assert(spend.error?.code === 'LJ006', `Gasto: ${spend.error?.code ?? 'éxito'}`);
  const own = await b.client.rpc('create_account', { p_name: `${marker}-b`, p_account_type: 'cash', p_institution: 'cash' });
  const steal = await b.client.rpc('create_transaction', {
    p_type: 'transfer', p_amount: 1, p_account_id: accountA, p_destination_account_id: own.data,
  });
  assert(steal.error?.code === 'LJ006', `Transferencia: ${steal.error?.code ?? 'éxito'}`);
  const archived = await b.client.rpc('archive_account', { p_account_id: own.data, p_force: true });
  assert(!archived.error, archived.error?.message);
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
await test('Archivar las cuentas de prueba (queda en la auditoría)', async () => {
  for (const id of [bankA, cardA].filter(Boolean)) {
    const archived = await a.client.rpc('archive_account', { p_account_id: id, p_force: true });
    assert(!archived.error, archived.error?.message);
  }
  const { error } = await a.client.rpc('archive_account', { p_account_id: accountA, p_force: true });
  assert(!error, error?.message);
  const { data } = await a.client.from('audit_logs').select('action').eq('entity_id', accountA).eq('action', 'account.archived');
  assert(data.length === 1, 'No quedó el archivo de la cuenta en la auditoría');
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
