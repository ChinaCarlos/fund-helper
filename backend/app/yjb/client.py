from __future__ import annotations

import hashlib
import time
from typing import Any

import httpx

from app.config import settings


class YjbApiError(Exception):
    def __init__(self, message: str, *, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class YjbClient:
    def __init__(self, token: str = ""):
        self.token = token
        self._client = httpx.AsyncClient(
            base_url=settings.yjb_base_url,
            timeout=30.0,
        )

    async def close(self) -> None:
        await self._client.aclose()

    def _sign(self, url_path: str, timestamp: int) -> str:
        raw = f"{url_path}{self.token}{timestamp}{settings.yjb_api_secret}"
        return hashlib.md5(raw.encode()).hexdigest()

    async def request(
        self,
        method: str,
        path: str,
        *,
        params: dict | list[tuple[str, str]] | None = None,
        json_body: dict | None = None,
    ) -> Any:
        timestamp = int(time.time())
        headers = {
            "Content-Type": "application/json",
            "Authorization": self.token,
            "Request-Time": str(timestamp),
            "Request-Sign": self._sign(path, timestamp),
        }

        response = await self._client.request(
            method, path, params=params, json=json_body, headers=headers
        )

        if response.status_code == 401:
            raise YjbApiError("Token 已失效，请重新登录", status_code=401)

        try:
            payload = response.json()
        except ValueError as exc:
            raise YjbApiError(f"响应解析失败: {response.text}") from exc

        if response.status_code == 429:
            raise YjbApiError("请求频繁，请稍后再试", status_code=429)

        if payload.get("code") != 200:
            message = payload.get("message") or str(payload)
            if "token" in message.lower() or "登录" in message or "授权" in message:
                raise YjbApiError(message, status_code=401)
            raise YjbApiError(message, status_code=response.status_code)

        return payload.get("data")

    async def get_qrcode(self) -> dict:
        return await self.request("GET", "/qr_code")

    async def get_qrcode_state(self, qr_id: str) -> dict:
        return await self.request("GET", f"/qr_code_state/{qr_id}")

    async def get_accounts(self) -> dict:
        return await self.request(
            "GET", "/user_account", params={"from": "check_plug_target_account"}
        )

    async def get_collect(self) -> dict:
        return await self.request("GET", "/account_collect")

    async def get_funds(self, account_id: int) -> list:
        return await self.request(
            "GET", "/fund_hold", params={"account_id": account_id}
        )

    async def get_index(self) -> dict:
        return await self.request("GET", "/index_data")

    async def search_fund(
        self, keyword: str, *, account_id: int | None = None
    ) -> list:
        params: dict[str, str | int] = {"keyword": keyword}
        if account_id is not None:
            params["account_id"] = account_id
        return await self.request("GET", "/search_fund", params=params)

    async def add_fund_hold(
        self,
        *,
        account_id: int,
        items: list[dict],
        sync_optional: int = 0,
    ) -> Any:
        return await self.request(
            "POST",
            "/fund_hold",
            json_body={
                "account_id": account_id,
                "sync_optional": sync_optional,
                "items": items,
            },
        )

    async def get_income_line_data(
        self, *, account_ids: list[int] | None = None, collect: bool = False
    ) -> dict:
        """收益曲线：汇总用 collect=true；单/多分组用 account_ids[]。"""
        if collect or not account_ids:
            return await self.request(
                "GET",
                "/income_line_data",
                params={"date_type": "day", "collect": "true"},
            )

        # 插件文档写 account_id+collect=false，实测需 account_ids[] 才能拿到各分组独立曲线
        params: list[tuple[str, str]] = [("date_type", "day")]
        for account_id in account_ids:
            params.append(("account_ids[]", str(account_id)))
        return await self.request("GET", "/income_line_data", params=params)

    async def remove_fund_hold(
        self, *, account_id: int, fund_ids: list[int]
    ) -> Any:
        params: list[tuple[str, str]] = [("account_id", str(account_id))]
        for fund_id in fund_ids:
            params.append(("fund_ids[]", str(fund_id)))
        return await self.request("DELETE", "/remove_fund_hold", params=params)
