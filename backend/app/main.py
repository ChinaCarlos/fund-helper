from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from app.market import network as _market_network  # noqa: F401  # 配置东财直连，须在 akshare 调用前

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.config import settings
from app.notify.config_store import NotificationConfigStore
from app.services.poller import PortfolioPoller
from app.yjb.auth_store import AuthStore

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    auth_store = AuthStore()
    poller = PortfolioPoller(auth_store)

    app.state.auth_store = auth_store
    app.state.poller = poller
    app.state.notify_config_store = NotificationConfigStore()
    app.state.qr_sessions = {}

    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
