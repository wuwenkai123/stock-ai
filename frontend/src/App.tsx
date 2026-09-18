import { FormEvent, useEffect, useMemo, useState } from "react";
import { getAllMarketData, getHealth, getStockOverview, type AllMarketData, type StockOverview } from "./api";

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
}

function number(value: number | undefined | null, digits = 2) {
  return value == null ? "—" : value.toLocaleString("zh-CN", { maximumFractionDigits: digits });
}

export default function App() {
  const [query, setQuery] = useState("600519");
  const [historyRange, setHistoryRange] = useState<string>("365");
  const [overview, setOverview] = useState<StockOverview | null>(null);
  const [allMarket, setAllMarket] = useState<AllMarketData | null>(null);
  const [marketSearch, setMarketSearch] = useState("");
  const [marketPage, setMarketPage] = useState(1);
  const [health, setHealth] = useState("正在连接 API…");
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  useEffect(() => {
    getHealth()
      .then((result) => setHealth(`API 在线 · ${result.service}`))
      .catch(() => setHealth("API 离线"));
  }, []);

  async function loadOverview(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const range = historyRange === "all" ? "all" : Number(historyRange);
      setOverview(await getStockOverview(query.trim(), range));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "获取数据失败");
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadAllMarket(refresh = false) {
    setBulkLoading(true);
    setBulkError(null);
    try {
      setAllMarket(await getAllMarketData(refresh));
      setMarketPage(1);
    } catch (reason) {
      setBulkError(reason instanceof Error ? reason.message : "获取全市场数据失败");
      setAllMarket(null);
    } finally {
      setBulkLoading(false);
    }
  }

  const marketRows = useMemo(() => {
    if (!allMarket) return [];
    const names = new Map(allMarket.catalog.items.map((item) => [String(item.thscode ?? ""), String(item.name ?? "")]));
    const keyword = marketSearch.trim().toLowerCase();
    return allMarket.snapshot.items
      .map((item) => ({ ...item, name: names.get(item.thscode) ?? "" }))
      .filter((item) => !keyword || item.thscode.toLowerCase().includes(keyword) || item.ticker.toLowerCase().includes(keyword) || item.name.toLowerCase().includes(keyword));
  }, [allMarket, marketSearch]);

  const marketPageSize = 50;
  const marketPageCount = Math.max(1, Math.ceil(marketRows.length / marketPageSize));
  const visibleMarketRows = marketRows.slice((marketPage - 1) * marketPageSize, marketPage * marketPageSize);
  const snapshot = overview?.snapshot;
  const bars = overview?.bars.slice(-12).reverse() ?? [];
  const actions = overview?.corporate_actions.slice(0, 8) ?? [];
  const historyLabel = overview?.source.history_range === "since_listing" ? "上市以来" : `${overview?.bars.length ?? 0} 条`;

  return (
    <main className="shell">
      <nav className="nav">
        <span className="brand">stock<span>-ai</span></span>
        <span className="badge">A 股数据工作台</span>
      </nav>

      <section className="hero">
        <p className="eyebrow">FINANCIAL-API CONNECTED</p>
        <h1>一键获取 A 股行情、K 线与分红信息。</h1>
        <p className="lead">通过服务端安全接入同花顺金融数据服务。输入股票名称、代码或 thscode，统一返回实时价格、历史日 K 和公司行为。</p>
        <form className="query-form" onSubmit={loadOverview}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：600519、贵州茅台、600519.SH" />
          <select value={historyRange} onChange={(event) => setHistoryRange(event.target.value)} aria-label="历史范围">
            <option value="30">近 30 天</option>
            <option value="180">近 180 天</option>
            <option value="365">近 1 年</option>
            <option value="1095">近 3 年</option>
            <option value="all">上市以来全部日 K</option>
          </select>
          <button disabled={loading || !query.trim()}>{loading ? "获取中…" : "一键获取"}</button>
        </form>
        <div className="status"><span className={`dot ${health.includes("在线") ? "ok" : ""}`} />{health}</div>
        {error && <div className="error">{error}</div>}
      </section>

      <section className="panel">
        <div className="panel-title"><h3>全市场 A 股数据</h3><div className="bulk-actions"><button onClick={() => loadAllMarket(false)} disabled={bulkLoading}>{bulkLoading ? "获取中…" : "一键获取所有股票信息"}</button>{allMarket && <button onClick={() => loadAllMarket(true)} disabled={bulkLoading}>刷新数据</button>}</div></div>
        <p className="disclaimer">获取全市场股票目录、最新行情，以及可直接下载的十年日 K、近十日日 K 和完整分红/送股数据集。目录和最新行情会缓存在后端本地，下载链接仍会每次刷新。</p>
        {bulkError && <div className="error">{bulkError}</div>}
        {allMarket && <div className="status"><span className="dot ok" />已获取 {allMarket.catalog.total.toLocaleString()} 个股票标的，{allMarket.snapshot.items.length.toLocaleString()} 条最新行情；缓存命中：目录 {allMarket.cache.catalog_hit ? "是" : "否"}，行情 {allMarket.cache.snapshot_hit ? "是" : "否"}。</div>}
        {allMarket && <><div className="market-controls"><input className="market-filter" value={marketSearch} onChange={(event) => { setMarketSearch(event.target.value); setMarketPage(1); }} placeholder="搜索代码或股票名称" /><span>显示 {marketRows.length.toLocaleString()} / {allMarket.snapshot.items.length.toLocaleString()}</span></div><div className="table-wrap market-table"><table><thead><tr><th>代码</th><th>名称</th><th>最新价</th><th>涨跌幅</th><th>开盘</th><th>最高</th><th>最低</th><th>成交量</th><th>成交额</th></tr></thead><tbody>{visibleMarketRows.map((item) => <tr key={item.thscode}><td>{item.thscode}</td><td>{item.name || "—"}</td><td>{number(item.last_price)}</td><td className={item.price_change_ratio_pct >= 0 ? "positive" : "negative"}>{number(item.price_change_ratio_pct)}%</td><td>{number(item.open_price)}</td><td>{number(item.high_price)}</td><td>{number(item.low_price)}</td><td>{number(item.volume, 0)}</td><td>{number(item.turnover)}</td></tr>)}</tbody></table></div><div className="market-pagination"><button onClick={() => setMarketPage((page) => Math.max(1, page - 1))} disabled={marketPage <= 1}>上一页</button><span>第 {marketPage} / {marketPageCount} 页</span><button onClick={() => setMarketPage((page) => Math.min(marketPageCount, page + 1))} disabled={marketPage >= marketPageCount}>下一页</button></div><ul>{Object.entries(allMarket.datasets).map(([name, dataset]) => <li key={name}>{name}：{dataset.download_url ? <a href={dataset.download_url} target="_blank" rel="noreferrer">下载 Parquet</a> : "暂无下载链接"}</li>)}</ul></>}
      </section>

      {overview && (
        <>
          <section className="instrument-head">
            <div><span className="eyebrow">{overview.instrument.thscode}</span><h2>{overview.instrument.name}</h2></div>
            <span className="source">数据源：{overview.source.provider} · {overview.source.adjust} 复权</span>
          </section>
          <section className="metrics">
            <article><span>最新价</span><strong>{number(snapshot?.last_price)}</strong></article>
            <article><span>涨跌幅</span><strong className={(snapshot?.price_change_ratio_pct ?? 0) >= 0 ? "positive" : "negative"}>{number(snapshot?.price_change_ratio_pct)}%</strong></article>
            <article><span>成交量</span><strong>{number(snapshot?.volume, 0)}</strong></article>
            <article><span>成交额</span><strong>{number(snapshot?.turnover)}</strong></article>
          </section>
          <section className="data-grid">
            <article className="panel"><div className="panel-title"><h3>历史日 K</h3><span>{historyLabel}</span></div><div className="table-wrap"><table><thead><tr><th>日期</th><th>开盘</th><th>最高</th><th>最低</th><th>收盘</th></tr></thead><tbody>{bars.map((bar) => <tr key={bar.date_ms}><td>{formatDate(bar.date_ms)}</td><td>{number(bar.open_price)}</td><td>{number(bar.high_price)}</td><td>{number(bar.low_price)}</td><td>{number(bar.close_price)}</td></tr>)}</tbody></table></div></article>
            <article className="panel"><div className="panel-title"><h3>分红 / 送股事件</h3><span>{overview.corporate_actions.length} 条</span></div><div className="table-wrap"><table><thead><tr><th>除权除息日</th><th>现金分红/股</th><th>送股比例</th></tr></thead><tbody>{actions.length ? actions.map((action) => <tr key={action.ex_date_ms}><td>{formatDate(action.ex_date_ms)}</td><td>{number(action.dividend_per_share)}</td><td>{number(action.per_share_bonus * 100)}%</td></tr>) : <tr><td colSpan={3}>暂无公司行为数据</td></tr>}</tbody></table></div></article>
          </section>
          <p className="disclaimer">数据用于研究和展示，不构成投资建议。K 线范围：{overview.source.from} 至 {overview.source.to}；分红事件默认读取完整历史。</p>
        </>
      )}

      <footer>stock-ai · frontend / backend separated architecture</footer>
    </main>
  );
}
