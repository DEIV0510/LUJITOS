/**
 * Almacenamiento de la sesión de Supabase en el LLAVERO de iOS (Expo SecureStore).
 *
 * - Los tokens nunca van a AsyncStorage ni a archivos sin cifrar.
 * - iOS puede rechazar valores grandes en el llavero, y una sesión de Supabase
 *   ocupa varios KB. Por eso cada valor se parte en trozos de 1.800 caracteres
 *   («lujitos.auth.<clave>.0», «.1», …) y una entrada índice guarda cuántos hay.
 * - Accesible solo después del primer desbloqueo del iPhone y solo en este
 *   dispositivo (no viaja a copias de iCloud).
 * - «Recordar sesión» desactivado: la sesión vive solo en memoria y desaparece
 *   al cerrar la app.
 */
import * as SecureStore from 'expo-secure-store';

export const CHUNK_SIZE = 1800;
const KEY_PREFIX = 'lujitos.auth.';
const REMEMBER_KEY = 'lujitos.remember-session';
const CHUNK_MARKER = 'chunks:';

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const memory = new Map<string, string>();
let remember = true;
let rememberLoaded: Promise<void> | null = null;

/** Las claves de SecureStore solo admiten letras, números, «.», «-» y «_». */
export function toSecureKey(key: string): string {
  return KEY_PREFIX + key.replace(/[^A-Za-z0-9._-]/g, '_');
}

export function splitIntoChunks(value: string, size = CHUNK_SIZE): string[] {
  if (value.length === 0) return [''];
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size));
  }
  return chunks;
}

function loadRememberPreference(): Promise<void> {
  rememberLoaded ??= SecureStore.getItemAsync(REMEMBER_KEY, secureOptions)
    .then((stored) => {
      remember = stored !== '0';
    })
    .catch(() => {
      remember = true;
    });
  return rememberLoaded;
}

async function readChunkCount(secureKey: string): Promise<number> {
  const head = await SecureStore.getItemAsync(secureKey, secureOptions);
  if (head?.startsWith(CHUNK_MARKER)) {
    const count = Number(head.slice(CHUNK_MARKER.length));
    return Number.isInteger(count) && count > 0 ? count : 0;
  }
  return 0;
}

async function deletePersisted(secureKey: string): Promise<void> {
  const count = await readChunkCount(secureKey);
  await Promise.all(
    Array.from({ length: count }, (_, index) =>
      SecureStore.deleteItemAsync(`${secureKey}.${index}`, secureOptions),
    ),
  );
  await SecureStore.deleteItemAsync(secureKey, secureOptions);
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    await loadRememberPreference();
    if (!remember) return memory.get(key) ?? null;
    const secureKey = toSecureKey(key);
    const head = await SecureStore.getItemAsync(secureKey, secureOptions);
    if (head === null) return null;
    if (!head.startsWith(CHUNK_MARKER)) return head;
    const count = Number(head.slice(CHUNK_MARKER.length));
    const parts = await Promise.all(
      Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(`${secureKey}.${index}`, secureOptions)),
    );
    // Si falta un trozo, la sesión está corrupta: mejor tratarla como inexistente.
    if (parts.some((part) => part === null)) return null;
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    await loadRememberPreference();
    if (!remember) {
      memory.set(key, value);
      return;
    }
    const secureKey = toSecureKey(key);
    await deletePersisted(secureKey);
    const chunks = splitIntoChunks(value);
    await Promise.all(
      chunks.map((chunk, index) => SecureStore.setItemAsync(`${secureKey}.${index}`, chunk, secureOptions)),
    );
    // El índice se escribe al final: si algo falla antes, no queda una sesión a medias.
    await SecureStore.setItemAsync(secureKey, `${CHUNK_MARKER}${chunks.length}`, secureOptions);
  },

  async removeItem(key: string): Promise<void> {
    memory.delete(key);
    await deletePersisted(toSecureKey(key));
  },
};

/** «Recordar sesión». Se guarda antes de iniciar sesión. */
export async function setRememberSession(value: boolean): Promise<void> {
  remember = value;
  rememberLoaded = Promise.resolve();
  await SecureStore.setItemAsync(REMEMBER_KEY, value ? '1' : '0', secureOptions);
}

export async function getRememberSession(): Promise<boolean> {
  await loadRememberPreference();
  return remember;
}

/** Solo para pruebas: reinicia el estado en memoria del módulo. */
export function __resetForTests() {
  memory.clear();
  remember = true;
  rememberLoaded = null;
}
