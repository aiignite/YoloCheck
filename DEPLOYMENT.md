# YoloCheck 部署文档

## 系统要求

- Docker 20.10+ & Docker Compose 2.x
- Python 3.10+（开发环境）
- Node.js 18+（开发环境）
- 至少 4GB 内存（YOLO 推理需求）

## 快速开始

### 1. 克隆项目

```bash
git clone <repo-url> YoloCheck
cd YoloCheck
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，修改密码等敏感信息
```

### 3. 启动基础服务

```bash
docker-compose up -d
```

等待所有服务健康检查通过：

```bash
docker-compose ps
```

### 4. 启动后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # macOS/Linux
pip install -e ".[dev]"

# 数据库迁移
alembic upgrade head

# 启动服务
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 5. 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173

---

## 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DATABASE_URL` | PostgreSQL 异步连接串 | `postgresql+asyncpg://yolocheck:yolocheck123@localhost:5432/yolocheck` |
| `DATABASE_URL_SYNC` | PostgreSQL 同步连接串（Alembic 用） | `postgresql://yolocheck:...` |
| `REDIS_URL` | Redis 连接地址 | `redis://localhost:6379/0` |
| `MQTT_BROKER` | EMQX MQTT Broker 地址 | `localhost` |
| `MQTT_PORT` | MQTT 端口 | `1883` |
| `YOLO_MODEL_PATH` | YOLO 模型文件路径 | `models/yolov8n.pt` |
| `YOLO_CONFIDENCE_THRESHOLD` | 检测置信度阈值 | `0.5` |
| `YOLO_DEVICE` | 推理设备（cpu/cuda:0） | `cpu` |
| `UPLOAD_DIR` | 上传文件目录 | `uploads` |
| `IMAGE_SAVE_DIR` | 检测图片保存目录 | `uploads/detections` |
| `BACKEND_HOST` | 后端监听地址 | `0.0.0.0` |
| `BACKEND_PORT` | 后端端口 | `8000` |
| `LOG_LEVEL` | 日志级别 | `INFO` |

---

## 生产环境部署

### Docker Compose 生产配置

生产环境建议：

1. **修改默认密码**：`.env` 中的数据库密码、MQTT 密码等
2. **持久化存储**：Docker volumes 已配置 PostgreSQL 数据持久化
3. **日志**：设置 `LOG_LEVEL=WARNING` 减少日志量
4. **GPU 加速**：设置 `YOLO_DEVICE=cuda:0`（需要 NVIDIA Docker）

### 后端 Dockerfile

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY backend/ .
RUN pip install --no-cache-dir -e . -i https://mirrors.aliyun.com/pypi/simple/
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 前端构建

```bash
cd frontend
npm run build
# 产出在 frontend/dist/，可用 Nginx 部署
```

---

## 服务架构

```
客户端浏览器
    │
    ├── 前端 (React/Vite) :5173
    │       │
    │       └── API 请求 → 后端 (FastAPI) :8000
    │                          │
    │                          ├── PostgreSQL :5432（数据存储）
    │                          ├── Redis :6379（缓存/会话）
    │                          ├── EMQX :1883（MQTT 消息）
    │                          └── YOLO 推理引擎
    │
    └── WebSocket :8000/ws/live（实时推送）
```

---

## 常见问题

### Q: 数据库连接失败
确保 PostgreSQL 容器正在运行：`docker-compose ps postgres`。检查 `.env` 中的连接串。

### Q: YOLO 模型加载失败
首次运行会自动下载 YOLOv8n 模型。确保网络畅通，或手动下载模型到 `models/` 目录。

### Q: 前端无法连接后端
检查 CORS 配置和 `VITE_API_BASE_URL` 环境变量。默认后端地址为 `http://localhost:8000/api`。

### Q: pip 安装慢
已配置阿里云镜像源。如果未生效，手动指定：`pip install -i https://mirrors.aliyun.com/pypi/simple/`

---

## 运行测试

### 后端测试

```bash
cd backend
python -m pytest tests/ -v
```

### 前端测试

```bash
cd frontend
npm test
```
