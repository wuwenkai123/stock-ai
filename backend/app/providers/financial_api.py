import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from ..market_cache import MarketCache


class FinancialApiError(RuntimeError):
    """An upstream financial-api request failed."""


class MissingApiKeyError(FinancialApiError):
    """The server-side financial-api key is not configured."""


class SymbolNotFoundError(FinancialApiError):
    """No A-share instrument matched the requested query."""


class AmbiguousSymbolError(FinancialApiError):
    def __init__(self, candidates: list[dict[str, Any]]) -> None:
        self.candidates = candidates
        super().__init__("The symbol query matched multiple A-share instruments")


class FinancialApiClient:
    """Server-side adapter for the official financial-api service."""

    ADJUSTMENT_FACTORS_PATH = "/api/a-share/corporate-actions/adjustment-factors"
    HISTORICAL_PATH = "/api/a-share/prices/historical"
    SNAPSHOT_PATH = "/api/a-share/prices/snapshot"
    MAX_HISTORY_CHUNK_DAYS = 3650
    EARLIEST_A_SHARE_DATE = datetime(1990, 1, 1, tzinfo=timezone.utc)
    MARKET_DUMPS = {
        "daily_k_10y": "/api/dump/market-dumps/daily-k/download-url",
        "daily_k_10d": "/api/dump/market-dumps/daily-k-10d/download-url",
        "adjustment_factors": "/api/dump/market-dumps/adjustment-factors/download-url",
    }

    def __init__(self, base_url: str, api_key: str, timeout_seconds: float = 20.0, cache_dir: str = "data/market-cache") -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key.strip()
        self.timeout_seconds = timeout_seconds
        self.cache = MarketCache(cache_dir)

    async def _get_json(
        self,
        path: str,
        params: dict[str, Any],
        allow_no_adjustment_events: bool = False,
    ) -> Any:
        if not self.api_key:
            raise MissingApiKeyError(
                "Configure STOCK_AI_FINANCIAL_API_KEY on the backend before requesting market data"
            )

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.get(
                    f"{self.base_url}{path}",
                    params=params,
                    headers={"X-api-key": self.api_key},
                )
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text[:500]
            raise FinancialApiError(
                f"financial-api returned HTTP {exc.response.status_code}: {detail}"
            ) from exc
        except httpx.RequestError as exc:
            raise FinancialApiError(f"financial-api request failed: {exc}") from exc

        try:
            payload = response.json()
        except ValueError as exc:
            raise FinancialApiError("financial-api returned invalid JSON") from exc

        if isinstance(payload, dict):
            code = payload.get("code")
            if code not in (None, 0, "0"):
                if (
                    allow_no_adjustment_events
                    and path == self.ADJUSTMENT_FACTORS_PATH
                    and str(code) == "3002"
                ):
                    return {"item": [], "_status": "no_events"}
                raise FinancialApiError(
                    f"financial-api returned code {code}: {payload.get('message', 'unknown error')}"
                )
            return payload.get("data", payload)
        return payload

    @staticmethod
    def _items(data: Any) -> list[dict[str, Any]]:
        if isinstance(data, dict) and isinstance(data.get("item"), list):
            return data["item"]
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
        return []

    async def resolve_a_share(self, query: str) -> dict[str, Any]:
        data = await self._get_json(
            "/api/meta/tickers/search",
            {"q": query.strip(), "asset_type": "a-share", "limit": 10},
        )
        candidates = self._items(data)
        if not candidates:
            raise SymbolNotFoundError(f"No A-share instrument matched: {query}")

        normalized = query.strip().upper()
        exact = [
            item
            for item in candidates
            if str(item.get("thscode", "")).upper() == normalized
            or str(item.get("ticker", "")).upper() == normalized
            or str(item.get("name", "")).strip() == query.strip()
        ]
        if len(exact) == 1:
            return exact[0]
        if len(candidates) > 1:
            raise AmbiguousSymbolError(candidates)
        return candidates[0]

    async def get_all_market_data(self, force_refresh: bool = False) -> dict[str, Any]:
        """Return current all-market data and fresh bulk download URLs."""
        cached_catalog = None if force_refresh else self.cache.load_json("catalog.json", 900)
        cached_snapshot = None if force_refresh else self.cache.load_json("snapshot.json", 300)

        dump_requests = asyncio.gather(
            *(self._get_json(path, {}) for path in self.MARKET_DUMPS.values())
        )
        snapshot_request = (
            self.get_all_snapshots()
            if cached_snapshot is None
            else asyncio.sleep(0, result=cached_snapshot)
        )
        catalog_request = (
            self._get_json(
                "/api/meta/tickers/list",
                {"exchange": "SH,SZ,BJ", "asset_type": "a-share", "limit": 10000, "offset": 0},
            )
            if cached_catalog is None
            else asyncio.sleep(0, result=cached_catalog)
        )
        dump_values, snapshot, catalog_data = await asyncio.gather(
            dump_requests, snapshot_request, catalog_request
        )

        if cached_snapshot is None:
            self.cache.save_json("snapshot.json", snapshot)
        if cached_catalog is None:
            self.cache.save_json("catalog.json", catalog_data)

        datasets: dict[str, dict[str, Any]] = {}
        for name, value in zip(self.MARKET_DUMPS, dump_values):
            value = value if isinstance(value, dict) else {}
            datasets[name] = {
                "format": "parquet",
                "download_url": value.get("presigned_url"),
                "expires_at": value.get("presigned_url_expires_at"),
            }

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "catalog": {
                "total": len(self._items(catalog_data)),
                "items": self._items(catalog_data),
            },
            "snapshot": snapshot,
            "datasets": datasets,
            "cache": {
                "enabled": self.cache.enabled,
                "directory": str(self.cache.directory),
                "catalog_hit": cached_catalog is not None,
                "snapshot_hit": cached_snapshot is not None,
            },
            "notes": [
                "Catalog and latest snapshots are cached locally for reuse.",
                "Bulk download URLs are short-lived and should be used immediately.",
                "daily_k_10y is the full-market ten-year unadjusted daily K-line dump.",
                "adjustment_factors contains full-market dividend, bonus-share, and allotment events.",
            ],
        }

    async def get_all_snapshots(self) -> dict[str, Any]:
        """Page through the all-market snapshot endpoint."""
        limit = 1000
        offset = 0
        items: list[dict[str, Any]] = []
        timestamp: Any = None
        total: Any = None
        pages = 0

        while True:
            data = await self._get_json(self.SNAPSHOT_PATH, {"limit": limit, "offset": offset})
            page_items = self._items(data)
            items.extend(page_items)
            pages += 1
            if isinstance(data, dict):
                timestamp = data.get("timestamp", timestamp)
                total = data.get("total", total)
            if len(page_items) < limit or (total is not None and len(items) >= int(total)):
                break
            offset += limit

        return {
            "timestamp": timestamp,
            "total": int(total) if total is not None else len(items),
            "pages": pages,
            "items": items,
        }

    async def get_historical_bars(
        self,
        thscode: str,
        start: datetime,
        end: datetime,
        adjust: str,
    ) -> tuple[list[dict[str, Any]], int]:
        """Fetch long history in API-compliant windows of at most 10 years."""
        windows: list[tuple[int, int]] = []
        cursor = start
        while cursor < end:
            window_end = min(cursor + timedelta(days=self.MAX_HISTORY_CHUNK_DAYS), end)
            windows.append((int(cursor.timestamp() * 1000), int(window_end.timestamp() * 1000)))
            cursor = window_end

        payloads = await asyncio.gather(
            *(
                self._get_json(
                    self.HISTORICAL_PATH,
                    {
                        "thscode": thscode,
                        "interval": "1d",
                        "start": start_ms,
                        "end": end_ms,
                        "adjust": adjust,
                    },
                )
                for start_ms, end_ms in windows
            )
        )

        by_date: dict[int, dict[str, Any]] = {}
        for payload in payloads:
            for bar in self._items(payload):
                date_ms = bar.get("date_ms")
                if date_ms is not None:
                    by_date[int(date_ms)] = bar

        return [by_date[key] for key in sorted(by_date)], len(windows)

    async def get_overview(
        self,
        query: str,
        days: int = 365,
        adjust: str = "forward",
        since_listing: bool = False,
    ) -> dict[str, Any]:
        instrument = await self.resolve_a_share(query)
        thscode = str(instrument["thscode"])
        now = datetime.now(timezone.utc)
        start = self.EARLIEST_A_SHARE_DATE if since_listing else now - timedelta(days=days)
        start_ms = int(start.timestamp() * 1000)
        end_ms = int(now.timestamp() * 1000)
        from_date = start.date().isoformat()
        to_date = now.date().isoformat()

        historical_request = (
            self.get_historical_bars(thscode, start, now, adjust)
            if since_listing
            else self._get_json(
                self.HISTORICAL_PATH,
                {
                    "thscode": thscode,
                    "interval": "1d",
                    "start": start_ms,
                    "end": end_ms,
                    "adjust": adjust,
                },
            )
        )

        snapshot_data, historical_data, actions_data = await asyncio.gather(
            self._get_json(self.SNAPSHOT_PATH, {"thscodes": thscode}),
            historical_request,
            self._get_json(
                self.ADJUSTMENT_FACTORS_PATH,
                {"thscode": thscode},
                allow_no_adjustment_events=True,
            ),
        )

        if since_listing:
            bars, historical_chunks = historical_data
        else:
            bars, historical_chunks = self._items(historical_data), 1

        snapshots = self._items(snapshot_data)
        action_status = actions_data.get("_status", "ok") if isinstance(actions_data, dict) else "ok"
        return {
            "instrument": instrument,
            "snapshot": snapshots[0] if snapshots else None,
            "bars": bars,
            "corporate_actions": self._items(actions_data),
            "source": {
                "provider": "financial-api",
                "base_url": self.base_url,
                "thscode": thscode,
                "adjust": adjust,
                "from": from_date,
                "to": to_date,
                "history_range": "since_listing" if since_listing else "days",
                "historical_chunks": historical_chunks,
                "corporate_actions_range": "all",
                "corporate_actions_status": action_status,
            },
        }
