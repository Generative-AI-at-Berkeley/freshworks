#!/usr/bin/env bash
# Lints the up section of every dbmate migration with squawk.
# The down section is skipped on purpose: a rollback drops what its up made,
# so rules like ban-drop-table would fire on every migration.
set -euo pipefail

SQUAWK_VERSION=2.74.0
root="$(cd "$(dirname "$0")/.." && pwd)"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT

shopt -s nullglob
files=("$root"/db/migrations/*.sql)
if [ ${#files[@]} -eq 0 ]; then
  echo "No migrations in db/migrations."
  exit 0
fi

for f in "${files[@]}"; do
  # Same file name and line numbers as the source, so squawk output points at the right line.
  awk '/^-- migrate:down/ { exit } { print }' "$f" >"$out/$(basename "$f")"
done

cd "$out"
pnpm dlx "squawk-cli@${SQUAWK_VERSION}" --config "$root/.squawk.toml" ./*.sql
