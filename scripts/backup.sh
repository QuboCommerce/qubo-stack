#!/bin/sh
# Nightly instance backup: Postgres dump + media volume, kept for QUBO_BACKUP_DAYS (default 14).
# Cron (as the deploy user): 30 3 * * * $HOME/qubo-stack/scripts/backup.sh >> $HOME/backups/backup.log 2>&1
# Restore: docker exec -i qubo-postgres pg_restore -U qubo -d qubo --clean --if-exists --no-owner < qubo-<stamp>.dump
set -eu
DIR="${QUBO_BACKUP_DIR:-$HOME/backups}"
DAYS="${QUBO_BACKUP_DAYS:-14}"
STAMP=$(date +%Y%m%d-%H%M)
mkdir -p "$DIR"
cd "$(dirname "$0")/.."
DB_USER=$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2 || true)
DB_NAME=$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2 || true)

docker exec qubo-postgres pg_dump -U "${DB_USER:-qubo}" -d "${DB_NAME:-qubo}" -Fc > "$DIR/qubo-$STAMP.dump.part"
mv "$DIR/qubo-$STAMP.dump.part" "$DIR/qubo-$STAMP.dump"
docker run --rm -v qubo_media:/data/media:ro alpine tar -czf - -C /data media > "$DIR/media-$STAMP.tgz"

find "$DIR" -maxdepth 1 \( -name 'qubo-*.dump' -o -name 'media-*.tgz' \) -mtime +"$DAYS" -delete
echo "$(date -Iseconds) ok $(du -h "$DIR/qubo-$STAMP.dump" | cut -f1) db, $(du -h "$DIR/media-$STAMP.tgz" | cut -f1) media"
