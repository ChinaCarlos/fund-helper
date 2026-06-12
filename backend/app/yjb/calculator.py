from __future__ import annotations

from typing import Any


def _normalize_index_dir(dir_val: float, div_val: float) -> float:
    """涨跌幅 dir 有时为绝对值，用涨跌点数 div 的符号校正。"""
    if dir_val == 0:
        return 0.0
    abs_dir = abs(dir_val)
    if div_val > 0:
        return abs_dir
    if div_val < 0:
        return -abs_dir
    return dir_val


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def calc_fund_day_earn(fund: dict) -> float:
    """根据市值和估算涨跌幅计算当日预估收益。"""
    money = _to_float(fund.get("money"))
    nv = fund.get("nv_info") or {}
    rate = _to_float(nv.get("gszzl") or nv.get("rzzl") or nv.get("zsgzzl"))
    return round(money * rate / 100, 2)


def enrich_fund(
    fund: dict,
    *,
    account_id: int | None = None,
    account_title: str | None = None,
) -> dict:
    nv = fund.get("nv_info") or {}
    gszzl = _to_float(nv.get("gszzl") or nv.get("zsgzzl"))
    jzzzl = _to_float(nv.get("jzzzl") or nv.get("rzzl"))
    gzjz = _to_float(nv.get("gzjz") or nv.get("zsgz") or nv.get("gsz"))
    day_rate = gszzl or jzzzl
    day_earn = calc_fund_day_earn(fund)
    hold_sum = _to_float(fund.get("hold_sum") or fund.get("money"))

    return {
        "id": fund.get("id"),
        "fund_id": fund.get("fund_id"),
        "account_id": account_id,
        "account_title": account_title,
        "code": fund.get("code"),
        "short_name": fund.get("short_name"),
        "money": _to_float(fund.get("money")),
        "hold_sum": hold_sum,
        "hold_earn": _to_float(fund.get("hold_earn")),
        "hold_share": _to_float(fund.get("hold_share")),
        "hold_cost": _to_float(fund.get("hold_cost")),
        "is_fuzzy": bool(fund.get("is_fuzzy")),
        "has_aip": fund.get("has_aip", -1),
        "has_up_down_remid": fund.get("has_up_down_remid", 0),
        "fh_amount": _to_float(fund.get("fh_amount")),
        "day_earn": day_earn,
        "day_rate": day_rate,
        "nv_time": nv.get("time") or nv.get("gztime"),
        "nv_info": {
            "dwjz": _to_float(nv.get("dwjz")),
            "gzjz": gzjz,
            "gsz": _to_float(nv.get("gsz") or nv.get("zsgz")),
            "gszzl": gszzl,
            "jzzzl": jzzzl,
            "jzrq": nv.get("jzrq") or "",
            "gztime": nv.get("gztime") or nv.get("time") or "",
        },
        "sector": (fund.get("sector_info") or {}).get("name"),
    }


def build_portfolio_snapshot(
    *,
    collect: dict,
    funds_by_account: dict[int, list[dict]],
    indices: dict | None = None,
) -> dict:
    accounts = []
    all_funds: list[dict] = []

    for acc in collect.get("account_data", []):
        account_id = acc.get("account_id")
        funds = [
            enrich_fund(
                f,
                account_id=account_id,
                account_title=acc.get("title"),
            )
            for f in funds_by_account.get(account_id, [])
        ]
        funds.sort(key=lambda x: abs(x["day_earn"]), reverse=True)
        all_funds.extend(funds)
        accounts.append(
            {
                "account_id": account_id,
                "title": acc.get("title"),
                "today_income": _to_float(acc.get("today_income")),
                "today_income_rate": _to_float(acc.get("today_income_rate")),
                "hold_income": _to_float(acc.get("hold_income")),
                "hold_income_rate": _to_float(acc.get("hold_income_rate")),
                "account_assets": _to_float(acc.get("account_assets")),
                "up": acc.get("up", 0),
                "down": acc.get("down", 0),
                "funds": funds,
            }
        )

    key_indices = ["1.000001", "1.000300", "0.399001", "0.399006"]
    index_list = []
    if indices:
        for code in key_indices:
            item = indices.get(code)
            if item:
                dir_val = _to_float(item.get("dir"))
                div_val = _to_float(item.get("div"))
                index_list.append(
                    {
                        "code": code,
                        "name": item.get("name"),
                        "v": item.get("v"),
                        "dir": _normalize_index_dir(dir_val, div_val),
                    }
                )

    return {
        "total_assets": _to_float(collect.get("assets_collect")),
        "today_income": _to_float(collect.get("today_income")),
        "today_income_rate": _to_float(collect.get("today_income_rate")),
        "rise_count": sum(a.get("up", 0) for a in collect.get("account_data", [])),
        "fall_count": sum(a.get("down", 0) for a in collect.get("account_data", [])),
        "accounts": accounts,
        "funds": sorted(all_funds, key=lambda x: abs(x["day_earn"]), reverse=True),
        "indices": index_list,
    }


def normalize_income_line(data: dict, *, account_id: int | None = None) -> dict:
    block = None
    if account_id is not None:
        block = data.get(str(account_id)) or data.get(account_id)
        if block is None:
            block = {}
    elif data.get("collect"):
        block = data.get("collect")
    elif len(data) == 1:
        block = next(iter(data.values()))
    else:
        block = data.get("collect") or {}
    if not isinstance(block, dict):
        block = {}

    points = []
    for item in block.get("line_list", []):
        label = item.get("time") or item.get("date") or ""
        points.append({"label": label, "rate": _to_float(item.get("rate"))})

    return {
        "account_id": account_id,
        "day": block.get("day") or "",
        "today_income": _to_float(block.get("today_income")),
        "points": points,
    }


def normalize_income_lines(
    data: dict, *, account_ids: list[int]
) -> dict[str, dict]:
    result: dict[str, dict] = {}
    for account_id in account_ids:
        result[str(account_id)] = normalize_income_line(
            data, account_id=account_id
        )
    return result
