from __future__ import annotations

import os
from functools import wraps

import requests
from requests.adapters import HTTPAdapter

# 东财 / 天天基金：绕过本机 HTTP 代理（Clash/Cursor 等），避免 ProxyError
_EASTMONEY_MARKERS = (
    "eastmoney.com",
    "eastmoney.cn",
    "1234567.com.cn",
)

_NO_PROXY_EXTRA = (
    "eastmoney.com",
    ".eastmoney.com",
    "push2.eastmoney.com",
    "17.push2.eastmoney.com",
    "79.push2.eastmoney.com",
    "2.push2.eastmoney.com",
    "fund.eastmoney.com",
    "fundf10.eastmoney.com",
)

_BYPASS_PROXIES = {"http": None, "https": None}
EM_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Referer": "https://quote.eastmoney.com/",
    "Accept": "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9",
}
_CONFIGURED = False


def _is_eastmoney_url(url: str) -> bool:
    text = str(url)
    return any(marker in text for marker in _EASTMONEY_MARKERS)


def _merge_no_proxy() -> None:
    for key in ("NO_PROXY", "no_proxy"):
        current = os.environ.get(key, "")
        parts = {part.strip() for part in current.split(",") if part.strip()}
        parts.update(_NO_PROXY_EXTRA)
        os.environ[key] = ",".join(sorted(parts))


def _apply_direct_session(session: requests.Session, url: str) -> None:
    if _is_eastmoney_url(url):
        session.trust_env = False


def _em_request_kwargs(url: str, kwargs: dict) -> dict:
    if not _is_eastmoney_url(url):
        return kwargs
    headers = dict(EM_BROWSER_HEADERS)
    headers.update(kwargs.pop("headers", {}) or {})
    kwargs["headers"] = headers
    kwargs.setdefault("proxies", _BYPASS_PROXIES)
    return kwargs


def _patch_requests_session() -> None:
    original_request = requests.Session.request

    def request(self, method, url, **kwargs):  # type: ignore[no-untyped-def]
        if _is_eastmoney_url(url):
            self.trust_env = False
        kwargs = _em_request_kwargs(url, kwargs)
        return original_request(self, method, url, **kwargs)

    requests.Session.request = request  # type: ignore[method-assign]

    def _patch_api_method(method_name: str) -> None:
        def api_request(url, **kwargs):  # type: ignore[no-untyped-def]
            kwargs = _em_request_kwargs(url, kwargs)
            with requests.Session() as session:
                if _is_eastmoney_url(url):
                    session.trust_env = False
                return getattr(session, method_name)(url, **kwargs)

        setattr(requests.api, method_name, api_request)
        setattr(requests, method_name, api_request)

    for name in ("get", "post"):
        _patch_api_method(name)


def _patch_akshare_request_with_retry() -> None:
    try:
        import akshare.utils.request as ak_request
    except ImportError:
        return

    if getattr(ak_request.request_with_retry, "_em_direct_patched", False):
        return

    original = ak_request.request_with_retry

    @wraps(original)
    def request_with_retry(  # type: ignore[no-untyped-def]
        url: str,
        params=None,
        timeout: int = 15,
        max_retries: int = 3,
        base_delay: float = 1.0,
        random_delay_range=(0.5, 1.5),
    ):
        import random
        import time

        last_exception = None
        for attempt in range(max_retries):
            try:
                with requests.Session() as session:
                    _apply_direct_session(session, url)
                    adapter = HTTPAdapter(pool_connections=1, pool_maxsize=1)
                    session.mount("http://", adapter)
                    session.mount("https://", adapter)
                    kwargs: dict = {"params": params, "timeout": timeout}
                    kwargs = _em_request_kwargs(url, kwargs)
                    response = session.get(url, **kwargs)
                    response.raise_for_status()
                    return response
            except (requests.RequestException, ValueError) as exc:
                last_exception = exc
                if attempt < max_retries - 1:
                    delay = base_delay * (2**attempt) + random.uniform(*random_delay_range)
                    time.sleep(delay)
        raise last_exception

    request_with_retry._em_direct_patched = True  # type: ignore[attr-defined]
    ak_request.request_with_retry = request_with_retry


def configure_em_direct_requests() -> None:
    """让 AKShare 访问东财时直连，不走系统 HTTP 代理。"""
    global _CONFIGURED
    if _CONFIGURED:
        return
    _CONFIGURED = True

    _merge_no_proxy()
    _patch_requests_session()
    _patch_akshare_request_with_retry()


configure_em_direct_requests()
