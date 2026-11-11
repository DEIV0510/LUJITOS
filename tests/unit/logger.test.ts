/**
 * Registro de errores técnicos: nunca deja pasar correos, tokens, claves,
 * identificadores ni números largos (montos, cuentas, tarjetas).
 */
import { logError, redact, summarizeError } from '@/lib/logger';

describe('Registro de errores sin datos sensibles', () => {
  it('oculta correos, tokens, claves, identificadores y números largos', () => {
    const text = redact(
      'Fallo para ana.prueba@correo.co con eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.firma y sb_secret_abc123 ' +
        'en 11111111-1111-4111-8111-111111111111 por 2.500.000 en la cuenta 4111111111111111 password=Clave123',
    );
    expect(text).not.toMatch(/ana\.prueba|eyJ|sb_secret|11111111-1111|2\.500\.000|4111111111111111|Clave123/);
    expect(text).toContain('[correo]');
    expect(text).toContain('[token]');
    expect(text).toContain('[clave]');
    expect(text).toContain('[id]');
    expect(text).toContain('[número]');
  });

  it('solo guarda contexto, tipo, código, estado y mensaje limpio', () => {
    const summary = summarizeError('auth.signIn', {
      name: 'AuthApiError',
      code: 'invalid_credentials',
      status: 400,
      message: 'Invalid login for ana@correo.co',
      session: { access_token: 'eyJ.secreto' },
    });
    expect(summary).toEqual({
      context: 'auth.signIn',
      name: 'AuthApiError',
      code: 'invalid_credentials',
      status: 400,
      message: 'Invalid login for [correo]',
    });
  });

  it('en desarrollo escribe en la consola sin datos sensibles', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    logError('finance.createTransaction', { code: '23514', message: 'monto 150000 de ana@correo.co' });
    expect(warn).toHaveBeenCalledTimes(1);
    const printed = warn.mock.calls[0]!.join(' ');
    expect(printed).toContain('finance.createTransaction');
    expect(printed).not.toMatch(/150000|ana@correo/);
    warn.mockRestore();
  });
});
