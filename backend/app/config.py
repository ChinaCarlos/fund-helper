from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Fund Helper"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    poll_interval: int = 30
    idle_check_interval: int = 60  # 非交易时段唤醒间隔（秒），期间不请求养基宝
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    # OAuth 回调基址（需在飞书/钉钉应用后台配置相同重定向 URL）
    public_base_url: str = "http://localhost:8000"
    web_base_url: str = "http://localhost:3000"
    # Docker 生产模式：由后端托管 Web 静态资源
    serve_static: bool = False
    static_dir: Path = _PROJECT_ROOT / "web" / "dist"

    yjb_base_url: str = "http://browser-plug-api.yangjibao.com"
    yjb_api_secret: str = "YxmKSrQR4uoJ5lOoWIhcbd7SlUEh9OOc"

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "fund_helper"

    session_cookie_name: str = "fund_helper_session"
    session_max_age_days: int = 30
    session_cookie_secure: bool = False

    admin_username: str = "admin"
    admin_password: str = "123456"

    @field_validator("static_dir", mode="before")
    @classmethod
    def expand_path(cls, value: object) -> object:
        if isinstance(value, str):
            return Path(value)
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> list[str]:
        if value is None:
            return []
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        if isinstance(value, str):
            text = value.strip()
            if not text:
                return []
            if text.startswith("["):
                import json

                parsed = json.loads(text)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]
            return [item.strip() for item in text.split(",") if item.strip()]
        return value  # type: ignore[return-value]


settings = Settings()
