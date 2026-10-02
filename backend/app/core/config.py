"""Application settings, loaded from environment variables (and an optional .env file).

Secrets (API keys, DB credentials) live only here on the server and are never
serialized to API responses.
"""

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(BACKEND_DIR.parent / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Core -----------------------------------------------------------------
    environment: Literal["development", "test", "production"] = "development"
    app_name: str = "VYRA — Enterprise AI Presentation Infrastructure"
    # SQLite is the zero-dependency fallback for local development; Docker/production use PostgreSQL + pgvector.
    database_url: str = f"sqlite+aiosqlite:///{(BACKEND_DIR / 'data' / 'dev.db').as_posix()}"
    secret_key: SecretStr = SecretStr("dev-insecure-secret-change-me")
    access_token_ttl_minutes: int = 60 * 12
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:8080", "http://localhost:5173", "http://localhost:3000"]
    )
    public_app_url: str = "http://localhost:8080"
    log_level: str = "INFO"
    log_json: bool = False

    # --- LLM ------------------------------------------------------------------
    llm_provider: Literal["qwen", "openai_compatible", "mock"] = "mock"
    qwen_api_key: SecretStr | None = None
    qwen_base_url: str = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
    qwen_model: str = "qwen3.5-plus"
    qwen_enable_thinking: bool = False
    openai_compatible_api_key: SecretStr | None = None
    openai_compatible_base_url: str = ""
    openai_compatible_model: str = ""
    llm_temperature: float = 0.4
    llm_timeout_seconds: float = 120.0
    llm_max_repair_attempts: int = 2

    # --- Embeddings / RAG -----------------------------------------------------
    # hash: dependency-free lexical feature hashing; fastembed: local open-source model; openai_compatible: API.
    embedding_provider: Literal["hash", "fastembed", "openai_compatible"] = "hash"
    embedding_dim: int = 768
    # Use the pgvector `vector` type + HNSW index on PostgreSQL. Disable only for Postgres servers without the
    # extension (embeddings are then stored as JSON and ranked in Python).
    pgvector_enabled: bool = True
    fastembed_model: str = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"
    embedding_api_key: SecretStr | None = None
    embedding_base_url: str = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
    embedding_model: str = "text-embedding-v4"

    # --- Speech-to-text -------------------------------------------------------
    stt_provider_en: Literal["mock", "whisper", "deepgram"] = "mock"
    stt_provider_ur: Literal["mock", "soniox", "whisper"] = "mock"
    whisper_model: str = "small"
    whisper_device: str = "auto"
    whisper_compute_type: str = "int8"
    deepgram_api_key: SecretStr | None = None
    deepgram_model: str = "nova-3"
    soniox_api_key: SecretStr | None = None
    soniox_model: str = "stt-rt-v4"
    soniox_url: str = "wss://stt-rt.jp.soniox.com/transcribe-websocket"
    live_insight_interval_seconds: float = 20.0

    # --- Storage --------------------------------------------------------------
    storage_provider: Literal["local", "minio", "s3"] = "local"
    local_storage_dir: Path = BACKEND_DIR / "data" / "storage"
    minio_endpoint: str = "http://localhost:9000"
    minio_access_key: SecretStr | None = None
    minio_secret_key: SecretStr | None = None
    minio_bucket: str = "enterprise-ai"
    minio_region: str = "us-east-1"
    max_upload_mb: int = 50

    # --- Jobs -----------------------------------------------------------------
    # inline: asyncio tasks inside the API process (dev); arq: Redis queue + separate worker (docker/prod);
    # eager: run synchronously inside the request (tests).
    job_backend: Literal["inline", "arq", "eager"] = "inline"
    redis_url: str = "redis://localhost:6379/0"

    # --- Rate limiting --------------------------------------------------------
    rate_limit_auth_per_minute: int = 20
    rate_limit_ai_per_minute: int = 30

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v: object) -> object:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                import json

                return json.loads(v)
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    def ensure_sqlite_dir(self) -> None:
        if self.is_sqlite:
            path = self.database_url.split("///", 1)[-1]
            if path and path != ":memory:":
                Path(path).parent.mkdir(parents=True, exist_ok=True)

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    def validate_for_production(self) -> None:
        if self.environment == "production" and self.secret_key.get_secret_value().startswith("dev-insecure"):
            raise RuntimeError("SECRET_KEY must be set in production")


@lru_cache
def get_settings() -> Settings:
    return Settings()
