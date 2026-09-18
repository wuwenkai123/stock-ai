from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    model_config = SettingsConfigDict(env_prefix="STOCK_AI_", case_sensitive=False)


class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: datetime


class StockSummary(BaseModel):
    symbol: str
    name: str
    price: float
    change_percent: float
    source: str


settings = Settings()
app = FastAPI(title="stock-ai API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[item.strip() for item in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    return HealthResponse(
        status="ok", service="stock-ai-api", timestamp=datetime.now(UTC)
    )


@app.get("/api/v1/stocks/{symbol}/summary", response_model=StockSummary, tags=["stocks"])
def stock_summary(symbol: str) -> StockSummary:
    return StockSummary(
        symbol=symbol.upper(),
        name="Demo Stock",
        price=100.0,
        change_percent=0.0,
        source="mock",
    )
