from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "InNova Plataforma API"
    app_env: str = "development"
    database_url: str = "sqlite:///./innova_plataforma.db"

    secret_key: str = "change-me"
    access_token_expire_minutes: int = 480

    cors_origins: str = (
        "http://127.0.0.1:5500,"
        "http://localhost:5500,"
        "https://innova-plataforma.vercel.app"
    )

    admin_username: str = "admin"
    admin_password: str = "change-me"

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        case_sensitive=False,
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            item.strip()
            for item in self.cors_origins.split(",")
            if item.strip()
        ]

    @property
    def normalized_database_url(self) -> str:
        url = self.database_url.strip()

        if url.startswith("postgres://"):
            return url.replace(
                "postgres://",
                "postgresql+psycopg://",
                1,
            )

        if url.startswith("postgresql://") and "+psycopg" not in url:
            return url.replace(
                "postgresql://",
                "postgresql+psycopg://",
                1,
            )

        return url

    @property
    def database_backend(self) -> str:
        if self.normalized_database_url.startswith("postgresql"):
            return "postgresql"
        if self.normalized_database_url.startswith("sqlite"):
            return "sqlite"
        return "unknown"


settings = Settings()
