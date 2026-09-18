# stock-ai

前后端分离的股票智能分析平台架构骨架。

## 技术栈

- **Frontend**: React + TypeScript + Vite
- **Backend**: FastAPI + Pydantic
- **API**: `/api/v1`
- **Deployment**: Docker Compose + Nginx

## 目录结构

```text
.
├── frontend/        # React Web 应用
├── backend/         # FastAPI API 服务
├── docs/             # 架构与接口设计
├── docker-compose.yml
└── .gitignore
```

## 本地运行

```bash
docker compose up --build
```

- 前端：http://localhost:8080
- 后端健康检查：http://localhost:8000/api/v1/health
- API 文档：http://localhost:8000/docs

分别运行：

```bash
cd backend && pip install -e . && uvicorn app.main:app --reload --port 8000
cd frontend && npm install && npm run dev
```
