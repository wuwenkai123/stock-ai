import { useEffect, useState } from "react";
import { getHealth, type HealthResponse } from "./api";

const modules = [
  ["行情中心", "Market data adapters and normalized quotes"],
  ["策略分析", "Indicators, backtesting, and signals"],
  ["AI 洞察", "Evidence-based natural-language analysis"],
];

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHealth().then(setHealth).catch((reason: Error) => setError(reason.message));
  }, []);

  return (
    <main className="shell">
      <nav className="nav">
        <span className="brand">stock<span>-ai</span></span>
        <span className="badge">Architecture scaffold</span>
      </nav>
      <section className="hero">
        <p className="eyebrow">FULL-STACK FOUNDATION</p>
        <h1>数据、策略与 AI 洞察，在同一个工作台协同。</h1>
        <p className="lead">React 前端负责体验，FastAPI 后端负责业务边界，数据源和模型通过服务层统一接入。</p>
        <div className="status">
          <span className={`dot ${health ? "ok" : ""}`} />
          {error ? `API 离线：${error}` : health ? `API 在线 · ${health.service}` : "正在连接 API…"}
        </div>
      </section>
      <section className="grid">
        {modules.map(([title, description]) => (
          <article className="card" key={title}>
            <div className="card-icon">↗</div>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>
      <footer>stock-ai · frontend / backend separated architecture</footer>
    </main>
  );
}
