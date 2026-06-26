#!/usr/bin/env bash
# 一键初始化 PROD 数据库.
#
# 前置:
#   1. prod MySQL 容器已启动
#   2. 容器名 prod-mysql, root 密码看 config/secrets/prod.env
#
# 用法:
#   PROD_MYSQL_PASSWORD=xxx bash init_prod.sh
#
# 后果:
#   ⚠️  生产环境慎用. 默认会拒绝在已有数据时执行, 必须显式 --force 才能 DROP.

set -euo pipefail

CONTAINER="${PROD_MYSQL_CONTAINER:-prod-mysql}"
USER="${PROD_MYSQL_USER:-root}"
PASSWORD="${PROD_MYSQL_PASSWORD:?生产密码必须显式传 PROD_MYSQL_PASSWORD=xxx}"
DATABASE="${PROD_MYSQL_DATABASE:-sijuelishi}"
FORCE="${FORCE:-no}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROD_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/prod"

echo "============================================"
echo "  思觉智贸 - PROD 数据库初始化"
echo "============================================"
echo "  容器:    $CONTAINER"
echo "  数据库:  $DATABASE"
echo "  Schema:  $PROD_DIR/01_schema.sql"
echo "  Baseline:$PROD_DIR/02_baseline_data.sql"
echo "============================================"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "❌ 容器 $CONTAINER 未运行"
  exit 1
fi

# 检查数据库是否存在并且有表
TABLE_COUNT=$(docker exec "$CONTAINER" mysql -u"$USER" -p"$PASSWORD" -N -B -e "
  SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DATABASE';
" 2>/dev/null || echo "0")

if [ "$TABLE_COUNT" -gt 0 ]; then
  echo ""
  echo "⚠️  数据库 $DATABASE 已有 $TABLE_COUNT 张表!"
  if [ "$FORCE" != "yes" ]; then
    echo ""
    echo "❌ 拒绝执行. 生产环境数据保护."
    echo "   如果你确实要 DROP 重建, 加 FORCE=yes:"
    echo "     FORCE=yes PROD_MYSQL_PASSWORD=xxx bash init_prod.sh"
    exit 1
  fi
  echo ""
  read -rp "🚨 你确定要 DROP $DATABASE 并重建吗? 输入 DROP 确认: " confirm
  if [ "$confirm" != "DROP" ]; then
    echo "已取消"
    exit 0
  fi
  docker exec "$CONTAINER" mysql -u"$USER" -p"$PASSWORD" -e "DROP DATABASE $DATABASE;" 2>/dev/null
  echo "✅ 已删除旧数据库"
fi

# 建库
docker exec "$CONTAINER" mysql -u"$USER" -p"$PASSWORD" -e "
  CREATE DATABASE IF NOT EXISTS $DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
" 2>/dev/null
echo "✅ 已创建数据库 $DATABASE"

# 导入 schema
echo "📦 导入 schema..."
docker cp "$PROD_DIR/01_schema.sql" "$CONTAINER:/tmp/01_schema.sql"
docker exec "$CONTAINER" sh -c "mysql -u$USER -p$PASSWORD $DATABASE < /tmp/01_schema.sql" 2>&1 | grep -v "Warning" || true

TABLE_COUNT=$(docker exec "$CONTAINER" mysql -u"$USER" -p"$PASSWORD" -N -B -e "
  SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$DATABASE';
" 2>/dev/null)
echo "✅ Schema 导入完成: $TABLE_COUNT 张表"

# 导入 baseline
echo "📦 导入基线数据..."
docker cp "$PROD_DIR/02_baseline_data.sql" "$CONTAINER:/tmp/02_baseline.sql"
docker exec "$CONTAINER" sh -c "mysql -u$USER -p$PASSWORD $DATABASE < /tmp/02_baseline.sql" 2>&1 | grep -v "Warning" || true

echo "✅ 基线数据导入完成"

echo ""
echo "============================================"
echo "  ✅ PROD 数据库初始化完成"
echo "============================================"
echo ""
echo "  下一步:"
echo "    - 业务数据: docker cp 1.1GB 备份后导入 (见 README)"
echo "    - 重启 Java: docker compose -f docker-compose.prod.yml restart java-user java-product"
