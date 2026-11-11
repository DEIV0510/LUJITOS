/**
 * Onboarding real (pantalla dibujada): se pueden omitir los pasos no
 * esenciales y al terminar se guardan nombre, país, moneda y zona horaria.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockCompleteOnboarding = jest.fn();
const mockSetProfile = jest.fn();
let mockProfile = { id: 'usuario-1', first_name: 'David', last_name: 'Prueba' };

jest.mock('@/hooks/auth', () => ({
  useAuth: () => ({ profile: mockProfile, setProfile: mockSetProfile, session: { user: { id: 'usuario-1' } } }),
}));
jest.mock('@/services/database/profile', () => ({
  completeOnboarding: (...args: unknown[]) => mockCompleteOnboarding(...args),
}));
// Sin módulos nativos: Reanimated (entradas y escala al presionar) y AsyncStorage (tema).
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const entering = { duration: () => entering, delay: () => entering };
  const shared = (initial: unknown) => ({ value: initial, get: () => initial, set: () => undefined });
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (component: unknown) => component },
    FadeInRight: entering,
    FadeInDown: entering,
    useSharedValue: shared,
    useAnimatedStyle: () => ({}),
    withSpring: (value: unknown) => value,
    withTiming: (value: unknown) => value,
  };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import OnboardingScreen from '@/app/onboarding';
import { ThemeProvider } from '@/theme';

const renderOnboarding = () =>
  render(
    <ThemeProvider>
      <OnboardingScreen />
    </ThemeProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile = { id: 'usuario-1', first_name: 'David', last_name: 'Prueba' };
  mockCompleteOnboarding.mockResolvedValue({ id: 'usuario-1', onboarding_completed_at: '2026-11-11' });
});

describe('Onboarding', () => {
  it('«Omitir» desde la bienvenida lleva directo al último paso y guarda con los valores de Colombia', async () => {
    await renderOnboarding();
    expect(screen.getByLabelText('Paso 1 de 5')).toBeTruthy();
    fireEvent.press(screen.getByText('Omitir'));
    expect(await screen.findByLabelText('Paso 5 de 5')).toBeTruthy();
    expect(screen.queryByText('Omitir')).toBeNull();

    fireEvent.press(screen.getByText('Entrar a LUJITOS'));
    await waitFor(() => expect(mockSetProfile).toHaveBeenCalled());
    expect(mockCompleteOnboarding).toHaveBeenCalledWith('usuario-1', {
      firstName: 'David',
      lastName: 'Prueba',
      country: 'CO',
      currency: 'COP',
      timezone: 'America/Bogota',
    });
  });

  it('el paso del nombre no se puede omitir', async () => {
    await renderOnboarding();
    fireEvent.press(screen.getByText('Empezar'));
    expect(await screen.findByLabelText('Paso 2 de 5')).toBeTruthy();
    expect(screen.queryByText('Omitir')).toBeNull();
  });

  it('si se omitió y falta el nombre, vuelve a pedirlo en vez de guardar', async () => {
    mockProfile = { id: 'usuario-1', first_name: '', last_name: '' };
    await renderOnboarding();
    fireEvent.press(screen.getByText('Omitir'));
    fireEvent.press(await screen.findByText('Entrar a LUJITOS'));
    expect(await screen.findByLabelText('Paso 2 de 5')).toBeTruthy();
    expect(mockCompleteOnboarding).not.toHaveBeenCalled();
  });
});
