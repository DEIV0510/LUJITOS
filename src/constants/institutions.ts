import type { AccountGroup, AccountKind, Institution, InstitutionId } from '@/types/finance';

/**
 * Entidades compatibles. El identificador visual usa iniciales y un tono de la
 * paleta LUJITOS: no se reproducen logotipos ni colores oficiales de las marcas.
 */
export const INSTITUTIONS: Record<InstitutionId, Institution> = {
  bancolombia: { id: 'bancolombia', name: 'Bancolombia', initials: 'BC', tone: 'gold' },
  nequi: { id: 'nequi', name: 'Nequi', initials: 'NQ', tone: 'plum' },
  davivienda: { id: 'davivienda', name: 'Davivienda', initials: 'DV', tone: 'clay' },
  daviplata: { id: 'daviplata', name: 'Daviplata', initials: 'DP', tone: 'rose' },
  bbva: { id: 'bbva', name: 'BBVA', initials: 'BV', tone: 'blue' },
  bogota: { id: 'bogota', name: 'Banco de Bogotá', initials: 'BB', tone: 'slate' },
  cash: { id: 'cash', name: 'Efectivo', initials: 'EF', tone: 'sage', icon: 'banknote.fill' },
  custom: { id: 'custom', name: 'Personalizada', initials: 'OT', tone: 'olive', icon: 'wallet.pass.fill' },
};

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  bank: 'Cuenta bancaria',
  savings: 'Cuenta de ahorros',
  checking: 'Cuenta corriente',
  digital_wallet: 'Billetera digital',
  cash: 'Efectivo',
  investment: 'Inversión',
  credit_card: 'Tarjeta de crédito',
  other: 'Cuenta personalizada',
};

export const ACCOUNT_GROUP_LABEL: Record<AccountGroup, string> = {
  banks: 'Bancos',
  wallets: 'Billeteras digitales',
  cash: 'Efectivo',
  other: 'Otras cuentas',
  investments: 'Inversiones',
  credit: 'Tarjetas de crédito',
};

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
      return 'investments';
    case 'credit_card':
      return 'credit';
    default:
      return 'other';
  }
}

export const METHOD_LABEL = {
  manual: 'Registro manual',
  imported: 'Importada',
  connected: 'Conectada',
} as const;
