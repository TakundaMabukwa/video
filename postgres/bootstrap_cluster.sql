-- PostgreSQL bootstrap for the video system.
-- Run as a superuser, for example:
--   sudo -u postgres psql -f postgres/bootstrap_cluster.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'video_user') THEN
    CREATE ROLE video_user LOGIN PASSWORD 'CHANGE_ME_VIDEO_DB_PASSWORD';
  ELSE
    ALTER ROLE video_user WITH LOGIN PASSWORD 'CHANGE_ME_VIDEO_DB_PASSWORD';
  END IF;
END
$$;

ALTER ROLE video_user SET client_encoding TO 'utf8';
ALTER ROLE video_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE video_user SET timezone TO 'UTC';

SELECT 'CREATE DATABASE video_system OWNER video_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'video_system')\gexec
