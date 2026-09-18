# 全市场 A 股数据

## 一键接口

```http
GET /api/v1/market/all
```

该接口由 Backend 使用服务端 API Key 调用 `financial-api`，一次返回：

- A 股标的目录（代码、名称、交易所和资产类型）
- 全市场最新行情快照，自动分页获取
- 全市场十年日 K Parquet 下载链接
- 全市场近十日日 K Parquet 下载链接
- 全市场完整分红、送股和配股事件 Parquet 下载链接

示例：

```bash
curl http://localhost:8000/api/v1/market/all
```

## 为什么使用下载链接

全市场历史数据规模较大，不应把约千万行日 K 直接返回到 API 或浏览器上下文。上游返回约 5 分钟有效的预签名 Parquet 下载链接，前端可以直接下载，研究程序可以用 pandas、PyArrow 或 DuckDB 读取。

## 数据集

| 名称 | 内容 |
| --- | --- |
| `daily_k_10y` | 全市场约十年未复权日 K |
| `daily_k_10d` | 全市场最近十个交易日日 K，适合增量同步 |
| `adjustment_factors` | 全市场完整现金分红、送股和配股事件 |

## 注意事项

- 下载链接短期有效，过期后重新调用 `/api/v1/market/all`。
- `daily_k_10d` 适合日常增量同步；本地数据缺口较大时重新下载 `daily_k_10y`。
- 入库时按 `(thscode, date_ms)` 对日 K 做去重或 UPSERT。
- 真实 API Key 只配置在 Backend，不要写入前端或 Git。
