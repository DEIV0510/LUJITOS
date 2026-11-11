-- =====================================================================
-- LUJITOS · Row Level Security
-- Regla: cada usuario solo ve y modifica sus propias filas (auth.uid()).
-- Se usa (select auth.uid()) para que Postgres lo evalúe una vez por consulta.
-- No hay políticas DELETE en datos financieros: cuentas se archivan y
-- movimientos se marcan con deleted_at (integridad histórica).
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.account_snapshots enable row level security;
alter table public.user_preferences enable row level security;

-- Permisos explícitos: no se depende de «Automatically expose new tables».
-- Primero se quita todo y luego se concede solo lo necesario a usuarios con sesión.
revoke all on public.profiles, public.accounts, public.categories, public.transactions,
  public.account_snapshots, public.user_preferences, public.account_balances from anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.profiles, public.user_preferences, public.account_balances to authenticated;
grant select, insert, update on public.accounts, public.transactions to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert on public.account_snapshots to authenticated;

-- ---------- PROFILES ----------
-- Se crean solo con el trigger de registro: sin INSERT ni DELETE para el cliente.
create policy "profiles: ver el propio" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: editar el propio" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Solo estas columnas son editables desde la app (el correo lo administra Auth).
revoke insert, update, delete on public.profiles from authenticated;
grant update (first_name, last_name, avatar_url, currency, country, timezone,
  terms_accepted_at, onboarding_completed_at) on public.profiles to authenticated;

-- ---------- USER_PREFERENCES ----------
create policy "preferences: ver las propias" on public.user_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "preferences: editar las propias" on public.user_preferences
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, update, delete on public.user_preferences from authenticated;
grant update (theme, notifications_enabled, biometric_enabled, hide_amounts, currency)
  on public.user_preferences to authenticated;

-- ---------- ACCOUNTS ----------
create policy "accounts: ver las propias" on public.accounts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "accounts: crear propias" on public.accounts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "accounts: editar las propias" on public.accounts
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke delete on public.accounts from authenticated;

-- ---------- CATEGORIES ----------
create policy "categories: ver sistema y propias" on public.categories
  for select to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy "categories: crear propias" on public.categories
  for insert to authenticated
  with check (user_id = (select auth.uid()) and is_default = false and slug is null);
create policy "categories: editar propias" on public.categories
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and is_default = false and slug is null);
-- Solo se borran categorías propias sin movimientos (la FK lo impide si tienen).
create policy "categories: borrar propias" on public.categories
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- TRANSACTIONS ----------
create policy "transactions: ver los propios" on public.transactions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "transactions: crear propios" on public.transactions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "transactions: editar los propios" on public.transactions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke delete on public.transactions from authenticated;

-- ---------- ACCOUNT_SNAPSHOTS ----------
create policy "snapshots: ver los propios" on public.account_snapshots
  for select to authenticated using (user_id = (select auth.uid()));
create policy "snapshots: crear propios" on public.account_snapshots
  for insert to authenticated with check (user_id = (select auth.uid()));
revoke update, delete on public.account_snapshots from authenticated;
