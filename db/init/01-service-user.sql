-- Runs once, when the compose Postgres volume is first created
-- (docker-entrypoint-initdb.d). Creates the login user services connect as.
-- Local only: the password is a dev default, like the owner's.
-- The fwcoach_app group comes from the baseline migration, which runs after
-- this, so the user is created standalone and granted membership there.
create role fwcoach_api login password 'fwcoach_api' nosuperuser nobypassrls;
