-- migrate:up

-- The baseline's default privileges give fwcoach_app update and delete on
-- every new table. Audit tables (access_log, ingest_rejection, retention_run)
-- must not allow either, so each one opts out with app.append_only(table).
-- Two layers: the revoke stops the service, and the trigger makes a mistake
-- by the owner or a superuser fail loudly instead of quietly rewriting history.

create function app.reject_change() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only: % is not allowed.', tg_table_schema || '.' || tg_table_name, tg_op
    using errcode = 'insufficient_privilege',
          hint = 'Insert a new row instead. Removing old rows needs a migration that drops the append_only trigger, with a decision behind it.';
end
$$;

create function app.append_only(target regclass) returns void
language plpgsql as $$
begin
  -- regclass prints as a quoted, schema-qualified name, so %s is safe here.
  execute format('revoke update, delete, truncate on table %s from fwcoach_app', target);
  execute format('drop trigger if exists append_only on %s', target);
  execute format('drop trigger if exists append_only_truncate on %s', target);
  execute format(
    'create trigger append_only before update or delete on %s'
    ' for each row execute function app.reject_change()', target);
  execute format(
    'create trigger append_only_truncate before truncate on %s'
    ' for each statement execute function app.reject_change()', target);
end
$$;

comment on function app.append_only(regclass) is
  'Makes a table insert-only for services and loud for everyone else. See docs/data-model.md.';

-- Functions are executable by PUBLIC by default. Only migrations call this.
revoke execute on function app.append_only(regclass) from public;

-- migrate:down

-- Fails while any table still has the trigger, which is right: roll back the
-- migration that called append_only first.
drop function app.append_only(regclass);
drop function app.reject_change();
