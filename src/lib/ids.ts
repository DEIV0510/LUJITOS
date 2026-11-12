import * as Crypto from 'expo-crypto';

/**
 * Clave de idempotencia de una operación (crear cuenta, movimiento o ajuste).
 * Se genera una vez por formulario: si la solicitud se repite (doble toque,
 * reintento por mala señal), el servidor devuelve lo ya creado sin duplicarlo.
 */
export function newRequestId(): string {
  return Crypto.randomUUID();
}
