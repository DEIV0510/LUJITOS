-- =====================================================================
-- LUJITOS · Cerrar la función de «Enable automatic RLS»
-- Al crear el proyecto con esa opción, Supabase agrega public.rls_auto_enable()
-- (SECURITY DEFINER, usada por un event trigger). Por estar en el esquema public,
-- anon y authenticated podían llamarla por /rest/v1/rpc. El event trigger la sigue
-- ejecutando igual: los triggers no revisan EXECUTE al dispararse.
-- Si la función no existe (base local o proyecto sin esa opción), no hace nada.
-- =====================================================================

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
