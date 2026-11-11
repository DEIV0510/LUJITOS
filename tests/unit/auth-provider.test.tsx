/**
 * Estados de sesión de AuthProvider (el proveedor real, con Supabase simulado):
 * restaurar la sesión al abrir, sin conexión, sesión vencida y cierre de sesión.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

type Listener = (event: string, session: unknown) => void;

const mockListeners: Listener[] = [];
const mockAuth = {
  getSession: jest.fn(),
  onAuthStateChange: jest.fn((listener: Listener) => {
    mockListeners.push(listener);
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  }),
};
const mockSignOut = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  startSessionLifecycle: jest.fn(),
  supabase: {
    get auth() {
      return mockAuth;
    },
  },
}));
jest.mock('@/services/auth/authService', () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));
jest.mock('@/services/database/profile', () => ({
  fetchProfile: jest.fn(async (id: string) => ({ id, first_name: 'David', onboarding_completed_at: '2026-11-11' })),
}));

import { AuthProvider, useAuth } from '@/hooks/auth/AuthProvider';
import { SESSION_EXPIRED_MESSAGE } from '@/services/auth/authErrors';

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
const session = { user: { id: 'usuario-1' }, access_token: 'a', refresh_token: 'r' };
const emit = (event: string, value: unknown) =>
  act(async () => {
    mockListeners.forEach((listener) => listener(event, value));
  });

beforeEach(() => {
  mockListeners.length = 0;
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('Restaurar la sesión al abrir LUJITOS', () => {
  it('con sesión guardada entra directo', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });
    const { result } = await renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    expect(result.current.notice).toBeNull();
  });

  it('sin sesión guardada muestra la bienvenida sin avisos', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const { result } = await renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.notice).toBeNull();
  });

  it('sin internet NO cierra la sesión: queda «Sin conexión» y se puede reintentar', async () => {
    mockAuth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: { name: 'AuthRetryableFetchError', status: 0, message: 'Network request failed' },
    });
    const { result } = await renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.status).toBe('offline'));

    mockAuth.getSession.mockResolvedValueOnce({ data: { session }, error: null });
    await act(async () => {
      await result.current.retrySession();
    });
    await waitFor(() => expect(result.current.status).toBe('signedIn'));
  });

  it('si la sesión guardada venció, vuelve a la bienvenida explicando por qué', async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: { name: 'AuthApiError', code: 'refresh_token_not_found', status: 400, message: 'Invalid Refresh Token' },
    });
    const { result } = await renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.notice).toBe(SESSION_EXPIRED_MESSAGE);
  });
});

describe('Sesión con la app abierta', () => {
  it('si Supabase cierra la sesión (token revocado), avisa «Tu sesión terminó»', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });
    const { result } = await renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedIn'));

    await emit('SIGNED_OUT', null);
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.notice).toBe(SESSION_EXPIRED_MESSAGE);

    // Al volver a entrar, el aviso desaparece.
    await emit('SIGNED_IN', session);
    await waitFor(() => expect(result.current.notice).toBeNull());
  });

  it('cerrar sesión por decisión del usuario no muestra el aviso, ni por un instante', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });
    let finishSignOut!: () => void;
    mockSignOut.mockImplementation(async () => {
      // Supabase emite SIGNED_OUT mientras se cierra la sesión; la respuesta llega después.
      mockListeners.forEach((listener) => listener('SIGNED_OUT', null));
      await new Promise<void>((resolve) => {
        finishSignOut = resolve;
      });
      return { ok: true, data: undefined };
    });
    const { result } = await renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signedIn'));

    let pending!: Promise<unknown>;
    await act(async () => {
      pending = result.current.signOut();
    });
    // Ya se emitió SIGNED_OUT y la bienvenida se dibuja: no debe decir «Tu sesión terminó».
    expect(result.current.status).toBe('signedOut');
    expect(result.current.notice).toBeNull();

    await act(async () => {
      finishSignOut();
      await pending;
    });
    expect(result.current.notice).toBeNull();
    expect(result.current.profile).toBeNull();
  });
});
