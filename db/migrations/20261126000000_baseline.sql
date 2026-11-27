-- migrate:up

-- Everything this project owns lives in the app schema, so a shared database
-- (or a future move to the Freshworks platform) has one clear boundary.
create schema if not exists app;

comment on schema app is
  'fwcoach telemetry. Tables are added by BE-1. See docs/data-model.md.';

-- Services never connect as the owner. The owner (the migration user)
-- bypasses row-level security, so a service running as it would make every
-- RLS policy a no-op without any test noticing. fwcoach_app is a NOLOGIN group:
-- each environment creates its own login user in it (db/init/ for compose,
-- a CI step for tests) so no password lives in a migration.
do $$
begin
  if not exists (select from pg_roles where rolname = 'fwcoach_app') then
    create role fwcoach_app nologin nosuperuser nobypassrls;
  end if;
end
$$;

grant usage on schema app to fwcoach_app;
-- Tables BE-1 creates are readable and writable by services by default.
-- Revoke per table where a service should only read (for example access_log
-- is insert-only for the API).
alter default privileges in schema app
  grant select, insert, update, delete on tables to fwcoach_app;
alter default privileges in schema app
  grant usage, select on sequences to fwcoach_app;

-- Local service user from db/init or CI, if this environment has one.
do $$
begin
  if exists (select from pg_roles where rolname = 'fwcoach_api') then
    grant fwcoach_app to fwcoach_api;
  end if;
end
$$;

-- migrate:down

alter default privileges in schema app revoke all on sequences from fwcoach_app;
alter default privileges in schema app revoke all on tables from fwcoach_app;
revoke all on schema app from fwcoach_app;
drop schema if exists app;
-- The role is cluster-wide and may have login members from db/init, so it is
-- left in place. Creating it again is a no-op.
