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
  ├── Auth / User
  ├── Market Data
  ├── Portfolio
  ├── Strategy / Backtest
  ├── AI Analysis
  └── Task Orchestration
       │
       ├── PostgreSQL: users, watchlists, portfolios, analyses
       ├── Redis: cache, rate limit, task state
       └── Provider Adapters: market data and LLM providers
```

## 2. 分层边界

### Frontend

- 只通过 `/api/v1` 调用后端。
- 页面、业务组件、API client 和类型定义分层。
- 不在浏览器中直接访问行情供应商或模型服务。

### Backend

- `api`: HTTP 路由、鉴权和请求响应模型。
- `service`: 用例编排和业务规则。
- `repository`: 数据库及第三方数据访问。
- `domain`: 股票、行情、策略和组合领域模型。
- `worker`: 行情同步、指标计算、回测和 AI 分析任务。

当前骨架实现了 `health` 和 `stock summary` 接口，后续按上述边界扩展。

## 3. API 约定

- Base path: `/api/v1`
- 外部数据源通过 provider adapter 接入。
- 耗时任务返回 task ID，通过轮询、SSE 或 WebSocket 获取进度。
- AI 输出保留数据来源、时间戳和模型版本，避免不可审计结论。

## 4. 演进路线

1. 接入 PostgreSQL、Redis 和数据库迁移。
2. 增加认证、观察列表和组合管理。
3. 增加行情 provider adapter 与缓存层。
4. 增加指标计算、回测和异步任务队列。
5. 增加 AI 分析、证据引用和模型版本记录。
6. 增加测试、CI、可观测性和生产部署配置。
