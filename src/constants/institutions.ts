import type { Tone } from '@/theme';
import type { AccountGroup, AccountKind, IconName, Institution, InstitutionId } from '@/types/finance';

/**
 * Entidades de la lista. El identificador visual usa iniciales y un tono de la
 * paleta LUJITOS: no se reproducen logotipos ni colores oficiales de las marcas.
 * Cualquier otra entidad se escribe a mano (institution = 'custom').
 */
export const INSTITUTIONS: Record<InstitutionId, Institution> = {
  bancolombia: { id: 'bancolombia', name: 'Bancolombia', initials: 'BC', tone: 'gold' },
  davivienda: { id: 'davivienda', name: 'Davivienda', initials: 'DV', tone: 'clay' },
  bbva: { id: 'bbva', name: 'BBVA', initials: 'BV', tone: 'blue' },
  bogota: { id: 'bogota', name: 'Banco de Bogotá', initials: 'BB', tone: 'slate' },
  cajasocial: { id: 'cajasocial', name: 'Banco Caja Social', initials: 'CS', tone: 'teal' },
  nu: { id: 'nu', name: 'Nu', initials: 'NU', tone: 'lavender' },
  nequi: { id: 'nequi', name: 'Nequi', initials: 'NQ', tone: 'plum' },
  daviplata: { id: 'daviplata', name: 'Daviplata', initials: 'DP', tone: 'rose' },
  cash: { id: 'cash', name: 'Efectivo', initials: 'EF', tone: 'sage', icon: 'banknote.fill' },
  custom: { id: 'custom', name: 'Otra entidad', initials: 'OT', tone: 'olive', icon: 'building.columns.fill' },
};

/** Orden y grupos del selector de entidades. */
export const INSTITUTION_GROUPS: { title: string; ids: InstitutionId[] }[] = [
  { title: 'Bancos', ids: ['bancolombia', 'davivienda', 'bbva', 'bogota', 'cajasocial', 'nu'] },
  { title: 'Billeteras digitales', ids: ['nequi', 'daviplata'] },
  { title: 'Otras', ids: ['cash', 'custom'] },
];

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  bank: 'Cuenta bancaria',
  savings: 'Cuenta de ahorros',
  checking: 'Cuenta corriente',
  digital_wallet: 'Billetera digital',
  cash: 'Efectivo',
  investment: 'Cuenta de inversión',
  cdt: 'CDT',
  investment_fund: 'Fondo de inversión',
  credit_card: 'Tarjeta de crédito',
  loan: 'Deuda',
  other: 'Cuenta personalizada',
};

/** Orden del selector de tipos. */
export const ACCOUNT_KINDS: AccountKind[] = [
  'savings',
  'checking',
  'bank',
  'digital_wallet',
  'cash',
  'credit_card',
  'investment',
  'cdt',
  'investment_fund',
  'other',
];

export const ACCOUNT_KIND_ICON: Record<AccountKind, IconName> = {
  bank: 'building.columns.fill',
  savings: 'banknote.fill',
  checking: 'building.columns.fill',
  digital_wallet: 'iphone',
  cash: 'banknote.fill',
  investment: 'chart.line.uptrend.xyaxis',
  cdt: 'lock.fill',
  investment_fund: 'chart.pie.fill',
  credit_card: 'creditcard.fill',
  loan: 'banknote',
  other: 'wallet.pass.fill',
};

export const ACCOUNT_GROUP_LABEL: Record<AccountGroup, string> = {
  banks: 'Bancos',
  wallets: 'Billeteras digitales',
  cash: 'Efectivo',
  other: 'Otras cuentas',
  investments: 'Inversiones',
  credit: 'Tarjetas de crédito',
  debts: 'Deudas',
};

/** Mismo criterio que public.financial_summary(): no cambiar uno sin el otro. */
export function groupOf(kind: AccountKind): AccountGroup {
  switch (kind) {
    case 'bank':
    case 'savings':
    case 'checking':
      return 'banks';
    case 'digital_wallet':
      return 'wallets';
    case 'cash':
      return 'cash';
    case 'investment':
    case 'cdt':
    case 'investment_fund':
      return 'investments';
    case 'credit_card':
      return 'credit';
    case 'loan':
      return 'debts';
    default:
      return 'other';
  }
}

export const METHOD_LABEL = {
  manual: 'Registro manual',
  imported: 'Importada',
  connected: 'Conectada',
} as const;

/** Ejemplos para crear una cuenta en un toque (el usuario puede cambiar todo). */
export type AccountPreset = {
  key: string;
  label: string;
  name: string;
  institution: InstitutionId;
  kind: AccountKind;
};

export const ACCOUNT_PRESETS: AccountPreset[] = [
  { key: 'bc-ahorros', label: 'Ahorros Bancolombia', name: 'Ahorros', institution: 'bancolombia', kind: 'savings' },
  { key: 'nequi', label: 'Nequi', name: 'Nequi', institution: 'nequi', kind: 'digital_wallet' },
  { key: 'daviplata', label: 'Daviplata', name: 'Daviplata', institution: 'daviplata', kind: 'digital_wallet' },
  { key: 'efectivo', label: 'Efectivo', name: 'Efectivo', institution: 'cash', kind: 'cash' },
  { key: 'nu', label: 'Cuenta Nu', name: 'Cuenta Nu', institution: 'nu', kind: 'savings' },
  { key: 'tarjeta', label: 'Tarjeta de crédito', name: 'Tarjeta de crédito', institution: 'bancolombia', kind: 'credit_card' },
  { key: 'cdt', label: 'CDT', name: 'CDT', institution: 'bancolombia', kind: 'cdt' },
];

/** Tonos ofrecidos como color identificador de una cuenta. */
export const ACCOUNT_TONES: Tone[] = ['gold', 'sage', 'forest', 'teal', 'slate', 'blue', 'lavender', 'plum', 'rose', 'clay', 'amber', 'stone'];

/** Íconos ofrecidos para una cuenta (SF Symbols disponibles desde iOS 16). */
export const ACCOUNT_ICONS: IconName[] = [
  'building.columns.fill',
  'banknote.fill',
  'creditcard.fill',
  'iphone',
  'wallet.pass.fill',
  'chart.line.uptrend.xyaxis',
  'chart.pie.fill',
  'lock.fill',
  'house.fill',
  'briefcase.fill',
  'car.fill',
  'gift.fill',
];
