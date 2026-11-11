/**
 * Selectores sin animación (pedido del usuario): la hoja de opciones (entidad,
 * tipo, cuenta, categoría, filtros) abre sin animación y el marcador del
 * selector segmentado salta directo a la opción elegida.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import { OptionSheet } from '@/components/ui/OptionSheet';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ThemeProvider } from '@/theme';

const PERIODS = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
];

describe('Selectores sin animación', () => {
  it('la hoja de opciones abre sin animación', async () => {
    await render(
      <ThemeProvider>
        <OptionSheet visible title="Entidad" onClose={() => undefined}>
          <Text>Bancolombia</Text>
        </OptionSheet>
      </ThemeProvider>,
    );
    expect(screen.getByText('Bancolombia')).toBeTruthy();
    expect(screen.toJSON()).toMatchObject({ type: 'Modal', props: { animationType: 'none' } });
  });

  it('el marcador del selector salta directo a la opción elegida', async () => {
    const view = (value: string) => (
      <ThemeProvider>
        <SegmentedControl options={PERIODS} value={value} onChange={() => undefined} accessibilityLabel="Periodo" />
      </ThemeProvider>
    );
    await render(view('week'));
    await fireEvent(screen.getByLabelText('Periodo'), 'layout', { nativeEvent: { layout: { width: 306, height: 38, x: 0, y: 0 } } });
    await screen.rerender(view('year'));
    // Ancho útil 300 (306 − 2×3) entre 3 opciones = 100 por opción: «Año» queda en 200 sin transición.
    expect(JSON.stringify(screen.toJSON())).toContain('"translateX":200');
  });
});
