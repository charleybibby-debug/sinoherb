#!/bin/sh
set -eu
backup_dir=/backups
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
file="$backup_dir/sinoherb-$timestamp.dump"
mkdir -p "$backup_dir"
pg_dump --format=custom --file="$file" --no-owner --no-privileges --dbname="$DATABASE_URL"
find "$backup_dir" -type f -name 'sinoherb-*.dump' -mtime +"$BACKUP_RETENTION_DAYS" -delete
while :; do
  sleep 86400
  timestamp=$(date -u +%Y%m%dT%H%M%SZ)
  pg_dump --format=custom --file="$backup_dir/sinoherb-$timestamp.dump" --no-owner --no-privileges --dbname="$DATABASE_URL"
  find "$backup_dir" -type f -name 'sinoherb-*.dump' -mtime +"$BACKUP_RETENTION_DAYS" -delete
done
