#!/bin/bash
set -euo pipefail

# Move leftover local lingxing tables to RDS, except weekly product performance
# (lingxing_product_performance) which will be re-pulled in GBP later.

LOCAL_DB="${MYSQL_DATABASE:?}"
RDS_DB="${RDS_DATABASE:?}"

TABLES="
lingxing_automation_request_registry
lingxing_request_task
lingxing_purchase_plan
lingxing_purchase_order
lingxing_purchase_order_item
lingxing_inventory_batch_detail
lingxing_shipment_plan
"

echo "[1] dump+replace: $TABLES"
date -Iseconds
# shellcheck disable=SC2086
mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" \
  --no-tablespaces --single-transaction --quick --hex-blob \
  --set-gtid-purged=OFF --skip-comments \
  --default-character-set=utf8mb4 \
  "$LOCAL_DB" $TABLES \
  | mysql -h"$RDS_HOST" -P"$RDS_PORT" -u"$RDS_USERNAME" -p"$RDS_PASSWORD" \
      --max-allowed-packet=1G --default-character-set=utf8mb4 \
      "$RDS_DB"
date -Iseconds
echo "[2] import finished"
