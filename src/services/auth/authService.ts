/**
 * Operaciones de autenticación con Supabase Auth.
 * Las contraseñas solo viajan a Supabase por HTTPS: nunca se guardan ni se registran.
 */
import * as Linking from 'expo-linking';

import { logError } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { setRememberSession } from '@/lib/supabase-storage';

import { authErrorMessage, DUPLICATE_ACCOUNT_MESSAGE } from './authErrors';

export type AuthResult<T = undefined> = { ok: true; data: T } | { ok: false; message: string };

/** Registra el error técnico (sin datos sensibles) y devuelve el mensaje en español. */
function fail(context: string, error: Parameters<typeof authErrorMessage>[0]): { ok: false; message: string } {
  logError(context, error);
  return { ok: false, message: authErrorMessage(error) };
}

/** Enlaces de correo: vuelven a la app (lujitos:// en la app final, exp:// en Expo Go). */
export const AUTH_CALLBACK_PATH = 'auth/callback';
export const RESET_PASSWORD_PATH = 'reset-password';

export function authRedirectUrl(path: string): string {
  return Linking.createURL(path);
}

export async function signUp(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<AuthResult<{ needsConfirmation: boolean }>> {
  await setRememberSession(true);
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: authRedirectUrl(AUTH_CALLBACK_PATH),
      // El trigger handle_new_user copia estos datos al perfil.
      data: { first_name: input.firstName, last_name: input.lastName, terms_accepted: 'true' },
    },
  });
  if (error) return fail('auth.signUp', error);
  // Correo ya registrado: con la confirmación activa Supabase no da error (para no
  // revelar qué correos existen) y devuelve un usuario sin identidades ni correo enviado.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { ok: false, message: DUPLICATE_ACCOUNT_MESSAGE };
  }
  return { ok: true, data: { needsConfirmation: !data.session } };
}

export async function signIn(input: { email: string; password: string; remember: boolean }): Promise<AuthResult> {
  await setRememberSession(input.remember);
  const { error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
  if (error) return fail('auth.signIn', error);
  return { ok: true, data: undefined };
}

export async function signOut(): Promise<AuthResult> {
  // scope 'local': cierra esta sesión; si no hay red, igual se borra del iPhone.
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) return fail('auth.signOut', error);
  return { ok: true, data: undefined };
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authRedirectUrl(RESET_PASSWORD_PATH),
  });
  // Por privacidad la app responde igual exista o no la cuenta.
  if (error && error.code !== 'user_not_found') return fail('auth.requestPasswordReset', error);
  return { ok: true, data: undefined };
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail('auth.updatePassword', error);
  return { ok: true, data: undefined };
}

export async function resendConfirmation(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: authRedirectUrl(AUTH_CALLBACK_PATH) },
  });
  if (error) return fail('auth.resendConfirmation', error);
  return { ok: true, data: undefined };
}

export type RedirectParams = {
  code?: string | string[];
  error?: string | string[];
  error_code?: string | string[];
  error_description?: string | string[];
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Completa un enlace de correo (confirmación o recuperación): canjea el código
 * PKCE por una sesión. Los errores que trae el enlace se traducen.
 */
export async function completeAuthRedirect(params: RedirectParams): Promise<AuthResult> {
  const errorCode = first(params.error_code) ?? first(params.error);
  if (errorCode) return fail('auth.redirect', { code: errorCode });
  const code = first(params.code);
  if (!code) return { ok: false, message: 'El enlace está incompleto. Pide uno nuevo.' };
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail('auth.exchangeCode', error);
  return { ok: true, data: undefined };
}
