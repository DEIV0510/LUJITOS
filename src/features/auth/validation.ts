/**
 * Validaciones de los formularios de acceso. La base de datos y Supabase Auth
 * validan otra vez del lado del servidor: esto solo da mensajes claros antes
 * de enviar.
 */
import { z } from 'zod';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_PATTERN = /^[\p{L}][\p{L}' .-]*$/u;

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Escribe al menos 2 letras.')
  .max(60, 'Máximo 60 caracteres.')
  .regex(NAME_PATTERN, 'Usa solo letras.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Escribe tu correo.')
  .max(254, 'Correo demasiado largo.')
  .regex(EMAIL_PATTERN, 'Revisa el correo: falta algo.');

/** Mismas reglas que se configuran en Supabase Auth (docs/SUPABASE.md). */
export const passwordSchema = z
  .string()
  .min(8, 'Mínimo 8 caracteres.')
  .max(72, 'Máximo 72 caracteres.')
  .regex(/[a-z]/, 'Incluye una letra minúscula.')
  .regex(/[A-Z]/, 'Incluye una letra mayúscula.')
  .regex(/[0-9]/, 'Incluye un número.');

export const signUpSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Repite la contraseña.'),
    acceptTerms: z.literal(true, 'Debes aceptar los términos y la política de privacidad.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Escribe tu contraseña.'),
});

export const resetRequestSchema = z.object({ email: emailSchema });

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string().min(1, 'Repite la contraseña.') })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  });

export const profileNamesSchema = z.object({ firstName: nameSchema, lastName: nameSchema });

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;

/** Primer mensaje de error por campo, listo para mostrar bajo cada input. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    result[key] ??= issue.message;
  }
  return result;
}

export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: string };

/** Indicador visual de fortaleza (0 = muy débil … 4 = muy fuerte). */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length === 0) return { score: 0, label: '' };
  let points = 0;
  if (password.length >= 8) points += 1;
  if (password.length >= 12) points += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points += 1;
  if (/[0-9]/.test(password)) points += 1;
  if (/[^A-Za-z0-9]/.test(password)) points += 1;
  // Patrones obvios restan.
  if (/^(.)\1+$/.test(password) || /(1234|abcd|qwerty|password|contrase)/i.test(password)) points -= 2;
  const score = Math.max(0, Math.min(4, points - 1)) as PasswordStrength['score'];
  const labels = ['Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Muy fuerte'] as const;
  return { score, label: labels[score] };
}
