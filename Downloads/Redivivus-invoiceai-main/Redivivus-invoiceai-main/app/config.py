from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Azure Document Intelligence
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: str
    AZURE_DOCUMENT_INTELLIGENCE_KEY: str

    # Azure Blob Storage
    AZURE_STORAGE_CONNECTION_STRING: str
    AZURE_STORAGE_CONTAINER_NAME: str = "invoices-test"

    # Database
    DATABASE_URL: str

    # Auth
    JWT_SECRET: str

    # Optional
    ENVIRONMENT: str = "dev"
    LOG_LEVEL: str = "INFO"
    APP_PORT: int = 8001

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── Validators ──────────────────────────
    @field_validator("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
    @classmethod
    def endpoint_must_be_https(cls, v: str) -> str:
        if not v.startswith("https://"):
            raise ValueError("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT must start with https://")
        return v

    @field_validator("JWT_SECRET")
    @classmethod
    def jwt_secret_min_length(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters for security")
        return v

    @field_validator("DATABASE_URL")
    @classmethod
    def database_url_format(cls, v: str) -> str:
        if not (v.startswith("postgresql://") or v.startswith("sqlite:///")):
            raise ValueError("DATABASE_URL must start with postgresql:// or sqlite:///")
        return v


# Create a global instance to be imported anywhere in your app
settings = Settings()