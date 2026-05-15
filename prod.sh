#!/bin/bash
# 生产模式启动后端服务
# 使用多 workers、无 hot-reload、production 数据库和 COS
# Ctrl+C 关闭所有服务

BACKEND_DIR="$(cd "$(dirname "$0")/backend" && pwd)"

RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

cleanup() {
    echo ""
    echo -e "${RED}[STOP]${NC} 关闭服务..."
    kill $BACKEND_PID 2>/dev/null
    wait $BACKEND_PID 2>/dev/null
    echo -e "${RED}[STOP]${NC} 服务已关闭"
    exit 0
}

trap cleanup SIGINT SIGTERM

cd "$BACKEND_DIR"

# 加载生产环境变量（覆盖 .env 中的开发配置）
# set -a 会让 source 的变量自动 export 为环境变量
# Python 的 load_dotenv() 不会覆盖已有的环境变量
if [ -f .env.production ]; then
    set -a
    source .env.production
    set +a
    echo -e "${YELLOW}[PROD]${NC} 加载生产配置: .env.production"
fi

# 启动后端（生产模式）
echo -e "${YELLOW}[PROD]${NC} 启动后端服务..."
./venv/Scripts/python -m uvicorn app.main:app \
  --host 127.0.0.1 \
  --port 8005 \
  --workers 4 \
  --log-level info 2>&1 | sed "s/^/$(echo -e ${BLUE})[API]$(echo -e ${NC}) /" &
BACKEND_PID=$!

echo ""
echo -e "  ${YELLOW}模式${NC}:  production"
echo -e "  ${YELLOW}数据库${NC}: ${MYSQL_DATABASE:-sijuelishi}"
echo -e "  ${YELLOW}COS${NC}:    ${COS_BUCKET:-sijuelishi-1328246743}"
echo -e "  ${BLUE}后端${NC}:  http://127.0.0.1:8005"
echo -e "  ${BLUE}前端${NC}:  http://127.0.0.1:8080 (Nginx)"
echo -e "  ${BLUE}文档${NC}:  http://127.0.0.1:8005/docs"
echo -e "  ${BLUE}看板${NC}:  http://127.0.0.1:8005/dashboards/"
echo ""
echo -e "  按 Ctrl+C 停止"
echo ""

wait
