import json
import time
from pathlib import Path
from typing import Any, Optional


class MarketCache:
    """Best-effort JSON cache for reusable market snapshots and catalogs."""

    def __init__(self, directory: str) -> None:
        self.directory = Path(directory)
        self.enabled = True
        try:
            self.directory.mkdir(parents=True, exist_ok=True)
        except OSError:
            self.enabled = False

    def load_json(self, name: str, max_age_seconds: int) -> Optional[Any]:
        if not self.enabled:
            return None
        path = self.directory / name
        try:
            if time.time() - path.stat().st_mtime > max_age_seconds:
                return None
            with path.open("r", encoding="utf-8") as handle:
                return json.load(handle)
        except (OSError, ValueError):
            return None

    def save_json(self, name: str, value: Any) -> None:
        if not self.enabled:
            return
        path = self.directory / name
        temporary = path.with_suffix(path.suffix + ".tmp")
        try:
            with temporary.open("w", encoding="utf-8") as handle:
                json.dump(value, handle, ensure_ascii=False, separators=(",", ":"))
            temporary.replace(path)
        except OSError:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass
