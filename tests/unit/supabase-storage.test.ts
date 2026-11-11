/**
 * La sesión se guarda solo en el llavero (SecureStore), partida en trozos.
 * Aquí SecureStore se reemplaza por un mapa en memoria que además rechaza
 * valores de más de 2.048 caracteres, como hacen algunas versiones de iOS.
 */
const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'afterFirstUnlockThisDeviceOnly',
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    if (value.length > 2048) throw new Error('Valor demasiado grande para el llavero');
    if (!/^[A-Za-z0-9._-]+$/.test(key)) throw new Error('Clave no válida');
    mockStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key);
  }),
}));

import {
  __resetForTests,
  CHUNK_SIZE,
  secureSessionStorage,
  setRememberSession,
  splitIntoChunks,
  toSecureKey,
} from '@/lib/supabase-storage';

const SUPABASE_KEY = 'sb-abcdefghijklmnopqrst-auth-token';

function fakeSession(size: number): string {
  const filler = 'x'.repeat(Math.max(size - 60, 0));
  return JSON.stringify({ access_token: filler, refresh_token: 'r', user: { id: 'u' } });
}

beforeEach(() => {
  mockStore.clear();
  __resetForTests();
});

describe('Almacenamiento seguro de la sesión', () => {
  it('genera claves válidas para el llavero', () => {
    expect(toSecureKey(SUPABASE_KEY)).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(toSecureKey('clave con espacios/y:símbolos')).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it('parte valores largos en trozos que caben en el llavero', () => {
    const value = 'a'.repeat(CHUNK_SIZE * 2 + 5);
    const chunks = splitIntoChunks(value);
    expect(chunks).toHaveLength(3);
    expect(chunks.join('')).toBe(value);
    expect(chunks.every((chunk) => chunk.length <= CHUNK_SIZE)).toBe(true);
  });

  it('guarda y recupera una sesión real de varios KB sin perder datos', async () => {
    const session = fakeSession(6000);
    await secureSessionStorage.setItem(SUPABASE_KEY, session);
    expect(await secureSessionStorage.getItem(SUPABASE_KEY)).toBe(session);
    // Ningún valor del llavero supera el límite.
    expect([...mockStore.values()].every((value) => value.length <= 2048)).toBe(true);
  });

  it('al reemplazar una sesión más larga por una corta no deja trozos viejos', async () => {
    await secureSessionStorage.setItem(SUPABASE_KEY, fakeSession(6000));
    await secureSessionStorage.setItem(SUPABASE_KEY, fakeSession(500));
    const keys = [...mockStore.keys()].filter((key) => key.startsWith(toSecureKey(SUPABASE_KEY)));
    expect(keys.length).toBe(2); // índice + 1 trozo
  });

  it('cerrar sesión borra todo del llavero', async () => {
    await secureSessionStorage.setItem(SUPABASE_KEY, fakeSession(4000));
    await secureSessionStorage.removeItem(SUPABASE_KEY);
    expect(await secureSessionStorage.getItem(SUPABASE_KEY)).toBeNull();
    expect([...mockStore.keys()].some((key) => key.startsWith(toSecureKey(SUPABASE_KEY)))).toBe(false);
  });

  it('si falta un trozo la sesión se considera inexistente (no se usa corrupta)', async () => {
    await secureSessionStorage.setItem(SUPABASE_KEY, fakeSession(5000));
    mockStore.delete(`${toSecureKey(SUPABASE_KEY)}.1`);
    expect(await secureSessionStorage.getItem(SUPABASE_KEY)).toBeNull();
  });

  it('sin «Recordar sesión» la sesión vive solo en memoria', async () => {
    await setRememberSession(false);
    await secureSessionStorage.setItem(SUPABASE_KEY, fakeSession(3000));
    expect(await secureSessionStorage.getItem(SUPABASE_KEY)).not.toBeNull();
    const sessionKeys = [...mockStore.keys()].filter((key) => key.startsWith('lujitos.auth.'));
    expect(sessionKeys).toHaveLength(0);
  });

  it('«Recordar sesión» se conserva entre aperturas de la app', async () => {
    await setRememberSession(false);
    __resetForTests(); // simula cerrar y abrir la app
    await secureSessionStorage.setItem(SUPABASE_KEY, 'temporal');
    expect([...mockStore.keys()].some((key) => key.startsWith('lujitos.auth.'))).toBe(false);
  });
});
