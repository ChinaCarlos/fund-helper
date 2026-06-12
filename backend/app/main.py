from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.api.websocket import router as ws_router
from app.config import settings
from app.services.broadcaster import Broadcaster
from app.services.poller import PortfolioPoller
from app.yjb.auth_store import AuthStore

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    auth_store = AuthStore()
    broadcaster = Broadcaster()
    poller = PortfolioPoller(auth_store, broadcaster)

    app.state.auth_store = auth_store
    app.state.broadcaster = broadcaster
    app.state.poller = poller
    app.state.qr_sessions = {}

    poller.start()
    if auth_store.session.is_valid:
        import asyncio

        asyncio.create_task(poller.poll_once())

    yield

    poller.stop()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(ws_router)
