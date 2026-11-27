#!/bin/sh
# Restores a backup.sh file into the empty database at DATABASE_URL.
# Usage: scripts/db/restore.sh backup.dump
# See docs/runbooks/backup-restore.md. It refuses a database that already has
# the app schema, so it cannot overwrite a live one by mistake.
set -eu

: "${DATABASE_URL:?DATABASE_URL is not set. Export the owner URL of the empty database to restore into.}"

dump="${1:?Pass the dump file to restore, for example scripts/db/restore.sh fwcoach.dump}"
if [ ! -r "$dump" ]; then
  echo "Cannot read $dump. Check the path." >&2
  exit 1
fi

q() {
  psql --no-psqlrc --no-password --quiet --tuples-only --no-align -v ON_ERROR_STOP=1 \
    --dbname="$DATABASE_URL" -c "$1"
}

if [ "$(q "select count(*) from pg_namespace where nspname = 'app'")" != 0 ]; then
  echo "The target database already has an app schema. Restore into a new, empty database." >&2
  exit 1
fi

# Roles are cluster-wide, so a dump does not carry them. The grants in the
# dump name fwcoach_app and fail without it.
if [ "$(q "select count(*) from pg_roles where rolname = 'fwcoach_app'")" = 0 ]; then
  echo "Role fwcoach_app does not exist on the target server. Create it first (docs/runbooks/backup-restore.md)." >&2
  exit 1
fi

# One transaction: a restore either completes or leaves the database empty.
# --no-owner makes the restoring user the owner, as the migration user is in
# every environment, whatever it is called there.
pg_restore --no-password --no-owner --single-transaction --exit-on-error \
  --dbname="$DATABASE_URL" "$dump"

echo "Restored $dump. Compare it with scripts/db/compare.sh before relying on it."
