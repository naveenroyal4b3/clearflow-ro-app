#!/usr/bin/env bash
# Restores a backup into an empty Supabase database exactly as SUPABASE_SETUP.md describes, then
# checks that every table has as many rows as the backup holds.
# Usage: scripts/verify-backup-restore.sh <backup dir> <database url>
set -euo pipefail
dir=$1
db=$2

# Every Supabase database already has the public schema, which pg_dump creates (and comments on)
# at the top of the dump, so leave those statements out.
schema=$(mktemp)
trap 'rm -f "$schema"' EXIT
grep -vE '^(CREATE SCHEMA public;|COMMENT ON SCHEMA public IS )' "$dir/schema.sql" > "$schema"

psql "$db" --single-transaction -v ON_ERROR_STOP=1 -q \
  -f "$schema" \
  -c 'SET session_replication_role = replica' \
  -f "$dir/auth-data.sql" \
  -f "$dir/data.sql"

# pg_dump writes each table's rows between "COPY <table> ..." and "\.", one row per line.
expected=$(awk '/^COPY /{table=$2; rows=0; next} /^\\\.$/{if (table != "") print table, rows; table=""; next} table != ""{rows++}' \
  "$dir/auth-data.sql" "$dir/data.sql")
if [ -z "$expected" ]; then
  echo "::error::The backup contains no table data."
  exit 1
fi

failed=0
while read -r table rows; do
  restored=$(psql "$db" -tAc "select count(*) from $table")
  if [ "$restored" = "$rows" ]; then
    echo "$table: $rows rows"
  else
    echo "::error::$table has $rows rows in the backup but $restored after restoring."
    failed=1
  fi
done <<< "$expected"
exit $failed
