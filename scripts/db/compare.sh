#!/bin/sh
# Compares a restored database (DATABASE_URL) with its source
# (SOURCE_DATABASE_URL): schema, grants, and exact row counts per table.
# Exits 1 on any difference. Usage: scripts/db/compare.sh
# See docs/runbooks/backup-restore.md. Against a live source, row counts can
# be higher on the source side by whatever was written after the backup.
set -eu

: "${SOURCE_DATABASE_URL:?SOURCE_DATABASE_URL is not set. Export the owner URL of the database the backup came from.}"
: "${DATABASE_URL:?DATABASE_URL is not set. Export the owner URL of the restored database.}"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# Owners differ by design (restore.sh uses --no-owner). Comments and the
# \restrict lines carry versions and a random key per dump, so they go too.
# Some pg_dump builds (Homebrew 18.4) also print a per-database pg_attver
# stamp on every column, which never matches across databases.
schema() {
  pg_dump --schema-only --no-owner --no-password --dbname="$1" |
    grep -v -e '^--' -e '^\\restrict' -e '^\\unrestrict' -e '^$' -e 'pg_attver='
}

# Exact counts, not pg_class estimates. Table names come from the catalog and
# are quoted with %I, never taken from input.
counts() {
  psql --no-psqlrc --no-password --quiet --tuples-only --no-align -v ON_ERROR_STOP=1 \
    --dbname="$1" -c "
    select n.nspname || '.' || c.relname || ' ' ||
      (xpath('/row/n/text()', query_to_xml(
        format('select count(*) as n from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p') and n.nspname in ('app', 'public')
    order by 1"
}

schema "$SOURCE_DATABASE_URL" >"$work/source.sql"
schema "$DATABASE_URL" >"$work/restored.sql"
counts "$SOURCE_DATABASE_URL" >"$work/source.counts"
counts "$DATABASE_URL" >"$work/restored.counts"

status=0
if ! diff -u "$work/source.sql" "$work/restored.sql"; then
  echo "Schema differs between source and restored database." >&2
  status=1
fi
if ! diff -u "$work/source.counts" "$work/restored.counts"; then
  echo "Row counts differ between source and restored database." >&2
  status=1
fi

if [ "$status" = 0 ]; then
  echo "Schema matches. Row counts per table:"
  cat "$work/restored.counts"
fi
exit "$status"
