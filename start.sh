#!/bin/bash
set -e

BACKEND_PORT=3275
FRONTEND_PORT=3270
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

kill_port() {
    local port=$1
    local pids
    pids=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$pids" ]; then
        log_warn "端口 $port 被占用，正在停止进程: $pids"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
        log_info "端口 $port 已释放"
    else
        log_info "端口 $port 空闲"
    fi
}

wait_for_port() {
    local port=$1
    local name=$2
    local max_wait=30
    local count=0
    while ! lsof -ti:$port >/dev/null 2>&1; do
        sleep 1
        count=$((count + 1))
        if [ $count -ge $max_wait ]; then
            log_error "$name 启动超时（${max_wait}s）"
            return 1
        fi
    done
    log_info "$name 已启动 (port $port)"
}

cleanup() {
    log_warn "正在停止所有服务..."
    kill_port $BACKEND_PORT
    kill_port $FRONTEND_PORT
    exit 0
}
trap cleanup SIGINT SIGTERM

echo ""
echo "========================================="
echo "  YoloCheck 服务启动"
echo "========================================="
echo ""

kill_port $BACKEND_PORT
kill_port $FRONTEND_PORT

log_info "启动后端 (port $BACKEND_PORT)..."
cd "$BACKEND_DIR"
nohup uvicorn app.main:app --reload --host 0.0.0.0 --port $BACKEND_PORT > "$PROJECT_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
log_info "后端 PID: $BACKEND_PID"

log_info "启动前端 (port $FRONTEND_PORT)..."
cd "$FRONTEND_DIR"
nohup npm run dev > "$PROJECT_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
log_info "前端 PID: $FRONTEND_PID"

echo ""
log_info "等待服务就绪..."
wait_for_port $BACKEND_PORT "后端"
wait_for_port $FRONTEND_PORT "前端"

echo ""
echo "========================================="
echo -e "  ${GREEN}服务已全部启动${NC}"
echo "========================================="
echo "  后端: http://localhost:$BACKEND_PORT"
echo "  前端: http://localhost:$FRONTEND_PORT"
echo "  API文档: http://localhost:$BACKEND_PORT/docs"
echo ""
echo "  日志:"
echo "    tail -f $PROJECT_DIR/backend.log"
echo "    tail -f $PROJECT_DIR/frontend.log"
echo ""
echo "  按 Ctrl+C 停止所有服务"
echo "========================================="
echo ""

wait
