/**
 * Traduce los errores de Supabase Auth a mensajes claros en español.
 * Nunca se muestra el mensaje técnico original ni datos sensibles.
 */
type AuthLikeError = { code?: string; status?: number; message?: string; name?: string } | null | undefined;

const BY_CODE: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'Todavía no confirmas tu correo. Revisa tu bandeja de entrada (y la de spam).',
  user_already_exists: 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.',
  email_exists: 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.',
  weak_password: 'La contraseña es muy débil. Usa al menos 8 caracteres con mayúsculas, minúsculas y números.',
  same_password: 'La nueva contraseña debe ser distinta de la anterior.',
  email_address_invalid: 'Ese correo no es válido.',
  email_address_not_authorized:
    'Supabase no puede enviar correos a esa dirección con el servidor de correo de prueba. Configura un SMTP propio (ver docs/SUPABASE.md).',
  over_email_send_rate_limit: 'Se enviaron demasiados correos. Espera unos minutos e inténtalo de nuevo.',
  over_request_rate_limit: 'Demasiados intentos seguidos. Espera un momento.',
  otp_expired: 'El enlace venció o ya se usó. Pide uno nuevo.',
  flow_state_expired: 'El enlace venció. Pide uno nuevo.',
  flow_state_not_found: 'Este enlace se abrió en otro dispositivo o ya se usó. Inicia sesión con tu contraseña.',
  bad_code_verifier: 'Este enlace se abrió en otro dispositivo. Inicia sesión con tu contraseña.',
  session_not_found: 'Tu sesión terminó. Inicia sesión de nuevo.',
  refresh_token_not_found: 'Tu sesión terminó. Inicia sesión de nuevo.',
  user_banned: 'Esta cuenta está bloqueada.',
  signup_disabled: 'El registro está desactivado en este proyecto.',
};

export const SESSION_EXPIRED_MESSAGE = 'Tu sesión terminó. Inicia sesión de nuevo.';
export const DUPLICATE_ACCOUNT_MESSAGE = BY_CODE.user_already_exists!;
export const OFFLINE_MESSAGE = 'Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';

/** Error de red (sin internet, servidor inalcanzable): la sesión guardada sigue siendo válida. */
export function isNetworkAuthError(error: AuthLikeError): boolean {
  if (!error) return false;
  return error.name === 'AuthRetryableFetchError' || error.status === 0 || /network|fetch/i.test(error.message ?? '');
}

export function authErrorMessage(error: AuthLikeError): string {
  if (!error) return 'Ocurrió un error inesperado.';
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code]!;
  if (isNetworkAuthError(error)) return OFFLINE_MESSAGE;
  if (error.status === 429) return BY_CODE.over_request_rate_limit!;
  return 'No pudimos completar la operación. Inténtalo de nuevo.';
}
