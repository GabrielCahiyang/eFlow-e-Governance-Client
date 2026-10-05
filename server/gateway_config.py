"""Runtime configuration for the eFlow control gateway."""

from dataclasses import dataclass
import os
from pathlib import Path
import tempfile

from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def _required_env(*names: str) -> str:
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value
    joined = " or ".join(names)
    raise RuntimeError(f"Missing required environment variable: {joined}")


def _allowed_origins() -> list[str]:
    raw = os.getenv("EFLOW_ALLOWED_ORIGINS", "*")
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return origins or ["*"]


@dataclass(frozen=True)
class GatewaySettings:
    supabase_url: str
    supabase_service_role_key: str
    internal_ai_base_url: str
    ai_timeout_seconds: float
    allowed_origins: list[str]
    database_url: str | None
    pg_dump_path: str
    backup_root: Path
    backup_retention_hours: int


def load_settings() -> GatewaySettings:
    return GatewaySettings(
        supabase_url=_required_env("SUPABASE_URL", "VITE_SUPABASE_URL").rstrip("/"),
        # Deliberately do not accept a VITE_ service-role variable. VITE_ values
        # are browser-facing configuration and must never be treated as secrets.
        supabase_service_role_key=_required_env("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
        internal_ai_base_url=os.getenv(
            "EFLOW_INTERNAL_AI_BASE_URL",
            "http://127.0.0.1:8321/controlpanelEflow/api",
        ).rstrip("/"),
        ai_timeout_seconds=float(os.getenv("EFLOW_AI_TIMEOUT_SECONDS", "7200")),
        allowed_origins=_allowed_origins(),
        database_url=os.getenv("EFLOW_DATABASE_URL", "").strip() or None,
        pg_dump_path=os.getenv("EFLOW_PG_DUMP_PATH", "pg_dump").strip() or "pg_dump",
        backup_root=Path(
            os.getenv(
                "EFLOW_BACKUP_ROOT",
                str(Path(tempfile.gettempdir()) / "eflow-backups"),
            )
        ).resolve(),
        backup_retention_hours=max(
            1,
            min(168, int(os.getenv("EFLOW_BACKUP_RETENTION_HOURS", "24"))),
        ),
    )


settings = load_settings()
