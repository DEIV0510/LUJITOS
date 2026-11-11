/**
 * Cliente único de Supabase para toda la app.
 *
 * - Usa la URL y la clave PUBLICABLE (EXPO_PUBLIC_*). La clave service_role
 *   nunca va en la app: los permisos los decide el RLS de PostgreSQL.
 * - Sesión cifrada en el llavero de iOS (supabase-storage.ts).
 * - Flujo PKCE: los enlaces de correo traen un código de un solo uso, nunca
 *   tokens visibles en la URL.
 * - La renovación automática del token se pausa cuando la app pasa a segundo
 *   plano y se reanuda al volver (recomendación oficial de Supabase).
 */
import 'react-native-url-polyfill/auto';

import { createClient, processLock } from '@supabase/supabase-js';
import { AppState, type AppStateStatus } from 'react-native';

import type { Database } from '@/types/database';

import { secureSessionStorage } from './supabase-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/** false si faltan las variables de .env.local: la app muestra cómo configurarlas. */
export const isSupabaseConfigured =
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) && publishableKey.length > 20 && !publishableKey.includes('reemplaza');

export const supabase = createClient<Database>(
  isSupabaseConfigured ? url : 'https://sin-configurar.supabase.co',
  isSupabaseConfigured ? publishableKey : 'sin-configurar',
  {
    auth: {
      storage: secureSessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      lock: processLock,
    },
  },
);

let lifecycleStarted = false;

/** Se llama una sola vez al arrancar la app. */
export function startSessionLifecycle(): void {
  if (lifecycleStarted || !isSupabaseConfigured) return;
  lifecycleStarted = true;
  const apply = (state: AppStateStatus) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  };
  apply(AppState.currentState === 'active' ? 'active' : 'background');
  AppState.addEventListener('change', apply);
}
