-- migrate:up

-- Backstop timeouts for services. The API pool sets its own, tighter ones in
-- services/api/src/db.ts. These catch any connection that skips the pool
-- (a job, a psql session as the service user, a new service).
--
-- statement_timeout 30s: API queries should take milliseconds, and a rollup
--   job that needs longer can `set local statement_timeout` in its own
--   transaction. Anything past 30s on a service connection is a bug or a
--   missing index, and it holds a connection and its locks while it runs.
-- lock_timeout 5s: a service waiting on a lock is almost always stuck behind
--   a migration or a long transaction. Failing fast frees the pool and lets
--   the caller retry, instead of queueing every request behind the lock.
-- idle_in_transaction_session_timeout 60s: a transaction left open by a
--   crashed request holds row locks and blocks vacuum. Nothing in the
--   services waits for user input mid-transaction, so a minute is generous.
--
-- Postgres applies role settings from the login role only, never from groups
-- it belongs to. fwcoach_app is a NOLOGIN group, so the settings go on it
-- (for the record) and on every login member it has now. A login user added
-- to fwcoach_app later needs the same three `alter role` lines.
do $$
declare
  r name;
begin
  for r in
    select 'fwcoach_app'::name
    union
    select m.rolname
    from pg_auth_members am
    join pg_roles g on g.oid = am.roleid
    join pg_roles m on m.oid = am.member
    where g.rolname = 'fwcoach_app' and m.rolcanlogin
  loop
    execute format('alter role %I set statement_timeout = %L', r, '30s');
    execute format('alter role %I set lock_timeout = %L', r, '5s');
    execute format('alter role %I set idle_in_transaction_session_timeout = %L', r, '60s');
  end loop;
end
$$;

-- migrate:down

do $$
declare
  r name;
begin
  for r in
    select 'fwcoach_app'::name
    union
    select m.rolname
    from pg_auth_members am
    join pg_roles g on g.oid = am.roleid
    join pg_roles m on m.oid = am.member
    where g.rolname = 'fwcoach_app' and m.rolcanlogin
  loop
    execute format('alter role %I reset statement_timeout', r);
    execute format('alter role %I reset lock_timeout', r);
    execute format('alter role %I reset idle_in_transaction_session_timeout', r);
  end loop;
end
$$;
