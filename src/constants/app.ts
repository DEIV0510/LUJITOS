/**
 * Datos fijos de la aplicación. Toda la lógica de fechas y dinero debe leer
 * el locale, la moneda y la zona horaria desde aquí, nunca escribirlos a mano.
 */
export const APP = {
  name: 'LUJITOS',
  tagline: 'Personal Finance Manager',
  country: 'CO',
  locale: 'es-CO',
  currency: 'COP',
  timeZone: 'America/Bogota',
} as const;
