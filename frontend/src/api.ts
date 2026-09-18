export type StockSnapshot = {
  thscode: string;
  ticker: string;
  last_price: number;
  price_change: number;
  price_change_ratio_pct: number;
  open_price: number;
  high_price: number;
  low_price: number;
  prev_price: number;
  volume: number;
  turnover: number;
};

export type PriceBar = {
  date_ms: number;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
  turnover: number;
};

export type CorporateAction = {
  ticker: string;
  ex_date_ms: number;
  dividend_per_share: number;
  per_share_bonus: number;
};

export type StockOverview = {
  instrument: {
    thscode: string;
    ticker: string;
    name: string;
    exchange: string;
    asset_type: string;
  };
  snapshot: StockSnapshot | null;
  bars: PriceBar[];
  corporate_actions: CorporateAction[];
  source: {
    provider: string;
    thscode: string;
    adjust: string;
    from: string;
    to: string;
  };
};

export type HealthResponse = {
  status: string;
  service: string;
  timestamp: string;
};

async function parseResponse(response: Response) {
  if (response.ok) return response.json();
  const payload = await response.json().catch(() => null);
  const detail = payload?.detail;
  throw new Error(typeof detail === "string" ? detail : detail?.message ?? `Request failed (${response.status})`);
}

export async function getHealth(): Promise<HealthResponse> {
  return parseResponse(await fetch("/api/v1/health"));
}

export async function getStockOverview(query: string, days = 365): Promise<StockOverview> {
  const params = new URLSearchParams({ query, days: String(days), adjust: "forward" });
  return parseResponse(await fetch(`/api/v1/stocks/overview?${params}`));
}
