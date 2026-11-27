#!/bin/sh
# Backs up the database at DATABASE_URL to one pg_dump custom-format file.
# Usage: scripts/db/backup.sh [out.dump]
# See docs/runbooks/backup-restore.md. POSIX sh so CI can run it in the
# postgres image, whose pg_dump matches the server.
set -eu

: "${DATABASE_URL:?DATABASE_URL is not set. Export the owner URL of the database to back up.}"

out="${1:-fwcoach-$(date -u +%Y%m%dT%H%M%SZ).dump}"
if [ -e "$out" ]; then
  echo "$out already exists. Pass a new file name." >&2
  exit 1
fi

# A dump holds every row, so nobody else on the machine should read it.
umask 077
# Write to a side file so a failed dump never looks like a finished one.
trap 'rm -f "$out.partial"' EXIT
pg_dump --format=custom --no-password --file="$out.partial" --dbname="$DATABASE_URL"
# A dump that pg_restore cannot list is not a backup.
pg_restore --list "$out.partial" >/dev/null
mv "$out.partial" "$out"

echo "Wrote $out ($(wc -c <"$out" | tr -d ' ') bytes)."
