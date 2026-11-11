/**
 * Flujos de autenticación con el cliente de Supabase simulado: se verifica qué
 * se envía a Supabase Auth y cómo se interpretan sus respuestas y errores.
 * La prueba contra el servidor real está en scripts/test-integration.mjs.
 */
const mockAuth = {
  signUp: jest.fn(),
  signInWithPassword: jest.fn(),
  signOut: jest.fn(),
  resetPasswordForEmail: jest.fn(),
  updateUser: jest.fn(),
  exchangeCodeForSession: jest.fn(),
  resend: jest.fn(),
};

// Getter: el mock se resuelve al usarse, después de que mockAuth existe.
jest.mock('@/lib/supabase', () => ({
  supabase: {
    get auth() {
      return mockAuth;
    },
  },
}));
jest.mock('@/lib/supabase-storage', () => ({ setRememberSession: jest.fn(async () => undefined) }));
jest.mock('expo-linking', () => ({ createURL: (path: string) => `lujitos://${path}` }));

import { setRememberSession } from '@/lib/supabase-storage';
import { authErrorMessage } from '@/services/auth/authErrors';
import {
  completeAuthRedirect,
  requestPasswordReset,
  signIn,
  signOut,
  signUp,
  updatePassword,
} from '@/services/auth/authService';
import { navigationGuards } from '@/features/auth/navigation';

describe('Registro', () => {
  it('envía nombre, apellido, aceptación de términos y el enlace de regreso', async () => {
    mockAuth.signUp.mockResolvedValue({ data: { session: null, user: { id: 'u' } }, error: null });
    const result = await signUp({ firstName: 'Ana', lastName: 'Prueba', email: 'ana@ejemplo.com', password: 'Lujitos2026' });
    expect(result).toEqual({ ok: true, data: { needsConfirmation: true } });
    expect(mockAuth.signUp).toHaveBeenCalledWith({
      email: 'ana@ejemplo.com',
      password: 'Lujitos2026',
      options: {
        emailRedirectTo: 'lujitos://auth/callback',
        data: { first_name: 'Ana', last_name: 'Prueba', terms_accepted: 'true' },
      },
    });
  });

  it('sin confirmación de correo, entra directo', async () => {
    mockAuth.signUp.mockResolvedValue({ data: { session: { access_token: 't' }, user: { id: 'u' } }, error: null });
    const result = await signUp({ firstName: 'A', lastName: 'B', email: 'a@b.co', password: 'Lujitos2026' });
    expect(result).toEqual({ ok: true, data: { needsConfirmation: false } });
  });

  it('traduce el error de correo ya registrado', async () => {
    mockAuth.signUp.mockResolvedValue({ data: {}, error: { code: 'user_already_exists', status: 422 } });
    const result = await signUp({ firstName: 'A', lastName: 'B', email: 'a@b.co', password: 'Lujitos2026' });
    expect(result).toEqual({ ok: false, message: expect.stringMatching(/Ya existe una cuenta/) });
  });
});

describe('Inicio y cierre de sesión', () => {
  it('guarda la preferencia «Recordar sesión» antes de iniciar sesión', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    await signIn({ email: 'a@b.co', password: 'x', remember: false });
    expect(setRememberSession).toHaveBeenCalledWith(false);
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.co', password: 'x' });
  });

  it('credenciales incorrectas → mensaje claro sin detalles técnicos', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: {}, error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' } });
    expect(await signIn({ email: 'a@b.co', password: 'x', remember: true })).toEqual({
      ok: false,
      message: 'Correo o contraseña incorrectos.',
    });
  });

  it('sin internet → avisa que revise la conexión', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: {}, error: { name: 'AuthRetryableFetchError', status: 0 } });
    const result = await signIn({ email: 'a@b.co', password: 'x', remember: true });
    expect(result).toEqual({ ok: false, message: expect.stringMatching(/conexión/) });
  });

  it('cerrar sesión limpia la sesión local', async () => {
    mockAuth.signOut.mockResolvedValue({ error: null });
    expect(await signOut()).toEqual({ ok: true, data: undefined });
    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});

describe('Recuperación de contraseña', () => {
  it('pide el enlace con el destino de la app', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error: null });
    expect(await requestPasswordReset('a@b.co')).toEqual({ ok: true, data: undefined });
    expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.co', { redirectTo: 'lujitos://reset-password' });
  });

  it('no revela si el correo existe', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error: { code: 'user_not_found' } });
    expect((await requestPasswordReset('nadie@b.co')).ok).toBe(true);
  });

  it('canjea el código del enlace por una sesión', async () => {
    mockAuth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    expect(await completeAuthRedirect({ code: 'abc' })).toEqual({ ok: true, data: undefined });
    expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
  });

  it('un enlace vencido muestra cómo seguir', async () => {
    const result = await completeAuthRedirect({ error: 'access_denied', error_code: 'otp_expired' });
    expect(result).toEqual({ ok: false, message: expect.stringMatching(/venció/) });
    expect(mockAuth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('un enlace sin código no intenta nada', async () => {
    expect((await completeAuthRedirect({})).ok).toBe(false);
  });

  it('guarda la contraseña nueva', async () => {
    mockAuth.updateUser.mockResolvedValue({ data: {}, error: null });
    expect(await updatePassword('Nueva2026x')).toEqual({ ok: true, data: undefined });
    expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: 'Nueva2026x' });
  });

  it('traduce errores conocidos y desconocidos', () => {
    expect(authErrorMessage({ code: 'same_password' })).toMatch(/distinta/);
    expect(authErrorMessage({ code: 'algo_raro', status: 500 })).toBe('No pudimos completar la operación. Inténtalo de nuevo.');
  });
});

describe('Protección de rutas', () => {
  it('mientras se comprueba la sesión no se abre ninguna zona', () => {
    expect(navigationGuards({ status: 'loading', onboarded: true, recovery: false })).toEqual({
      loading: true,
      setup: false,
      app: false,
      onboarding: false,
      auth: false,
      home: '/welcome',
    });
  });

  it('sin sesión solo se ve el acceso', () => {
    const guards = navigationGuards({ status: 'signedOut', onboarded: true, recovery: false });
    expect(guards).toMatchObject({ app: false, onboarding: false, auth: true, home: '/welcome' });
  });

  it('con sesión nueva va al onboarding; con onboarding completo, a la app', () => {
    expect(navigationGuards({ status: 'signedIn', onboarded: false, recovery: false })).toMatchObject({
      app: false,
      onboarding: true,
      auth: false,
      home: '/onboarding',
    });
    expect(navigationGuards({ status: 'signedIn', onboarded: true, recovery: false })).toMatchObject({
      app: true,
      onboarding: false,
      auth: false,
      home: '/',
    });
  });

  it('durante la recuperación de contraseña todo lo demás queda cerrado', () => {
    for (const status of ['signedIn', 'signedOut'] as const) {
      expect(navigationGuards({ status, onboarded: true, recovery: true })).toMatchObject({
        app: false,
        onboarding: false,
        auth: false,
        home: '/reset-password',
      });
    }
  });

  it('sin configuración de Supabase solo se ve la guía de configuración', () => {
    expect(navigationGuards({ status: 'unconfigured', onboarded: false, recovery: false })).toMatchObject({ setup: true, app: false, auth: false });
  });
});
