import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getAllMarketData,
  getHealth,
  getStockOverview,
  type AllMarketData,
  type StockOverview,
  type StockSnapshot,
} from "./api";

type View = "dashboard" | "stock" | "market" | "datasets";
type MarketRow = StockSnapshot & { name: string };

const viewLabels: Record<View, string> = {
  dashboard: "概览",
  stock: "个股研究",
  market: "全市场行情",
  datasets: "数据中心",
};

function getViewFromHash(): View {
  const value = window.location.hash.replace("#", "") as View;
  return value in viewLabels ? value : "dashboard";
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
}

function number(value: number | undefined | null, digits = 2) {
  return value == null ? "—" : value.toLocaleString("zh-CN", { maximumFractionDigits: digits });
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-title"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function MetricCard({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "positive" | "negative" }) {
  return <article className="metric-card"><span>{label}</span><strong className={tone}>{value}</strong>{hint && <small>{hint}</small>}</article>;
}

function SearchForm({ query, setQuery, historyRange, setHistoryRange, onSubmit, loading }: { query: string; setQuery: (value: string) => void; historyRange: string; setHistoryRange: (value: string) => void; onSubmit: (event: FormEvent) => void; loading: boolean }) {
  return <form className="search-form" onSubmit={onSubmit}><label className="search-input"><span>搜索股票</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="代码、名称或 thscode，例如 600519" /></label><label className="range-select"><span>历史范围</span><select value={historyRange} onChange={(event) => setHistoryRange(event.target.value)}><option value="30">近 30 天</option><option value="180">近 180 天</option><option value="365">近 1 年</option><option value="1095">近 3 年</option><option value="all">上市以来</option></select></label><button className="primary-button" disabled={loading || !query.trim()}>{loading ? "获取中…" : "开始研究"}</button></form>;
}

function StockSummaryCard({ overview, onOpen }: { overview: StockOverview; onOpen: () => void }) {
  const snapshot = overview.snapshot;
  return <button className="stock-summary-card" onClick={onOpen}><div className="stock-summary-top"><div><span className="eyebrow">{overview.instrument.thscode}</span><h3>{overview.instrument.name}</h3></div><span className="arrow">↗</span></div><div className="stock-price"><strong>{number(snapshot?.last_price)}</strong><span className={(snapshot?.price_change_ratio_pct ?? 0) >= 0 ? "positive" : "negative"}>{number(snapshot?.price_change_ratio_pct)}%</span></div><div className="stock-summary-footer"><span>{overview.bars.length.toLocaleString()} 条日 K</span><span>{overview.corporate_actions.length.toLocaleString()} 条公司行为</span></div></button>;
}

function Dashboard({ overview, query, setQuery, historyRange, setHistoryRange, onSearch, loading, onNavigate, allMarket }: { overview: StockOverview | null; query: string; setQuery: (value: string) => void; historyRange: string; setHistoryRange: (value: string) => void; onSearch: (event: FormEvent) => void; loading: boolean; onNavigate: (view: View) => void; allMarket: AllMarketData | null }) {
  return <div className="view-content"><PageTitle eyebrow="WORKSPACE OVERVIEW" title="市场研究，从一个清晰的入口开始。" description="把个股研究、全市场行情和数据资产分开管理，减少信息噪音，专注于当前任务。" /><section className="search-card"><div className="search-card-heading"><div><span className="section-kicker">快速研究</span><h2>查一只股票</h2></div><span className="soft-badge">实时数据</span></div><SearchForm {...{ query, setQuery, historyRange, setHistoryRange, onSubmit: onSearch, loading }} /></section><section className="overview-grid"><article className="welcome-card"><span className="section-kicker">数据工作台</span><h2>把复杂数据，变成下一步行动。</h2><p>从行情快照开始，继续查看历史 K 线、分红事件，或切换到全市场视图进行筛选。</p><div className="welcome-actions"><button className="primary-button" onClick={() => onNavigate("market")}>浏览全市场</button><button className="text-button" onClick={() => onNavigate("datasets")}>打开数据中心 →</button></div></article>{overview ? <StockSummaryCard overview={overview} onOpen={() => onNavigate("stock")} /> : <article className="empty-card"><span className="empty-icon">⌁</span><h3>还没有研究对象</h3><p>输入股票代码或名称，开始第一次查询。</p></article>}</section><section className="section-block"><div className="section-heading"><div><span className="section-kicker">模块</span><h2>选择一个工作区</h2></div></div><div className="module-grid"><button className="module-card" onClick={() => onNavigate("stock")}><span className="module-icon blue">↗</span><h3>个股研究</h3><p>实时价格、历史日 K、复权和分红送股事件。</p><span className="module-link">打开研究台 →</span></button><button className="module-card" onClick={() => onNavigate("market")}><span className="module-icon green">▦</span><h3>全市场行情</h3><p>{allMarket ? `${allMarket.snapshot.total.toLocaleString()} 个标的已准备` : "搜索和浏览全部 A 股最新行情。"}</p><span className="module-link">查看市场 →</span></button><button className="module-card" onClick={() => onNavigate("datasets")}><span className="module-icon orange">↓</span><h3>数据中心</h3><p>下载十年日 K、增量日 K 和公司行为数据集。</p><span className="module-link">管理数据 →</span></button></div></section></div>;
}

function StockView({ overview, query, setQuery, historyRange, setHistoryRange, onSearch, loading }: { overview: StockOverview | null; query: string; setQuery: (value: string) => void; historyRange: string; setHistoryRange: (value: string) => void; onSearch: (event: FormEvent) => void; loading: boolean }) {
  if (!overview) return <div className="view-content"><PageTitle eyebrow="STOCK RESEARCH" title="个股研究" description="搜索股票后，这里会展示行情、历史 K 线和公司行为。" /><section className="search-card"><SearchForm {...{ query, setQuery, historyRange, setHistoryRange, onSubmit: onSearch, loading }} /></section><div className="empty-state"><span className="empty-icon">⌁</span><h3>选择一只股票开始</h3><p>支持代码、中文名称或完整 thscode。</p></div></div>;
  const snapshot = overview.snapshot;
  const bars = overview.bars.slice(-20).reverse();
  const actions = overview.corporate_actions.slice(0, 12);
  return <div className="view-content"><PageTitle eyebrow={overview.instrument.thscode} title={overview.instrument.name} description={`${overview.source.adjust} 复权 · ${overview.source.from} 至 ${overview.source.to}`} action={<button className="secondary-button" onClick={() => window.history.back()}>返回</button>} /><section className="search-card compact"><SearchForm {...{ query, setQuery, historyRange, setHistoryRange, onSubmit: onSearch, loading }} /></section><section className="metrics-grid"><MetricCard label="最新价" value={number(snapshot?.last_price)} hint="实时快照" /><MetricCard label="涨跌幅" value={`${number(snapshot?.price_change_ratio_pct)}%`} tone={(snapshot?.price_change_ratio_pct ?? 0) >= 0 ? "positive" : "negative"} hint="相对前收盘" /><MetricCard label="成交量" value={number(snapshot?.volume, 0)} hint="股" /><MetricCard label="成交额" value={number(snapshot?.turnover)} hint="原始货币" /></section><section className="detail-grid"><article className="surface-card"><div className="card-heading"><div><span className="section-kicker">PRICE HISTORY</span><h2>历史日 K</h2></div><span className="muted-text">{overview.bars.length.toLocaleString()} 条</span></div><div className="table-scroll"><table><thead><tr><th>日期</th><th>开盘</th><th>最高</th><th>最低</th><th>收盘</th></tr></thead><tbody>{bars.map((bar) => <tr key={bar.date_ms}><td>{formatDate(bar.date_ms)}</td><td>{number(bar.open_price)}</td><td>{number(bar.high_price)}</td><td>{number(bar.low_price)}</td><td>{number(bar.close_price)}</td></tr>)}</tbody></table></div></article><article className="surface-card"><div className="card-heading"><div><span className="section-kicker">CORPORATE ACTIONS</span><h2>分红 / 送股</h2></div><span className="muted-text">{overview.corporate_actions.length.toLocaleString()} 条</span></div><div className="table-scroll"><table><thead><tr><th>除权除息日</th><th>现金分红/股</th><th>送股比例</th></tr></thead><tbody>{actions.length ? actions.map((action) => <tr key={action.ex_date_ms}><td>{formatDate(action.ex_date_ms)}</td><td>{number(action.dividend_per_share)}</td><td>{number(action.per_share_bonus * 100)}%</td></tr>) : <tr><td colSpan={3}>暂无公司行为数据</td></tr>}</tbody></table></div></article></section><p className="footnote">数据源：{overview.source.provider} · 分红事件默认读取完整历史 · 数据仅用于研究和展示，不构成投资建议。</p></div>;
}

function MarketView({ allMarket, onLoad, loading, search, setSearch, page, setPage }: { allMarket: AllMarketData | null; onLoad: (refresh?: boolean) => void; loading: boolean; search: string; setSearch: (value: string) => void; page: number; setPage: (value: number) => void }) {
  const rows = useMemo<MarketRow[]>(() => {
    if (!allMarket) return [];
    const names = new Map(allMarket.catalog.items.map((item) => [String(item.thscode ?? ""), String(item.name ?? "")]));
    const keyword = search.trim().toLowerCase();
    return allMarket.snapshot.items.map((item) => ({ ...item, name: names.get(item.thscode) ?? "" })).filter((item) => !keyword || item.thscode.toLowerCase().includes(keyword) || item.ticker.toLowerCase().includes(keyword) || item.name.toLowerCase().includes(keyword));
  }, [allMarket, search]);
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const visible = rows.slice((page - 1) * pageSize, page * pageSize);
  return <div className="view-content"><PageTitle eyebrow="MARKET MONITOR" title="全市场行情" description="用一个清晰的表格浏览全部 A 股最新行情，支持搜索和分页。" action={<div className="action-group"><button className="secondary-button" onClick={() => onLoad(true)} disabled={loading || !allMarket}>刷新</button><button className="primary-button" onClick={() => onLoad(false)} disabled={loading}>{loading ? "同步中…" : allMarket ? "重新获取" : "获取全部股票"}</button></div>} />{!allMarket ? <div className="empty-state"><span className="empty-icon">▦</span><h3>全市场数据尚未加载</h3><p>点击右上角按钮，获取目录、最新行情和可下载数据集。</p></div> : <section className="surface-card market-surface"><div className="market-stats"><MetricCard label="股票标的" value={allMarket.catalog.total.toLocaleString()} hint="目录" /><MetricCard label="最新行情" value={allMarket.snapshot.total.toLocaleString()} hint={`${allMarket.snapshot.pages} 页`} /><MetricCard label="缓存状态" value={allMarket.cache.snapshot_hit ? "已命中" : "已更新"} hint={allMarket.cache.directory} /></div><div className="table-toolbar"><label className="table-search"><span>筛选</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="代码或名称" /></label><span className="muted-text">显示 {rows.length.toLocaleString()} / {allMarket.snapshot.items.length.toLocaleString()}</span></div><div className="table-scroll market-table"><table><thead><tr><th>代码</th><th>名称</th><th>最新价</th><th>涨跌幅</th><th>开盘</th><th>最高</th><th>最低</th><th>成交量</th><th>成交额</th></tr></thead><tbody>{visible.map((item) => <tr key={item.thscode}><td className="code-cell">{item.thscode}</td><td>{item.name || "—"}</td><td>{number(item.last_price)}</td><td className={item.price_change_ratio_pct >= 0 ? "positive" : "negative"}>{number(item.price_change_ratio_pct)}%</td><td>{number(item.open_price)}</td><td>{number(item.high_price)}</td><td>{number(item.low_price)}</td><td>{number(item.volume, 0)}</td><td>{number(item.turnover)}</td></tr>)}</tbody></table></div><div className="pagination"><button className="secondary-button" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>上一页</button><span>第 {page} / {pageCount} 页</span><button className="secondary-button" onClick={() => setPage(Math.min(pageCount, page + 1))} disabled={page >= pageCount}>下一页</button></div></section>}</div>;
}

function DatasetsView({ allMarket, onLoad, loading }: { allMarket: AllMarketData | null; onLoad: (refresh?: boolean) => void; loading: boolean }) {
  return <div className="view-content"><PageTitle eyebrow="DATA CENTER" title="数据中心" description="管理可复用的市场数据资产。下载链接短期有效，目录和行情快照会缓存在本地。" action={<button className="primary-button" onClick={() => onLoad(true)} disabled={loading}>{loading ? "刷新中…" : "刷新下载链接"}</button>} />{!allMarket ? <div className="empty-state"><span className="empty-icon">↓</span><h3>还没有数据资产</h3><p>先获取全市场数据，生成最新的 Parquet 下载链接。</p><button className="primary-button" onClick={() => onLoad(false)} disabled={loading}>{loading ? "获取中…" : "获取数据资产"}</button></div> : <><section className="dataset-grid">{Object.entries(allMarket.datasets).map(([name, dataset]) => <article className="dataset-card" key={name}><div className="dataset-icon">↓</div><span className="section-kicker">PARQUET DATASET</span><h3>{name}</h3><p>{name === "daily_k_10y" ? "全市场约十年未复权日 K" : name === "daily_k_10d" ? "最近十个交易日，适合增量同步" : "全市场完整分红、送股和配股事件"}</p>{dataset.download_url ? <a className="download-link" href={dataset.download_url} target="_blank" rel="noreferrer">下载数据 ↗</a> : <span className="muted-text">暂无可用链接</span>}<small>有效期约 5 分钟</small></article>)}</section><section className="info-banner"><span className="info-icon">i</span><div><strong>本地缓存已启用</strong><p>股票目录和最新行情缓存在后端的 <code>{allMarket.cache.directory}</code>。下载链接不会被缓存，刷新页面会获取新的短期链接。</p></div></section></>}</div>;
}

export default function App() {
  const [view, setView] = useState<View>(() => getViewFromHash());
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

  useEffect(() => {
    const handleHashChange = () => setView(getViewFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    getHealth().then((result) => setHealth(`API 在线 · ${result.service}`)).catch(() => setHealth("API 离线"));
  }, []);

  function navigate(next: View) {
    window.location.hash = next;
  }

  async function loadOverview(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const range = historyRange === "all" ? "all" : Number(historyRange);
      setOverview(await getStockOverview(query.trim(), range));
      navigate("stock");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "获取数据失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadAllMarket(refresh = false) {
    setBulkLoading(true);
    try {
      setAllMarket(await getAllMarketData(refresh));
      setMarketPage(1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "获取全市场数据失败");
    } finally {
      setBulkLoading(false);
    }
  }

  return <div className="app-layout"><aside className="sidebar"><div className="logo"><span className="logo-mark">s</span><span>stock<span className="logo-accent">-ai</span></span></div><div className="workspace-switcher"><span className="workspace-avatar">W</span><div><strong>研究工作台</strong><small>个人空间</small></div><span className="chevron">⌄</span></div><nav className="side-nav" aria-label="主导航">{(["dashboard", "stock", "market", "datasets"] as View[]).map((item) => <button key={item} className={view === item ? "active" : ""} onClick={() => navigate(item)}><span className="nav-icon">{item === "dashboard" ? "⌂" : item === "stock" ? "⌁" : item === "market" ? "▦" : "↓"}</span>{viewLabels[item]}</button>)}</nav><div className="sidebar-footer"><div className="connection-status"><span className={`connection-dot ${health.includes("在线") ? "online" : ""}`} /><span>{health.includes("在线") ? "数据服务在线" : health}</span></div><small>stock-ai v0.5</small></div></aside><main className="main-shell"><header className="topbar"><div className="breadcrumb">工作台 <span>/</span> {viewLabels[view]}</div><div className="topbar-actions"><span className="market-time">A 股数据</span><button className="avatar-button">W</button></div></header>{view === "dashboard" && <Dashboard {...{ overview, query, setQuery, historyRange, setHistoryRange, onSearch: loadOverview, loading, onNavigate: navigate, allMarket }} />}{view === "stock" && <StockView {...{ overview, query, setQuery, historyRange, setHistoryRange, onSearch: loadOverview, loading }} />}{view === "market" && <MarketView allMarket={allMarket} onLoad={loadAllMarket} loading={bulkLoading} search={marketSearch} setSearch={setMarketSearch} page={marketPage} setPage={setMarketPage} />}{view === "datasets" && <DatasetsView allMarket={allMarket} onLoad={loadAllMarket} loading={bulkLoading} />}</main></div>;
}
