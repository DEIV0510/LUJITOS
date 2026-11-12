-- =====================================================================
-- LUJITOS · Fase 4 · Nuevos tipos de cuenta
-- CDT y fondo de inversión cuentan como dinero invertido (no disponible).
-- Va en su propio archivo: un valor nuevo de un enum no se puede usar en la
-- misma transacción que lo crea.
-- =====================================================================

alter type public.account_type add value if not exists 'cdt' after 'investment';
alter type public.account_type add value if not exists 'investment_fund' after 'cdt';
