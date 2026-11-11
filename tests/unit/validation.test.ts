import {
  fieldErrors,
  newPasswordSchema,
  passwordStrength,
  signInSchema,
  signUpSchema,
} from '@/features/auth/validation';

const valid = {
  firstName: 'Ana María',
  lastName: "O'Neill Gómez",
  email: '  Ana.Prueba@Ejemplo.COM ',
  password: 'Lujitos2026',
  confirmPassword: 'Lujitos2026',
  acceptTerms: true as const,
};

describe('Registro', () => {
  it('acepta un registro válido y normaliza el correo', () => {
    const result = signUpSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('ana.prueba@ejemplo.com');
  });

  it('exige aceptar los términos', () => {
    const result = signUpSchema.safeParse({ ...valid, acceptTerms: false });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).acceptTerms).toMatch(/términos/);
  });

  it('detecta contraseñas que no coinciden', () => {
    const result = signUpSchema.safeParse({ ...valid, confirmPassword: 'Lujitos2027' });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).confirmPassword).toBe('Las contraseñas no coinciden.');
  });

  it.each([
    ['corta', 'Ab1'],
    ['sin mayúscula', 'lujitos2026'],
    ['sin minúscula', 'LUJITOS2026'],
    ['sin número', 'LujitosLujitos'],
  ])('rechaza una contraseña %s', (_, password) => {
    const result = signUpSchema.safeParse({ ...valid, password, confirmPassword: password });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).password).toBeDefined();
  });

  it.each(['sin-arroba.com', 'a@b', 'espacio @correo.com', ''])('rechaza el correo «%s»', (email) => {
    const result = signUpSchema.safeParse({ ...valid, email });
    expect(result.success).toBe(false);
  });

  it('rechaza nombres con números o vacíos', () => {
    expect(signUpSchema.safeParse({ ...valid, firstName: 'R2D2' }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, lastName: ' ' }).success).toBe(false);
  });
});

describe('Inicio de sesión y nueva contraseña', () => {
  it('pide correo y contraseña', () => {
    const result = signInSchema.safeParse({ email: '', password: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrors(result.error);
      expect(errors.email).toBeDefined();
      expect(errors.password).toBeDefined();
    }
  });

  it('la nueva contraseña cumple las mismas reglas y debe coincidir', () => {
    expect(newPasswordSchema.safeParse({ password: 'Nueva2026x', confirmPassword: 'Nueva2026x' }).success).toBe(true);
    expect(newPasswordSchema.safeParse({ password: 'nueva', confirmPassword: 'nueva' }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: 'Nueva2026x', confirmPassword: 'Nueva2026y' }).success).toBe(false);
  });
});

describe('Indicador de contraseña segura', () => {
  it('sube con longitud y variedad', () => {
    expect(passwordStrength('').score).toBe(0);
    expect(passwordStrength('abc').score).toBe(0);
    expect(passwordStrength('Lujitos2026').score).toBeGreaterThanOrEqual(2);
    expect(passwordStrength('Lujitos-2026-Seguro').score).toBe(4);
  });

  it('castiga patrones obvios', () => {
    expect(passwordStrength('Password1234').score).toBeLessThan(passwordStrength('Mangle7Rio!x').score);
  });
});
