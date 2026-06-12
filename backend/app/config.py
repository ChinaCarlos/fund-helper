from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "YJB Realtime Monitor"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    poll_interval: int = 30
    idle_check_interval: int = 60  # 非交易时段唤醒间隔（秒），期间不请求养基宝
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    # OAuth 回调基址（需在飞书/钉钉应用后台配置相同重定向 URL）
    public_base_url: str = "http://localhost:8000"
    frontend_base_url: str = "http://localhost:3000"

    yjb_base_url: str = "http://browser-plug-api.yangjibao.com"
    yjb_api_secret: str = "YxmKSrQR4uoJ5lOoWIhcbd7SlUEh9OOc"

    data_dir: Path = Path(__file__).resolve().parent.parent.parent / "data"


settings = Settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)
