# stock-ai

一个前后端分离的 A 股智能分析平台基础架构。

当前版本已接入 [`financial-api`](https://github.com/wuwenkai123/financial-api)，通过服务端安全调用同花顺金融数据服务，一次请求获取股票标的、实时股价、历史日 K、分红和送股信息。

> 数据用于研究和展示，不构成投资建议。

## 功能概览

- 输入股票名称、6 位代码或完整 `thscode`，自动完成标的识别
- 获取最新价、涨跌幅、开高低、成交量和成交额
- 获取前复权、后复权或不复权历史日 K
- 获取现金分红、送股和除权除息事件
- 前端 Dashboard 展示行情指标、K 线记录和公司行为
- API Key 只保存在后端，不暴露给浏览器

## 技术栈

- **Frontend**：React + TypeScript + Vite
- **Backend**：FastAPI + Pydantic + HTTPX
- **数据源**：financial-api / 同花顺金融数据服务
- **API**：REST `/api/v1`
- **部署**：Docker Compose + Nginx

## 目录结构

```text
.
├── frontend/
│   ├── src/App.tsx                  # A 股数据查询工作台
│   ├── src/api.ts                   # Backend API client
│   └── src/styles.css
├── backend/
│   ├── app/main.py                  # FastAPI 路由与配置
│   ├── app/providers/financial_api.py # financial-api provider adapter
│   └── pyproject.toml
├── docs/architecture.md             # 架构、数据流和接口约定
├── .env.example                     # 环境变量模板
├── docker-compose.yml
└── .gitignore
```

## 配置 API Key

先从 [同花顺金融数据服务](https://fuyao.aicubes.cn/admin/) 获取 API Key。

### Docker Compose

在项目根目录创建 `.env`，或在终端导出环境变量：

```bash
HITHINK_FINANCE_API_KEY=<your-api-key>
```

启动时，Compose 会将该变量映射为后端使用的 `STOCK_AI_FINANCIAL_API_KEY`。真实 API Key 不要提交到 Git 仓库。

### 后端直接运行

```bash
export STOCK_AI_FINANCIAL_API_KEY=<your-api-key>
export STOCK_AI_FINANCIAL_API_BASE_URL=https://fuyao.aicubes.cn
```

也可以参考 `.env.example`。

## 启动项目

### Docker Compose

```bash
docker compose up --build
```

访问：

- 前端：http://localhost:8080
- 后端：http://localhost:8000
- Swagger API 文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/api/v1/health

### 分别运行

启动后端：

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --port 8000
```

启动前端：

```bash
cd frontend
npm install
npm run dev
```

前端开发服务器默认运行在 http://localhost:5173，并将 `/api` 请求代理到 `http://localhost:8000`。

## 一键获取 A 股数据

### 前端

打开前端页面，输入以下任意一种查询条件：

- `600519`
- `贵州茅台`
- `600519.SH`

选择历史范围后点击 **一键获取**。

### Backend API

```http
GET /api/v1/stocks/overview?query=600519&days=365&adjust=forward
```

参数：

| 参数 | 说明 |
| --- | --- |
| `query` | 股票名称、ticker 或完整 `thscode` |
| `days` | 历史数据范围，1–3650 天，默认 365 |
| `adjust` | `none`、`forward` 或 `backward`，默认 `forward` |

该接口会在后端完成以下流程：

1. 调用 `/api/meta/tickers/search` 将输入消歧为唯一 A 股标的；
2. 调用 `/api/a-share/prices/snapshot` 获取实时行情；
3. 调用 `/api/a-share/prices/historical` 获取历史日 K；
4. 调用 `/api/a-share/corporate-actions/adjustment-factors` 获取分红和送股事件；
5. 将数据统一返回给前端。

返回结构：

```json
{
  "instrument": {},
  "snapshot": {},
  "bars": [],
  "corporate_actions": [],
  "source": {
    "provider": "financial-api",
    "thscode": "600519.SH",
    "adjust": "forward",
    "from": "2025-09-18",
    "to": "2026-09-18"
  }
}
```

## 其他 Backend API

```http
GET /api/v1/health
GET /api/v1/stocks/{symbol}/summary
```

## 数据口径

- `thscode` 必须由上游标的检索确认，不在客户端猜测交易所后缀。
- 个股历史 K 线当前使用日线 `1d`，单次窗口不超过 10 年。
- `dividend_per_share > 0` 表示现金分红。
- `per_share_bonus > 0` 表示送股比例，例如 `0.1` 表示每股送 0.1 股。
- 返回数据包含数据源、复权方式和时间范围，便于审计和复现。
- 当前金融数据 provider 的 API Key 仅由后端读取。

## 架构文档

详见 [`docs/architecture.md`](docs/architecture.md)，其中包含：

- 前后端总体架构
- financial-api 数据流
- Provider Adapter 分层
- API 设计约定
- 数据口径与安全要求
- PostgreSQL、Redis 和异步任务的演进路线

## 安全说明

- 不要将 API Key 写入源码、前端环境变量、日志或 Git commit。
- 不要把真实 Key 放入 `frontend/` 或构建产物。
- 生产环境应使用 Secret Manager 或容器编排平台的 Secret。
- 金融数据仅用于研究和展示，不构成投资建议。
