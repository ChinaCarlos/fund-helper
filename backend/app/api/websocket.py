from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    broadcaster = websocket.app.state.broadcaster
    auth_store = websocket.app.state.auth_store
    poller = websocket.app.state.poller

    await broadcaster.connect(websocket)

    if auth_store.session.is_valid:
        if poller.latest:
            await websocket.send_json(
                {"type": "portfolio_update", "data": poller.latest}
            )
        else:
            await websocket.send_json(
                {
                    "type": "auth_ok",
                    "data": {
                        "nickname": auth_store.session.nickname,
                        "avatar": auth_store.session.avatar,
                    },
                }
            )
    else:
        await websocket.send_json({"type": "auth_required"})

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await broadcaster.disconnect(websocket)
