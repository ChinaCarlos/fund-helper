from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from app.market import network as _market_network  # noqa: F401  # 配置东财直连，须在 akshare 调用前

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.admin import router as admin_router
from app.api.routes import router as api_router
from app.auth.repository import SessionRepository, UserRepository
from app.config import settings
from app.db.mongo import close_mongodb, connect_mongodb
from app.notify.config_store import NotificationConfigStore
from app.services.poller import PortfolioPoller

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = await connect_mongodb()
    user_repo = UserRepository(db)
    await user_repo.ensure_default_admin()

    app.state.db = db
    app.state.user_repo = user_repo
    app.state.session_repo = SessionRepository(db)
    app.state.notify_config_store = NotificationConfigStore(db)
    app.state.poller = PortfolioPoller()
    app.state.qr_sessions = {}

    yield

    await close_mongodb()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(admin_router)


def _mount_frontend(app: FastAPI) -> None:
    if not settings.serve_static:
        return

    static_dir = settings.static_dir
    if not static_dir.is_dir():
        logging.warning("serve_static enabled but static_dir missing: %s", static_dir)
        return

    assets_dir = static_dir / "static"
    if assets_dir.is_dir():
        app.mount("/static", StaticFiles(directory=assets_dir), name="static")

    index_file = static_dir / "index.html"

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("openapi"):
            raise HTTPException(status_code=404)
        if full_path:
            candidate = static_dir / full_path
            if candidate.is_file():
                return FileResponse(candidate)
        if index_file.is_file():
            return FileResponse(index_file)
        raise HTTPException(status_code=404)


_mount_frontend(app)
