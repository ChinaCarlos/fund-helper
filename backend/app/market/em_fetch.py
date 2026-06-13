from __future__ import annotations

import math
import random
import time
from typing import Any

import pandas as pd
import requests

EM_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Referer": "https://quote.eastmoney.com/",
    "Accept": "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9",
}

PUSH2_HOSTS = (
    "https://push2.eastmoney.com",
    "https://17.push2.eastmoney.com",
    "https://79.push2.eastmoney.com",
    "https://2.push2.eastmoney.com",
)

_BYPASS = {"http": None, "https": None}


def _request_json(url: str, params: dict[str, Any], *, timeout: int = 20) -> dict[str, Any]:
    with requests.Session() as session:
        session.trust_env = False
        response = session.get(
            url,
            params=params,
            headers=EM_HEADERS,
            timeout=timeout,
            proxies=_BYPASS,
        )
        response.raise_for_status()
        return response.json()


def fetch_push2_paginated(
    base_params: dict[str, Any],
    *,
    hosts: tuple[str, ...] = PUSH2_HOSTS,
    timeout: int = 20,
) -> pd.DataFrame:
    last_error: Exception | None = None
    for host in hosts:
        try:
            return _fetch_push2_from_host(host, base_params, timeout=timeout)
        except Exception as exc:
            last_error = exc
            continue
    raise last_error or RuntimeError("东财 push2 接口不可用")


def _fetch_push2_from_host(
    host: str,
    base_params: dict[str, Any],
    *,
    timeout: int,
) -> pd.DataFrame:
    url = f"{host}/api/qt/clist/get"
    params = dict(base_params)
    data_json = _request_json(url, params, timeout=timeout)
    diff = data_json.get("data", {}).get("diff") or []
    if not diff:
        raise ValueError("东财返回空数据")

    per_page = len(diff)
    total = int(data_json["data"]["total"])
    total_page = max(1, math.ceil(total / per_page))

    frames = [pd.DataFrame(diff)]
    for page in range(2, total_page + 1):
        time.sleep(random.uniform(0.2, 0.6))
        page_params = {**params, "pn": page}
        page_json = _request_json(url, page_params, timeout=timeout)
        frames.append(pd.DataFrame(page_json["data"]["diff"]))

    temp_df = pd.concat(frames, ignore_index=True)
    if "f3" in temp_df.columns:
        temp_df["f3"] = pd.to_numeric(temp_df["f3"], errors="coerce")
        temp_df.sort_values(by=["f3"], ascending=False, inplace=True, ignore_index=True)
    temp_df.reset_index(inplace=True)
    temp_df["index"] = temp_df["index"].astype(int) + 1
    return temp_df


def fetch_industry_board_df() -> pd.DataFrame:
    params = {
        "pn": "1",
        "pz": "100",
        "po": "1",
        "np": "1",
        "ut": "bd1d9ddb04089700cf9c27f6f7426281",
        "fltt": "2",
        "invt": "2",
        "fid": "f3",
        "fs": "m:90 t:2 f:!50",
        "fields": (
            "f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,"
            "f23,f24,f25,f26,f22,f33,f11,f62,f128,f136,f115,f152,f124,f107,f104,f105,"
            "f140,f141,f207,f208,f209,f222"
        ),
    }
    temp_df = fetch_push2_paginated(params)
    temp_df.columns = [
        "排名",
        "-",
        "最新价",
        "涨跌幅",
        "涨跌额",
        "-",
        "_",
        "-",
        "换手率",
        "-",
        "-",
        "-",
        "板块代码",
        "-",
        "板块名称",
        "-",
        "-",
        "-",
        "-",
        "总市值",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "上涨家数",
        "下跌家数",
        "-",
        "-",
        "-",
        "领涨股票",
        "-",
        "-",
        "领涨股票-涨跌幅",
        "-",
        "-",
        "-",
        "-",
        "-",
    ]
    return _normalize_board_df(temp_df)


def fetch_concept_board_df() -> pd.DataFrame:
    params = {
        "pn": "1",
        "pz": "100",
        "po": "1",
        "np": "1",
        "ut": "bd1d9ddb04089700cf9c27f6f7426281",
        "fltt": "2",
        "invt": "2",
        "fid": "f12",
        "fs": "m:90 t:3 f:!50",
        "fields": "f2,f3,f4,f8,f12,f14,f15,f16,f17,f18,f20,f21,f24,f25,f22,f33,f11,f62,f128,f124,f107,f104,f105,f136",
    }
    temp_df = fetch_push2_paginated(params)
    temp_df.columns = [
        "排名",
        "最新价",
        "涨跌幅",
        "涨跌额",
        "换手率",
        "_",
        "板块代码",
        "板块名称",
        "_",
        "_",
        "_",
        "_",
        "总市值",
        "_",
        "_",
        "_",
        "_",
        "_",
        "_",
        "上涨家数",
        "下跌家数",
        "_",
        "_",
        "领涨股票",
        "_",
        "_",
        "领涨股票-涨跌幅",
    ]
    return _normalize_board_df(temp_df)


def _normalize_board_df(temp_df: pd.DataFrame) -> pd.DataFrame:
    temp_df = temp_df[
        [
            "排名",
            "板块名称",
            "板块代码",
            "最新价",
            "涨跌额",
            "涨跌幅",
            "总市值",
            "换手率",
            "上涨家数",
            "下跌家数",
            "领涨股票",
            "领涨股票-涨跌幅",
        ]
    ].copy()
    for col in (
        "最新价",
        "涨跌额",
        "涨跌幅",
        "总市值",
        "换手率",
        "上涨家数",
        "下跌家数",
        "领涨股票-涨跌幅",
    ):
        temp_df[col] = pd.to_numeric(temp_df[col], errors="coerce")
    return temp_df
