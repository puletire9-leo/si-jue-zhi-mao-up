#!/usr/bin/env bash
# 一键初始化 DEV 数据库.
#
# 前置:
#   1. dev MySQL 容器已启动 (docker compose -f docker-compose.dev.yml up -d mysql)
#   2. 容器名 dev-mysql, root 密码 root
#
# 用法:
#   bash init_dev.sh
#
# 后果:
#   - 如果 sijuelishi_dev 已存在, 询问是否 DROP 重建.
#   - 重建后, 跑 01_schema.sql + 02_baseline_data.sql.

set -euo pipefail

CONTAINER="${DEV_MYSQL_CONTAINER:-dev-mysql}"
USER="${DEV_MYSQL_USER:-root}"
PASSWORD="${DEV_MYSQL_PASSWORD:-root}"
DATABASE="${DEV_MYSQL_DATABASE:-sijuelishi_dev}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEV_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/dev"

echo "============================================"
echo "  思觉智贸 - DEV 数据库初始化"
echo "============================================"
echo "  容器:    $CONTAINER"
echo "  数据库:  $DATABASE"
echo "  Schema:  $DEV_DIR/01_schema.sql"
echo "  Baseline:$DEV_DIR/02_baseline_data.sql"
echo "============================================"

# 检查容器
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "❌ 容器 $CONTAINER 未运行"
  echo "   先启动: docker compose -f docker-compose.dev.yml up -d mysql"
  exit 1
fi

# 检查数据库是否存在
DB_EXISTS=$(docker exec "$CONTAINER" mysql -u"$USER" -p"$PASSWORD" -N -B -e "
  SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='$DATABASE';
" 2>/dev/null || echo "0")

if [ "$DB_EXISTS" = "1" ]; then
  echo ""
  read -rp "⚠️  数据库 $DATABASE 已存在, 是否 DROP 并重建? (y/N) " confirm
  if [ "${confirm,,}" != "y" ]; then
    echo "已取消"
    exit 0
  fi
  docker exec "$CONTAINER" mysql -u"$USER" -p"$PASSWORD" -e "DROP DATABASE $DATABASE;" 2>/dev/null
  echo "✅ 已删除旧数据库"
fi

# 建库
docker exec "$CONTAINER" mysql -u"$USER" -p"$PASSWORD" -e "
  CREATE DATABASE $DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
" 2>/dev/null
echo "✅ 已创建数据库 $DATABASE"

# 导入 schema
echo "📦 导入 schema..."
docker cp "$DEV_DIR/01_schema.sql" "$CONTAINER:/tmp/01_schema.sql"
docker exec "$CONTAINER" sh -c "mysql -u$USER -p$PASSWORD $DATABASE < /tmp/01_schema.sql" 2>&1 | grep -v "Warning" || true

TABLE_COUNT=$(docker exec "$CONTAINER" mysql -u"$USER" -p"$PASSWORD" -N -B -e "
  SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DATABASE';
" 2>/dev/null)
echo "✅ Schema 导入完成: $TABLE_COUNT 张表"

# 导入 baseline
echo "📦 导入基线数据..."
docker cp "$DEV_DIR/02_baseline_data.sql" "$CONTAINER:/tmp/02_baseline.sql"
docker exec "$CONTAINER" sh -c "mysql -u$USER -p$PASSWORD $DATABASE < /tmp/02_baseline.sql" 2>&1 | grep -v "Warning" || true

BASELINE_ROWS=$(docker exec "$CONTAINER" mysql -u"$USER" -p"$PASSWORD" -N -B -e "
  USE $DATABASE;
  SELECT
    (SELECT COUNT(*) FROM category_bsr_baseline) +
    (SELECT COUNT(*) FROM subcategory_baseline) +
    (SELECT COUNT(*) FROM subcategory_alias_map) +
    (SELECT COUNT(*) FROM category_dislocation) +
    (SELECT COUNT(*) FROM category_age_tier_baseline) +
    (SELECT COUNT(*) FROM api_config);
" 2>/dev/null)
echo "✅ 基线数据导入完成: $BASELINE_ROWS 行"

echo ""
echo "============================================"
echo "  ✅ DEV 数据库初始化完成"
echo "============================================"
echo ""
echo "  下一步:"
echo "    - 业务数据: 用 mysqldump 从生产/备份导入"
echo "    - 重启 Java/Python: docker compose -f docker-compose.dev.yml restart"
