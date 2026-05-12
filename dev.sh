#!/bin/bash
# 启动后端和前端开发服务，Ctrl+C 同时关闭
# 后端日志前缀 [API] 蓝色，前端日志前缀 [Vite] 绿色

BACKEND_DIR="$(cd "$(dirname "$0")/backend" && pwd)"
FRONTEND_DIR="$(cd "$(dirname "$0")/frontend" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

cleanup() {
    echo ""
    echo -e "${RED}[STOP]${NC} 关闭服务..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo -e "${RED}[STOP]${NC} 服务已关闭"
    exit 0
}

trap cleanup SIGINT SIGTERM

# 启动后端
echo -e "${BLUE}[API]${NC} 启动后端服务..."
cd "$BACKEND_DIR"
./venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1 --port 8003 2>&1 | sed "s/^/$(echo -e ${BLUE})[API]$(echo -e ${NC}) /" &
BACKEND_PID=$!

# 启动前端
echo -e "${GREEN}[Vite]${NC} 启动前端服务..."
cd "$FRONTEND_DIR"
npx vite --host 127.0.0.1 --port 5175 2>&1 | sed "s/^/$(echo -e ${GREEN})[Vite]$(echo -e ${NC}) /" &
FRONTEND_PID=$!

echo ""
echo -e "  ${BLUE}后端${NC}:  http://127.0.0.1:8003"
echo -e "  ${BLUE}文档${NC}:  http://127.0.0.1:8003/docs"
echo -e "  ${GREEN}前端${NC}:  http://127.0.0.1:5175"
echo ""
echo "  按 Ctrl+C 停止所有服务"
echo ""

wait
