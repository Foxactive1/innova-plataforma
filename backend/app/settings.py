from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "InNova Plataforma API"
    app_env: str = "development"
    database_url: str = "sqlite:///./innova_plataforma.db"
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 480
    cors_origins: str = "http://127.0.0.1:5500,http://localhost:5500"
    admin_username: str = "admin"
    admin_password: str = "change-me"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

settings = Settings()
