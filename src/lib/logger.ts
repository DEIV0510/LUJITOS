/**
 * Registro de errores técnicos SIN información sensible.
 *
 * - Solo guarda el contexto (dónde pasó), el tipo, el código y el estado HTTP,
 *   y un mensaje con correos, tokens, claves, identificadores y números largos
 *   (montos, cuentas, tarjetas) reemplazados.
 * - En desarrollo se ve en la terminal de Expo. En la app publicada no se
 *   imprime nada: el envío a un servicio de reportes llega en la Fase 11.
 * - Nunca recibe contraseñas ni sesiones: se llama con el error, no con los datos.
 */
type ErrorSummary = { context: string; name?: string; code?: string; status?: number; message?: string };

const REDACTIONS: [RegExp, string][] = [
  [/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]'],
  [/sb_(publishable|secret)_[\w-]+/gi, '[clave]'],
  [/[\w.%+-]+@[\w.-]+\.[a-z]{2,}/gi, '[correo]'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]'],
  [/(refresh_token|access_token|password|apikey)\s*[=:]\s*\S+/gi, '$1=[oculto]'],
  // 4 cifras o más (con o sin puntos): montos como 25.000, cuentas, tarjetas, cédulas.
  [/\b\d[\d.,]{2,}\d\b/g, '[número]'],
];

export function redact(text: string): string {
  return REDACTIONS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text).slice(0, 300);
}

export function summarizeError(context: string, error: unknown): ErrorSummary {
  const summary: ErrorSummary = { context };
  if (error && typeof error === 'object') {
    const value = error as { name?: unknown; code?: unknown; status?: unknown; message?: unknown };
    if (typeof value.name === 'string') summary.name = value.name;
    if (typeof value.code === 'string') summary.code = value.code;
    if (typeof value.status === 'number') summary.status = value.status;
    if (typeof value.message === 'string') summary.message = redact(value.message);
  } else if (typeof error === 'string') {
    summary.message = redact(error);
  }
  return summary;
}

export function logError(context: string, error: unknown): void {
  if (!__DEV__) return;
  console.warn('[LUJITOS]', JSON.stringify(summarizeError(context, error)));
}
