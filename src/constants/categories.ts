import type { Category } from '@/types/finance';

/** Categorías iniciales de LUJITOS. El usuario podrá crear las suyas (Fase 5). */
export const CATEGORIES: Category[] = [
  // Ingresos
  { id: 'salary', name: 'Salario', kind: 'income', icon: 'briefcase.fill', tone: 'forest' },
  { id: 'business', name: 'Negocios', kind: 'income', icon: 'building.2.fill', tone: 'teal' },
  { id: 'sales', name: 'Ventas', kind: 'income', icon: 'tag.fill', tone: 'sage' },
  { id: 'services', name: 'Servicios', kind: 'income', icon: 'wrench.and.screwdriver', tone: 'olive' },
  { id: 'commissions', name: 'Comisiones', kind: 'income', icon: 'percent', tone: 'gold' },
  { id: 'investments', name: 'Inversiones', kind: 'income', icon: 'chart.line.uptrend.xyaxis', tone: 'slate' },
  { id: 'gifts-in', name: 'Regalos', kind: 'income', icon: 'gift.fill', tone: 'peach' },
  { id: 'other-in', name: 'Otros ingresos', kind: 'income', icon: 'plus.circle', tone: 'stone' },
  // Gastos
  { id: 'food', name: 'Alimentación', kind: 'expense', icon: 'fork.knife', tone: 'gold' },
  { id: 'transport', name: 'Transporte', kind: 'expense', icon: 'car.fill', tone: 'slate' },
  { id: 'housing', name: 'Vivienda', kind: 'expense', icon: 'house.fill', tone: 'taupe' },
  { id: 'utilities', name: 'Servicios públicos', kind: 'expense', icon: 'bolt.fill', tone: 'teal' },
  { id: 'education', name: 'Educación', kind: 'expense', icon: 'graduationcap.fill', tone: 'lavender' },
  { id: 'health', name: 'Salud', kind: 'expense', icon: 'cross.case.fill', tone: 'rose' },
  { id: 'entertainment', name: 'Entretenimiento', kind: 'expense', icon: 'film.fill', tone: 'amber' },
  { id: 'shopping', name: 'Compras', kind: 'expense', icon: 'bag.fill', tone: 'sage' },
  { id: 'tech', name: 'Tecnología', kind: 'expense', icon: 'desktopcomputer', tone: 'blue' },
  { id: 'subscriptions', name: 'Suscripciones', kind: 'expense', icon: 'play.rectangle.fill', tone: 'plum' },
  { id: 'gym', name: 'Gimnasio', kind: 'expense', icon: 'dumbbell.fill', tone: 'forest' },
  { id: 'travel', name: 'Viajes', kind: 'expense', icon: 'airplane', tone: 'blue' },
  { id: 'family', name: 'Familia', kind: 'expense', icon: 'person.2.fill', tone: 'peach' },
  { id: 'taxes', name: 'Impuestos', kind: 'expense', icon: 'building.columns.fill', tone: 'stone' },
  { id: 'other-out', name: 'Otros', kind: 'expense', icon: 'ellipsis.circle.fill', tone: 'olive' },
];

/** Pseudocategoría para mostrar transferencias entre cuentas propias. */
export const TRANSFER_CATEGORY: Category = {
  id: 'transfer',
  name: 'Transferencia',
  kind: 'expense',
  icon: 'arrow.left.arrow.right',
  tone: 'stone',
};

const byId = new Map(CATEGORIES.map((category) => [category.id, category]));

export function getCategory(id: string | undefined): Category {
  if (id === TRANSFER_CATEGORY.id) return TRANSFER_CATEGORY;
  return (id && byId.get(id)) || CATEGORIES[CATEGORIES.length - 1]!;
}

export function categoriesOf(kind: Category['kind']): Category[] {
  return CATEGORIES.filter((category) => category.kind === kind);
}
