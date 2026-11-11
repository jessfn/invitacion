-- Crea la base de datos de la invitación en PostgreSQL.
-- Ejecutar como superusuario:  sudo -u postgres psql -f deploy/crear-base.sql
-- Es seguro repetirlo: si la base ya existe no hace nada. Las tablas las crea la aplicación al arrancar.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'jesus') THEN
    RAISE EXCEPTION 'El rol "jesus" no existe en PostgreSQL. Créalo antes: CREATE ROLE jesus LOGIN PASSWORD ''...'';';
  END IF;
END
$$;

SELECT 'CREATE DATABASE invitaciondgtic OWNER jesus ENCODING ''UTF8'' TEMPLATE template0'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'invitaciondgtic')
\gexec
