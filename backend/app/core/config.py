"""Application settings loaded from environment / .env files."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", case_sensitive=False
    )

    # --- General ---
    app_name: str = "FinSight AI"
    environment: str = "development"
    log_level: str = "INFO"
    api_v1_prefix: str = "/api/v1"

    # --- Database ---
    database_url: str = "postgresql+asyncpg://finsight:finsight@localhost:5432/finsight"

    # --- Auth ---
    # Dev default only; MUST be overridden (>= 32 random bytes) in production.
    jwt_secret: str = "dev-secret-change-me-0123456789abcdef0123456789abcdef"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60 * 24
    cookie_name: str = "finsight_token"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    # --- Groq ---
    groq_api_key: str = ""
    groq_chat_model: str = "llama-3.3-70b-versatile"
    groq_embed_model: str = ""
    groq_rerank_model: str = ""

    # --- Chroma ---
    chroma_host: str = "localhost"
    chroma_port: int = 8001
    chroma_collection: str = "finsight_chunks"

    # --- Object storage (R2 / S3 / MinIO) ---
    s3_endpoint_url: str = "http://localhost:9000"
    s3_bucket: str = "finsight-documents"
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_region: str = "auto"

    # --- App behaviour ---
    upload_dir: Path = Path("../data/uploads")
    cors_origins: str = "http://localhost:3000"
    max_upload_mb: int = 50
    default_top_k: int = 12
    final_top_k: int = 6

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
