# stock-ai 前后端架构

## 1. 总体架构

```text
Browser / Mobile
       │ HTTPS
       ▼
Frontend: React + TypeScript + Vite
       │ /api/v1
       ▼
Backend: FastAPI
  ├── Symbol resolution
  ├── Market data orchestration
  ├── Portfolio / Strategy / AI analysis
  └── Task orchestration
       │ X-api-key (server-side only)
       ▼
financial-api / 同花顺金融数据服务
  ├── Latest A-share snapshot
  ├── Historical daily K-line
  └── Corporate actions: dividend / bonus shares
       │
       ├── PostgreSQL: users, watchlists, portfolios, analyses
       └── Redis: cache, rate limit, task state
```

## 2. 一键获取数据流程

1. 用户在前端输入股票名称、ticker 或完整 `thscode`。
2. Backend 通过 `/api/meta/tickers/search` 将输入消歧为唯一 A 股标的。
3. Backend 并发请求：
   - `/api/a-share/prices/snapshot`：最新价格、涨跌幅、成交量和成交额；
   - `/api/a-share/prices/historical`：按用户选择的天数获取日 K 线，支持 `none`、`forward`、`backward` 复权；
   - `/api/a-share/corporate-actions/adjustment-factors`：获取完整历史现金分红和送股事件，不受 K 线天数筛选影响。
4. Backend 统一返回 `instrument`、`snapshot`、`bars`、`corporate_actions` 和 `source`。
5. Frontend 展示行情指标、K 线记录和分红/送股事件。

API Key 只保存在 Backend 环境变量中，不进入浏览器、前端构建产物或 Git 仓库。

## 3. 分层边界

### Frontend

- 只通过 `/api/v1` 调用 Backend。
- 页面、业务组件、API client 和类型定义分层。
- 不在浏览器中直接访问第三方数据源，也不保存金融服务 API Key。

### Backend

- `api`: HTTP 路由、鉴权和请求响应模型。
- `providers`: 第三方数据源 adapter；当前为 `financial_api.py`。
- `service`: 用例编排和业务规则。
- `repository`: 数据库及本地研究数据访问。
- `domain`: 股票、行情、策略和组合领域模型。
- `worker`: 行情同步、指标计算、回测和 AI 分析任务。

## 4. 当前接口

```text
GET /api/v1/health
GET /api/v1/stocks/overview?query=600519&days=365&adjust=forward
GET /api/v1/stocks/{symbol}/summary
```

`overview` 是一键聚合接口：K 线使用请求的 `days` 时间范围，分红/送股事件默认读取完整历史。

## 5. 数据口径

- `thscode` 必须由上游标的检索确认，不在客户端猜测交易所后缀。
- 个股历史 K 线当前使用 `1d`，单次窗口不超过 10 年。
- `dividend_per_share > 0` 表示现金分红；`per_share_bonus > 0` 表示送股比例。
- `financial-api` 返回 `3002` 时表示没有公司行为事件，Backend 将其转换为空列表，而不是返回 502。
- 接口返回数据源、复权方式和时间范围，便于审计和复现。
- 金融数据只用于研究和展示，不构成投资建议。

## 6. 配置

复制 `.env.example`，在 Backend 环境中配置：

```bash
STOCK_AI_FINANCIAL_API_KEY=<your-api-key>
STOCK_AI_FINANCIAL_API_BASE_URL=https://fuyao.aicubes.cn
```

Docker Compose 会将主机上的 `HITHINK_FINANCE_API_KEY` 映射到 Backend；真实 Key 不得提交到仓库。

## 7. 演进路线

1. 增加 Redis 缓存，降低同一标的重复请求。
2. 增加 PostgreSQL 持久化和用户观察列表。
3. 增加行情 provider fallback 与重试/熔断策略。
4. 增加 SSE/WebSocket 实时刷新和异步全市场任务。
5. 增加指标计算、回测、AI 分析和证据引用。
