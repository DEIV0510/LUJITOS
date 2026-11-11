-- =====================================================================
-- LUJITOS · Categorías predeterminadas del sistema (user_id NULL)
-- Son visibles para todos los usuarios y ninguno puede modificarlas.
-- slug, icon (SF Symbol) y color (tono de la paleta) coinciden con
-- src/constants/categories.ts.
-- =====================================================================

insert into public.categories (user_id, slug, name, type, icon, color, is_default)
values
  -- Ingresos
  (null, 'salary', 'Salario', 'income', 'briefcase.fill', 'forest', true),
  (null, 'business', 'Negocios', 'income', 'building.2.fill', 'teal', true),
  (null, 'sales', 'Ventas', 'income', 'tag.fill', 'sage', true),
  (null, 'services', 'Servicios', 'income', 'wrench.and.screwdriver', 'olive', true),
  (null, 'commissions', 'Comisiones', 'income', 'percent', 'gold', true),
  (null, 'investments', 'Inversiones', 'income', 'chart.line.uptrend.xyaxis', 'slate', true),
  (null, 'gifts-in', 'Regalos', 'income', 'gift.fill', 'peach', true),
  (null, 'other-in', 'Otros ingresos', 'income', 'plus.circle', 'stone', true),
  -- Gastos
  (null, 'food', 'Alimentación', 'expense', 'fork.knife', 'gold', true),
  (null, 'transport', 'Transporte', 'expense', 'car.fill', 'slate', true),
  (null, 'housing', 'Vivienda', 'expense', 'house.fill', 'taupe', true),
  (null, 'utilities', 'Servicios públicos', 'expense', 'bolt.fill', 'teal', true),
  (null, 'education', 'Educación', 'expense', 'graduationcap.fill', 'lavender', true),
  (null, 'health', 'Salud', 'expense', 'cross.case.fill', 'rose', true),
  (null, 'entertainment', 'Entretenimiento', 'expense', 'film.fill', 'amber', true),
  (null, 'shopping', 'Compras', 'expense', 'bag.fill', 'sage', true),
  (null, 'tech', 'Tecnología', 'expense', 'desktopcomputer', 'blue', true),
  (null, 'subscriptions', 'Suscripciones', 'expense', 'play.rectangle.fill', 'plum', true),
  (null, 'gym', 'Gimnasio', 'expense', 'dumbbell.fill', 'forest', true),
  (null, 'travel', 'Viajes', 'expense', 'airplane', 'blue', true),
  (null, 'family', 'Familia', 'expense', 'person.2.fill', 'peach', true),
  (null, 'taxes', 'Impuestos', 'expense', 'building.columns.fill', 'stone', true),
  (null, 'other-out', 'Otros', 'expense', 'ellipsis.circle.fill', 'olive', true)
on conflict (slug) where user_id is null do nothing;
