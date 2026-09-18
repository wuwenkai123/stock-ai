import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx


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
    """Small server-side adapter for the official financial-api service."""

    ADJUSTMENT_FACTORS_PATH = "/api/a-share/corporate-actions/adjustment-factors"

    def __init__(self, base_url: str, api_key: str, timeout_seconds: float = 20.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key.strip()
        self.timeout_seconds = timeout_seconds

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
                # 3002 means the stock is valid but has no adjustment
                # events in the requested period. Treat it as empty data.
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

    async def get_overview(
        self, query: str, days: int = 365, adjust: str = "forward"
    ) -> dict[str, Any]:
        instrument = await self.resolve_a_share(query)
        thscode = str(instrument["thscode"])
        now = datetime.now(timezone.utc)
        start = now - timedelta(days=days)
        start_ms = int(start.timestamp() * 1000)
        end_ms = int(now.timestamp() * 1000)
        from_date = start.date().isoformat()
        to_date = now.date().isoformat()

        # The K-line range follows the user's selected `days`. Corporate
        # actions intentionally omit from/to so the dividend panel can show
        # the complete history instead of only events in the K-line window.
        snapshot_data, historical_data, actions_data = await asyncio.gather(
            self._get_json(
                "/api/a-share/prices/snapshot",
                {"thscodes": thscode},
            ),
            self._get_json(
                "/api/a-share/prices/historical",
                {
                    "thscode": thscode,
                    "interval": "1d",
                    "start": start_ms,
                    "end": end_ms,
                    "adjust": adjust,
                },
            ),
            self._get_json(
                self.ADJUSTMENT_FACTORS_PATH,
                {"thscode": thscode},
                allow_no_adjustment_events=True,
            ),
        )

        snapshots = self._items(snapshot_data)
        action_status = actions_data.get("_status", "ok") if isinstance(actions_data, dict) else "ok"
        return {
            "instrument": instrument,
            "snapshot": snapshots[0] if snapshots else None,
            "bars": self._items(historical_data),
            "corporate_actions": self._items(actions_data),
            "source": {
                "provider": "financial-api",
                "base_url": self.base_url,
                "thscode": thscode,
                "adjust": adjust,
                "from": from_date,
                "to": to_date,
                "corporate_actions_range": "all",
                "corporate_actions_status": action_status,
            },
        }
