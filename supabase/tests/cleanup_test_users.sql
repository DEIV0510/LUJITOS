-- Borra los usuarios de PRUEBA (dominio reservado .test) y, en cascada,
-- todos sus datos. No toca usuarios reales.
--   npm run test:users:clean
delete from auth.users where email like '%@lujitos.test';
select count(*) as usuarios_de_prueba_restantes from auth.users where email like '%@lujitos.test';
