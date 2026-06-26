#!/usr/bin/env bash
# 从指定 MySQL 容器 dump 基线小表数据 (含 schema, 用于一键建库).
#
# 用法:
#   dump_baseline.sh <container> <user> <password> <database> <output.sql>

set -euo pipefail

CONTAINER="${1:?需要传容器名}"
USER="${2:?需要传用户名}"
PASSWORD="${3:?需要传密码}"
DATABASE="${4:?需要传数据库名}"
OUTPUT="${5:?需要传输出路径}"

# 基线/字典表清单 (按业务依赖度筛选, 总量 <3MB)
# 评分相关 + 类目基线 + 错位 + 别名 + 系统配置
BASELINE_TABLES=(
  category_bsr_baseline
  subcategory_baseline
  category_age_tier_baseline
  subcategory_alias_map
  category_dislocation
  category_heat_matrix
  grade_thresholds
  scoring_config
  system_config
  api_config
)

mkdir -p "$(dirname "$OUTPUT")"

# baseline 文件只含数据 (INSERT), 不含 schema (schema 由 01_schema.sql 提供).
# --no-create-info 跳过 CREATE TABLE 语句.
docker exec "$CONTAINER" mysqldump \
  -u"$USER" -p"$PASSWORD" \
  --no-tablespaces \
  --no-create-info \
  --single-transaction \
  --skip-comments \
  --set-gtid-purged=OFF \
  --complete-insert \
  "$DATABASE" \
  "${BASELINE_TABLES[@]}" \
  2>/dev/null > "$OUTPUT"

sed -i '/^-- MySQL dump/d; /^-- Server version/d; /^-- Host:/d' "$OUTPUT" 2>/dev/null || true

LINES=$(wc -l < "$OUTPUT")
SIZE=$(du -h "$OUTPUT" | cut -f1)
INSERTS=$(grep -c "^INSERT INTO" "$OUTPUT" || echo 0)

echo "✅ Baseline data dumped (INSERT only, no schema)"
echo "   File:    $OUTPUT"
echo "   Size:    $SIZE"
echo "   Lines:   $LINES"
echo "   INSERTs: $INSERTS"
