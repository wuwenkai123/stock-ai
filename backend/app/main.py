from datetime import UTC, datetime
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict

from .providers.financial_api import (
    AmbiguousSymbolError,
    FinancialApiClient,
    FinancialApiError,
    MissingApiKeyError,
    SymbolNotFoundError,
)


class Settings(BaseSettings):
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    financial_api_key: str = ""
    financial_api_base_url: str = "https://fuyao.aicubes.cn"
    financial_api_timeout_seconds: float = 20.0
    model_config = SettingsConfigDict(env_prefix="STOCK_AI_", case_sensitive=False)


class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: datetime


class StockSummary(BaseModel):
    symbol: str
    name: str
    price: float | None
    change_percent: float | None
    source: str


settings = Settings()
app = FastAPI(title="stock-ai API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[item.strip() for item in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def financial_client() -> FinancialApiClient:
    return FinancialApiClient(
        base_url=settings.financial_api_base_url,
        api_key=settings.financial_api_key,
        timeout_seconds=settings.financial_api_timeout_seconds,
    )


@app.get("/api/v1/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    return HealthResponse(
        status="ok", service="stock-ai-api", timestamp=datetime.now(UTC)
    )


@app.get("/api/v1/stocks/overview", tags=["stocks"])
async def stock_overview(
    query: str = Query(..., min_length=1, description="股票名称、ticker 或 thscode"),
    days: int = Query(365, ge=1, le=3650),
    adjust: Literal["none", "forward", "backward"] = "forward",
) -> dict:
    try:
        return await financial_client().get_overview(query, days, adjust)
    except MissingApiKeyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except SymbolNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AmbiguousSymbolError as exc:
        raise HTTPException(
            status_code=409,
            detail={"message": str(exc), "candidates": exc.candidates},
        ) from exc
    except FinancialApiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/v1/stocks/{symbol}/summary", response_model=StockSummary, tags=["stocks"])
async def stock_summary(symbol: str) -> StockSummary:
    try:
        result = await financial_client().get_overview(symbol, days=30)
    except FinancialApiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    snapshot = result.get("snapshot") or {}
    return StockSummary(
        symbol=str(result["instrument"].get("thscode", symbol)),
        name=str(result["instrument"].get("name", "")),
        price=snapshot.get("last_price"),
        change_percent=snapshot.get("price_change_ratio_pct"),
        source="financial-api",
    )
