#!/bin/bash
set -euo pipefail

LOCAL_DB="${MYSQL_DATABASE:?}"
RDS_DB="${RDS_DATABASE:?}"

mkdir -p /tmp/migrate-non-lx

mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$LOCAL_DB" -N -e "
SELECT table_name FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
  AND table_name NOT LIKE 'lingxing\\_%' ESCAPE '\\\\'
  AND table_name <> 'operations_logistics_purchase_progress'
ORDER BY table_name;" > /tmp/migrate-non-lx/local_tables.txt

mysql -h"$RDS_HOST" -P"$RDS_PORT" -u"$RDS_USERNAME" -p"$RDS_PASSWORD" "$RDS_DB" -N -e "SHOW TABLES;" \
  > /tmp/migrate-non-lx/remote_tables.txt

MISSING_LIST=""
while read -r tbl; do
  [ -z "$tbl" ] && continue
  if ! grep -qx "$tbl" /tmp/migrate-non-lx/remote_tables.txt; then
    MISSING_LIST="$MISSING_LIST $tbl"
  fi
done < /tmp/migrate-non-lx/local_tables.txt

echo "[1] local non-lingxing tables: $(wc -l < /tmp/migrate-non-lx/local_tables.txt)"
if [ -n "$MISSING_LIST" ]; then
  echo "[1] creating missing RDS tables:$MISSING_LIST"
  # shellcheck disable=SC2086
  mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" --no-tablespaces --no-data --skip-comments \
    --set-gtid-purged=OFF "$LOCAL_DB" $MISSING_LIST \
    | mysql -h"$RDS_HOST" -P"$RDS_PORT" -u"$RDS_USERNAME" -p"$RDS_PASSWORD" --max-allowed-packet=512M "$RDS_DB"
else
  echo "[1] RDS already has all non-lingxing table schemas"
fi

IGNORE_ARGS=()
mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$LOCAL_DB" -N -e "
SELECT table_name FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
  AND (table_name LIKE 'lingxing\\_%' ESCAPE '\\\\'
       OR table_name = 'operations_logistics_purchase_progress');" \
| while read -r tbl; do
  [ -z "$tbl" ] && continue
  echo "--ignore-table=${LOCAL_DB}.${tbl}"
done > /tmp/migrate-non-lx/ignore.args

mapfile -t IGNORE_ARGS < /tmp/migrate-non-lx/ignore.args
echo "[2] ignore tables: ${#IGNORE_ARGS[@]}"
date -Iseconds
mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" \
  --no-tablespaces --single-transaction --quick --hex-blob \
  --set-gtid-purged=OFF --skip-comments \
  --default-character-set=utf8mb4 \
  "${IGNORE_ARGS[@]}" \
  "$LOCAL_DB" \
  | mysql -h"$RDS_HOST" -P"$RDS_PORT" -u"$RDS_USERNAME" -p"$RDS_PASSWORD" \
      --max-allowed-packet=1G --default-character-set=utf8mb4 \
      "$RDS_DB"
date -Iseconds
echo "[3] import finished"
