#!/usr/bin/env bash
# 从指定 MySQL 容器 dump schema (仅表结构, 不含数据).
#
# 用法:
#   dump_schema.sh <container> <user> <password> <database> <output.sql>
#
# 示例:
#   ./dump_schema.sh prod-mysql root root123456 sijuelishi ../prod/01_schema.sql
#   ./dump_schema.sh dev-mysql-temp root root sijuelishi_dev ../dev/01_schema.sql

set -euo pipefail

CONTAINER="${1:?需要传容器名}"
USER="${2:?需要传用户名}"
PASSWORD="${3:?需要传密码}"
DATABASE="${4:?需要传数据库名}"
OUTPUT="${5:?需要传输出路径}"

mkdir -p "$(dirname "$OUTPUT")"

# 排除废弃表 (前缀 _ / 后缀 _old / _backup / _deprecated_*)
EXCLUDED_TABLES=$(
  docker exec "$CONTAINER" mysql -u"$USER" -p"$PASSWORD" -N -B -e "
    SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA='$DATABASE'
      AND (TABLE_NAME LIKE '\_%' ESCAPE '\\\\' OR TABLE_NAME LIKE '%\\_old' ESCAPE '\\\\' OR TABLE_NAME LIKE '%\\_backup' ESCAPE '\\\\');
  " 2>/dev/null
)

IGNORE_ARGS=()
if [ -n "$EXCLUDED_TABLES" ]; then
  echo "⚠️  忽略废弃表:"
  while IFS= read -r tbl; do
    [ -z "$tbl" ] && continue
    echo "     - $tbl"
    IGNORE_ARGS+=(--ignore-table="${DATABASE}.${tbl}")
  done <<< "$EXCLUDED_TABLES"
fi

docker exec "$CONTAINER" mysqldump \
  -u"$USER" -p"$PASSWORD" \
  --no-tablespaces \
  --no-data \
  --skip-comments \
  --skip-add-drop-table \
  --set-gtid-purged=OFF \
  --routines \
  --triggers \
  "${IGNORE_ARGS[@]}" \
  "$DATABASE" \
  2>/dev/null > "$OUTPUT"

# 删掉 mysqldump 的版本头和 "Dumping" 注释, 让 schema 干净
sed -i '/^-- MySQL dump/d; /^-- Server version/d; /^-- Host:/d' "$OUTPUT" 2>/dev/null || true

LINES=$(wc -l < "$OUTPUT")
TABLES=$(grep -c "^CREATE TABLE" "$OUTPUT" || echo 0)

echo "✅ Schema dumped"
echo "   File:   $OUTPUT"
echo "   Lines:  $LINES"
echo "   Tables: $TABLES"
