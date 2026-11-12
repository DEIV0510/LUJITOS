-- =====================================================================
-- LUJITOS · Fase 5 · Tipo de cuenta para deudas
-- Cada deuda (préstamo, crédito, deuda con un familiar…) lleva su saldo en una
-- cuenta de tipo «loan», igual que una tarjeta: saldo negativo = lo que se debe.
-- Así los pagos son transferencias (no gastos) y el patrimonio resta la deuda
-- con la misma regla única de saldos. Va en su propio archivo: un valor nuevo
-- de un enum no se puede usar en la misma transacción que lo crea.
-- =====================================================================

alter type public.account_type add value if not exists 'loan' after 'credit_card';
