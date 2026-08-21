#!/bin/bash
# Import slim schema+sample into host MySQL. Does not connect to RDS.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL_FILE="$ROOT/sql/init_ai_selection_slim.sql"
PUBLIC_ENV="$ROOT/config/public/prod.env"
SECRET_ENV="$ROOT/config/secrets/prod.env"

read_env() {
  local key="$1"
  local file="$2"
  grep -E "^${key}=" "$file" | tail -n 1 | cut -d= -f2-
}

if [ ! -f "$SQL_FILE" ]; then
  echo "missing $SQL_FILE" >&2
  exit 1
fi

HOST="$(read_env MYSQL_HOST "$PUBLIC_ENV")"
PORT="$(read_env MYSQL_PORT "$PUBLIC_ENV")"
USER="$(read_env MYSQL_USER "$PUBLIC_ENV")"
DB="$(read_env MYSQL_DATABASE "$PUBLIC_ENV")"
PASSWORD="$(read_env MYSQL_PASSWORD "$SECRET_ENV")"

if [ "$HOST" = "host.docker.internal" ]; then
  HOST="127.0.0.1"
fi

echo "Import $SQL_FILE"
echo "Target $USER@$HOST:$PORT /$DB"
echo "RDS is not in this command."

mysql --protocol=TCP -h"$HOST" -P"$PORT" -u"$USER" -p"$PASSWORD" --default-character-set=utf8mb4 -e "CREATE DATABASE IF NOT EXISTS \`$DB\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql --protocol=TCP -h"$HOST" -P"$PORT" -u"$USER" -p"$PASSWORD" --default-character-set=utf8mb4 "$DB" < "$SQL_FILE"
mysql --protocol=TCP -h"$HOST" -P"$PORT" -u"$USER" -p"$PASSWORD" --default-character-set=utf8mb4 "$DB" -e "SELECT COUNT(*) AS table_count FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DB' AND TABLE_TYPE='BASE TABLE';"

echo "Import ok."
