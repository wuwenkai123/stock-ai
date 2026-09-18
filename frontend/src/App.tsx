import { FormEvent, useEffect, useState } from "react";
import { getHealth, getStockOverview, type StockOverview } from "./api";

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
  const [health, setHealth] = useState("正在连接 API…");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
