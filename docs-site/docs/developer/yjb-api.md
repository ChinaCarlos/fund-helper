---
title: 养基宝 API
---

> 逆向自 `yjb-plugin v1.1.4`，服务端：`http://browser-plug-api.yangjibao.com`

## 通用约定

### Base URL

```
http://browser-plug-api.yangjibao.com
```

### 请求头

| Header          | 必填 | 说明                             |
| --------------- | ---- | -------------------------------- |
| `Content-Type`  | 是   | 固定 `application/json`          |
| `Authorization` | 否   | 登录后的 token；未登录传空字符串 |
| `Request-Time`  | 是   | Unix 时间戳（秒）                |
| `Request-Sign`  | 是   | MD5 签名，见下文                 |

### 签名算法

```python
import hashlib

API_SECRET = "YxmKSrQR4uoJ5lOoWIhcbd7SlUEh9OOc"
BASE_PATHNAME = ""  # base URL 的 pathname 为 "/" 时取空串

def sign(url_path: str, token: str, timestamp: int) -> str:
    """
    url_path: 不含 query string 的路径，如 "/fund_hold"
    token: Authorization 值，未登录为 ""
    """
    raw = f"{BASE_PATHNAME}{url_path}{token}{timestamp}{API_SECRET}"
    return hashlib.md5(raw.encode()).hexdigest()
```

**示例：**

```
GET /index_data, token="", ts=1700000000
→ md5("" + "/index_data" + "" + "1700000000" + "YxmKSrQR4uoJ5lOoWIhcbd7SlUEh9OOc")
→ "a1b2c3..." (32位小写 hex)
```

### 响应格式

```json
{
  "code": 200,
  "data": { ... },
  "message": "ok"
}
```

| code  | 含义                       |
| ----- | -------------------------- |
| `200` | 成功，`data` 为业务数据    |
| 其他  | 失败，`message` 为错误描述 |

### HTTP 状态码

| status | 插件侧处理           |
| ------ | -------------------- |
| `200`  | 正常解析 body.code   |
| `408`  | 请求超时             |
| `429`  | 请求频繁，请稍后再试 |

### 鉴权说明

- 公开接口（无需 token）：`/index_data`、`/qr_code`、`/qr_code_state/*`、`/notice`、`/version_info`
- 需登录接口：其余所有接口，`Authorization` 传登录获得的 token

---

## 接口列表

### 1. 版本检查

```
GET /version_info?version={plugin_version}
```

**参数：**

| 参数      | 位置  | 类型   | 说明                   |
| --------- | ----- | ------ | ---------------------- |
| `version` | query | string | 插件版本号，如 `1.1.4` |

**响应 `data`：**

```json
{
  "version": "1.1.5",
  "is_constraint": false,
  "download_url": "https://...",
  "desc": "更新说明"
}
```

| 字段            | 类型    | 说明                                           |
| --------------- | ------- | ---------------------------------------------- |
| `version`       | string  | 服务端最新版本                                 |
| `is_constraint` | boolean | `true` 时强制更新，插件会标记 `expiredVersion` |
| `download_url`  | string? | 下载地址                                       |
| `desc`          | string? | 更新描述                                       |

---

### 2. 大盘指数

```
GET /index_data
```

**无需 token**

**响应 `data`：** 以指数代码为 key 的对象

```json
{
  "1.000001": {
    "code": "1.000001",
    "show_code": "000001",
    "name": "上证指数",
    "v": "4031.51",
    "dir": "1.12",
    "div": "44.5",
    "m": "1537401519424.7",
    "uc": "1700",
    "dc": "622",
    "nc": "30",
    "date": "2026-06-12 16:30:03"
  },
  "1.000300": { "code": "1.000300", "v": "...", "dir": "...", "div": "..." },
  "0.399001": { "code": "0.399001", "v": "...", "dir": "...", "div": "..." },
  "0.399006": { "code": "0.399006", "v": "...", "dir": "...", "div": "..." },
  "1.000016": { "code": "1.000016", "v": "...", "dir": "...", "div": "..." }
}
```

| 字段        | 类型          | 说明                   |
| ----------- | ------------- | ---------------------- |
| `code`      | string        | 指数代码（带市场前缀） |
| `show_code` | string        | 展示用代码             |
| `name`      | string        | 指数名称               |
| `v`         | string/number | 当前点位               |
| `dir`       | string/number | 涨跌幅（%）            |
| `div`       | string/number | 涨跌点数               |
| `m`         | string/number | 成交额                 |
| `uc`        | string/number | 上涨家数               |
| `dc`        | string/number | 下跌家数               |
| `nc`        | string/number | 平盘家数               |
| `date`      | string        | 行情时间               |

插件关注的指数代码：

| 代码       | 名称     |
| ---------- | -------- |
| `1.000001` | 上证指数 |
| `1.000300` | 沪深300  |
| `0.399001` | 深证成指 |
| `0.399006` | 创业板指 |
| `1.000016` | 上证50   |

---

### 3. 获取登录二维码

```
GET /qr_code
```

**无需 token**

**响应 `data`：**

```json
{
  "id": "abc123def456",
  "url": "https://wx.yangjibao.com/..."
}
```

| 字段  | 类型   | 说明                        |
| ----- | ------ | --------------------------- |
| `id`  | string | 二维码会话 ID，用于轮询状态 |
| `url` | string | 二维码图片 URL              |

---

### 4. 轮询扫码状态

```
GET /qr_code_state/{qr_id}
```

**无需 token**

**路径参数：**

| 参数    | 类型   | 说明                   |
| ------- | ------ | ---------------------- |
| `qr_id` | string | `/qr_code` 返回的 `id` |

**响应 `data`：**

```json
{
  "state": "2",
  "token": "eyJhbGciOi...",
  "avatar": "https://...",
  "nickname": "用户昵称"
}
```

| `state` | 含义                                         |
| ------- | -------------------------------------------- |
| `"1"`   | 等待扫码（插件每 2s 轮询，最长 4 分钟）      |
| `"2"`   | 登录成功，返回 `token`、`avatar`、`nickname` |
| `"3"`   | 二维码已失效                                 |

---

### 5. 账户列表

```
GET /user_account
GET /user_account?from=check_plug_target_account
```

**需 token**

**参数：**

| 参数   | 位置  | 类型   | 说明                                                  |
| ------ | ----- | ------ | ----------------------------------------------------- |
| `from` | query | string | 传 `check_plug_target_account` 时服务端会返回推荐账户 |

**响应 `data`：**

```json
{
  "is_single_account_model": true,
  "target_account_id": 12345,
  "list": [
    {
      "id": 12345,
      "title": "我的基金",
      "type": 1
    }
  ]
}
```

| 字段                      | 类型    | 说明            |
| ------------------------- | ------- | --------------- |
| `is_single_account_model` | boolean | 是否单账户模式  |
| `target_account_id`       | number? | 推荐默认账户 ID |
| `list`                    | array   | 账户列表        |
| `list[].id`               | number  | 账户 ID         |
| `list[].title`            | string  | 账户名称        |

---

### 6. 多账户汇总

```
GET /account_collect
```

**需 token**

**响应 `data`：**

```json
{
  "is_single_account_model": false,
  "today_income": "123.45",
  "today_income_rate": "0.52",
  "assets_collect": "100000.00",
  "index_data": { "1.000001": { "code": "...", "dir": "..." } },
  "account_data": [
    {
      "account_id": 12345,
      "title": "我的基金",
      "today_income": "50.00",
      "today_income_rate": "0.30",
      "hold_income": "5000.00",
      "hold_cost": "80000.00",
      "up": 5,
      "down": 3
    }
  ]
}
```

| 字段                         | 类型          | 说明              |
| ---------------------------- | ------------- | ----------------- |
| `today_income`               | string/number | 总当日收益（元）  |
| `today_income_rate`          | string/number | 总当日收益率（%） |
| `assets_collect`             | string/number | 总资产            |
| `account_data`               | array         | 各子账户明细      |
| `account_data[].up`          | number        | 上涨基金数        |
| `account_data[].down`        | number        | 下跌基金数        |
| `account_data[].hold_income` | number        | 持有收益          |
| `account_data[].hold_cost`   | number        | 持有成本          |

---

### 7. 持仓基金列表

```
GET /fund_hold?account_id={account_id}
```

**需 token**

**参数：**

| 参数         | 位置  | 类型   | 说明    |
| ------------ | ----- | ------ | ------- |
| `account_id` | query | number | 账户 ID |

**响应 `data`：** 基金数组

```json
[
  {
    "id": 1,
    "fund_id": 1001,
    "code": "161725",
    "short_name": "招商中证白酒指数",
    "money": "10000.00",
    "hold_share": "5000.0000",
    "hold_cost": "1.8500",
    "hold_sum": "9250.00",
    "is_fuzzy": false,
    "has_aip": 0,
    "has_up_down_remid": 0,
    "fh_amount": "0.00",
    "nv_info": {
      "dwjz": "1.7699",
      "rzzl": "-0.12",
      "jzrq": "2026-06-12",
      "gszzl": "",
      "zsgzzl": "",
      "vgszzl": "6.07",
      "vgsz": "1.8773",
      "gzjz": "1.9350",
      "zsgz": "1.9841",
      "gsz": "2.0210",
      "gztime": "2026-06-15 19:35:45",
      "time": "2026-06-15 19:35:45"
    }
  }
]
```

> **说明（2026-06 实测）**：`gszzl` / `zsgzzl` 可能为**空字符串**（尤其 QDII、港股 `market_type: ch_hk` 或净值未当日更新时），此时估算涨跌幅在 **`vgszzl`**，估算净值在 **`vgsz`**。客户端需按下方优先级归一化，不可仅读 `gszzl`。

| 字段                | 类型    | 说明                            |
| ------------------- | ------- | ------------------------------- |
| `fund_id`           | number  | 持仓记录 ID（删除时用）         |
| `code`              | string  | 基金代码                        |
| `short_name`        | string  | 基金简称                        |
| `market_type`       | string  | 市场类型，如 `ch_hk`（港股/QDII） |
| `hold_share`        | string  | 持有份额                        |
| `hold_cost`         | string  | 持有成本（单价）                |
| `hold_sum`          | string  | 持有金额                        |
| `is_fuzzy`          | boolean | 是否模糊持仓（份额/成本未完善） |
| `has_aip`           | number  | 是否有定投 (-1=无)              |
| `has_up_down_remid` | number  | 是否有涨跌提醒                  |
| `fh_amount`         | string  | 分红金额                        |

**`nv_info` 净值/估值字段（API 原始）：**

| 字段 | 类型 | 说明 |
| ---- | ---- | ---- |
| `nv_info.dwjz` | string | 单位净值（已公布） |
| `nv_info.jzzzl` | string | 净值涨跌幅 %（已公布，同 `rzzl` 语义） |
| `nv_info.rzzl` | string | 日涨跌幅 %（已公布，常与 `jzzzl` 相同） |
| `nv_info.jzrq` | string | 净值日期 |
| `nv_info.gszzl` | string | 估算涨跌幅 %（**可能为空**） |
| `nv_info.zsgzzl` | string | 指数/备用估算涨跌幅 %（**可能为空**） |
| `nv_info.vgszzl` | string | 估值涨跌幅 %（QDII/港股等常仅在此字段有值） |
| `nv_info.gzjz` | string | 估值净值 |
| `nv_info.zsgz` | string | 备用估值净值 |
| `nv_info.gsz` | string | 估算净值（与估值净值同义，部分基金有值） |
| `nv_info.vgsz` | string | 估值净值（与 `vgszzl` 配套） |
| `nv_info.gztime` | string | 估值时间 |
| `nv_info.time` | string | 数据更新时间 |

**客户端归一化规则（各端 `nvInfo` / `calculator.py` / `portfolio.rs` 统一）：**

| 归一化字段 | 读取优先级（取第一个非空值） | 用途 |
| ---------- | ---------------------------- | ---- |
| 估算涨跌幅 `gszzl` | `gszzl` → `zsgzzl` → `vgszzl` | 交易时段「预估涨幅」、排序 |
| 公布涨跌幅 `jzzzl` | `jzzzl` → `rzzl` | 非交易时段涨幅、估算缺失时回退 |
| 估算净值 `gzjz` | `gzjz` → `zsgz` → `gsz` → `vgsz` | 估值净值展示 |
| 展示/排序 `day_rate` | 估算涨跌幅非 0 则用估算，否则用公布 | 列表涨幅列 |
| 当日预估收益 `day_earn` | `money × rate / 100`，`rate` 同估算链，缺失时回退公布 | 当日收益 |

**插件计算的衍生字段（客户端计算，非 API 返回）：**

| 字段               | 说明           |
| ------------------ | -------------- |
| `content.day_earn` | 当日预估收益   |
| `content.day_rate` | 当日预估收益率 |
| `content.hold_sum` | 当前市值       |

---

### 8. 收益信息（击败基民）

```
GET /income_data?account_id={account_id}
GET /income_data?collect=true
```

**需 token**

**参数：**

| 参数         | 位置  | 类型    | 说明                       |
| ------------ | ----- | ------- | -------------------------- |
| `account_id` | query | number  | 单账户模式                 |
| `collect`    | query | boolean | 传 `true` 时获取多账户汇总 |

**响应 `data`：** 字符串或数字，表示「当日击败基民百分比」

```json
"68.5"
```

---

### 9. 收益曲线

返回**当日交易时段**的分时收益率曲线（分钟级），不是多日历史净值曲线。

```
GET /income_line_data?date_type=day&collect=true
GET /income_line_data?date_type=day&account_id={id}&collect=false
GET /income_line_data?date_type=day&account_ids[]={id1}&account_ids[]={id2}
```

**需 token**

**参数：**

| 参数            | 位置  | 类型     | 说明                                                |
| --------------- | ----- | -------- | --------------------------------------------------- |
| `date_type`     | query | string   | 固定 `day`（实测 `week`/`month`/`year` 返回 400）   |
| `collect`       | query | string   | 传 `true` 时请求汇总曲线                            |
| `account_id`    | query | number   | 单账户 ID，**须与 `collect=false` 同传**            |
| `account_ids[]` | query | number[] | 一个或多个账户 ID，**推荐**，可一次拿各分组独立曲线 |

**分组与调用方式（实测 2026-06-12，browser-plug-api）：**

| 调用方式                                      | 响应 key     | 各分组曲线是否不同 | 说明                                                                |
| --------------------------------------------- | ------------ | ------------------ | ------------------------------------------------------------------- |
| `collect=true`                                | 仅 `collect` | —                  | 返回一条汇总分时曲线                                                |
| `account_id={id}&collect=false`               | 仅 `collect` | **否**             | 传不同 `account_id` 仍返回同一条 `collect` 曲线，**无法按账户区分** |
| `account_ids[]={id}`（单个）                  | `{id}`       | 是                 | 返回该账户独立曲线                                                  |
| `account_ids[]={id1}&account_ids[]={id2}&...` | 各 `{id}`    | **是**             | 一次请求，按账户 ID 分 key，曲线两两不同                            |

> **重要：** 仅传 `account_id` 不传 `collect` 会返回 `400`（「必要参数缺失或非法」）。插件 popup 使用 `?account_id=…` 或 `?collect=true`，与「按账户拿独立曲线」的需求不完全一致；若需多账户各自曲线，应使用 `account_ids[]`。

**推荐请求示例（多账户独立曲线）：**

```
GET /income_line_data?date_type=day&account_ids[]=27665442&account_ids[]=29444903&account_ids[]=29444905
```

**响应 `data`（`account_ids[]` 模式）：** 以账户 ID 字符串为 key

```json
{
  "27665442": {
    "today_income": null,
    "line_list": [
      { "time": "09:30:00", "rate": 2.25 },
      { "time": "09:31:00", "rate": 2.14 },
      { "time": "15:00:00", "rate": 0.67 }
    ]
  },
  "29444903": {
    "line_list": [
      { "time": "09:30:00", "rate": 2.18 },
      { "time": "15:00:00", "rate": 1.12 }
    ]
  }
}
```

**响应 `data`（`collect=true` 或 `account_id+collect=false` 模式）：** 固定 key 为 `collect`

```json
{
  "collect": {
    "today_income": null,
    "line_list": [
      { "time": "09:30:00", "rate": 2.25 },
      { "time": "15:00:00", "rate": 0.6 }
    ]
  }
}
```

| 字段               | 类型               | 说明                                                     |
| ------------------ | ------------------ | -------------------------------------------------------- |
| `today_income`     | string/number/null | 当日收益（实测常为 `null`，应以 `account_collect` 为准） |
| `line_list`        | array              | 当日分时收益率曲线，通常 **242** 个点                    |
| `line_list[].time` | string             | 时刻 `HH:MM:SS`（09:30–11:30、13:00–15:00，午休无点）    |
| `line_list[].rate` | number/string      | 截至该时刻的累计收益率（%）                              |
| `line_list[].date` | string             | 旧版/文档字段，当前 plug API 响应以 `time` 为主          |

**曲线形态：**

- 上午 09:30–11:30：121 个点（每分钟）
- 下午 13:00–15:00：121 个点
- 11:30→13:00 午休断开，无数据点

**与 `account_collect` 的对照（同一 token 实测）：**

各账户当日 `today_income_rate` 不同，但 `collect=true` 返回的 `collect` 曲线与各账户 `account_ids[]` 曲线均不一致；`account_ids[]` 末点 rate 与各账户当日收益率方向一致（例如蛋卷账户当日为负，曲线末点低于支付宝/天天基金）。

| 账户           | `account_collect` 当日收益率 | `account_ids[]` 曲线末点 rate |
| -------------- | ---------------------------- | ----------------------------- |
| 支付宝         | +0.30%                       | +0.67%                        |
| 天天基金       | +0.70%                       | +1.12%                        |
| 蛋卷基金       | -0.08%                       | +0.23%                        |
| `collect=true` | 合计 +0.25%                  | +0.60%（单条汇总曲线）        |

**客户端解析建议：**

```python
# 按 account_ids[] 拉取后取单账户块
block = data.get(str(account_id)) or data.get(account_id)

# collect / account_id+collect=false 模式
block = data.get("collect")

# 统一映射为 { label: time, rate }
for item in block.get("line_list", []):
    label = item.get("time") or item.get("date") or ""
    rate = float(item.get("rate") or 0)
```

**分组边界说明：** 收益曲线按**投资账户**（支付宝 / 天天基金 / 蛋卷等）分组，与自选分组（`group_ids`、`/group_funds`）无关。

---

### 10. 搜索基金

```
GET /search_fund?keyword={keyword}
GET /search_fund?keyword={keyword}&account_id={account_id}
```

**需 token**

**参数：**

| 参数         | 位置  | 类型   | 说明                     |
| ------------ | ----- | ------ | ------------------------ |
| `keyword`    | query | string | 搜索关键词（代码或名称） |
| `account_id` | query | number | 可选，用于标记已持有     |

**响应 `data`：** 基金数组

```json
[
  {
    "id": 1001,
    "code": "161725",
    "short_name": "招商中证白酒指数",
    "is_hold": false
  }
]
```

---

### 11. 添加/更新持仓

```
POST /fund_hold
```

**需 token**

**请求体：**

```json
{
  "account_id": 12345,
  "sync_optional": 0,
  "items": [
    {
      "fund_id": 1001,
      "fund_code": "161725",
      "hold_share": "5000.0000",
      "hold_cost": "1.8500",
      "model": 1
    }
  ]
}
```

| 字段                 | 类型   | 说明                                 |
| -------------------- | ------ | ------------------------------------ |
| `account_id`         | number | 目标账户                             |
| `sync_optional`      | number | 是否同步自选，固定 `0`               |
| `items`              | array  | 基金列表                             |
| `items[].fund_id`    | number | 基金 ID（新添加用搜索结果中的 `id`） |
| `items[].fund_code`  | string | 基金代码                             |
| `items[].hold_share` | string | 持有份额（最多 4 位小数）            |
| `items[].hold_cost`  | string | 持有成本（最多 4 位小数）            |
| `items[].model`      | number | 固定 `1`                             |

**响应 `data`：** 操作结果（插件不解析具体字段，成功后刷新列表）

---

### 12. 删除持仓

```
DELETE /remove_fund_hold?fund_ids[]={id}&fund_ids[]={id}&account_id={account_id}
```

**需 token**

**参数：**

| 参数         | 位置  | 类型     | 说明                       |
| ------------ | ----- | -------- | -------------------------- |
| `fund_ids[]` | query | number[] | 要删除的 `fund_id`，可多个 |
| `account_id` | query | number   | 账户 ID                    |

**响应 `data`：** 操作结果

---

### 13. 公告

```
GET /notice
```

**无需 token**

**响应 `data`：**

```json
{
  "id": 1,
  "code": "notice_abc",
  "title": "公告标题",
  "content": "公告内容",
  "link": "https://..."
}
```

| 字段      | 类型    | 说明                              |
| --------- | ------- | --------------------------------- |
| `id`      | number  | 公告 ID                           |
| `code`    | string  | 跳转 code，用于 `redirect/{code}` |
| `title`   | string? | 标题                              |
| `content` | string? | 内容                              |

点击详情跳转：`http://browser-plug-api.yangjibao.com/redirect/{code}`

---

## 插件内部消息协议

popup 通过 `chrome.runtime.sendMessage` 与 background 通信：

```javascript
// 请求
{ type: "fundData", param: 12345, id: false, tip: false }

// 响应
{ type: "fundData", data: [...] }

// 错误
{ type: "error", url_desc: "请求基金列表", data: "错误信息" }
```

| type               | param               | id           | 说明             |
| ------------------ | ------------------- | ------------ | ---------------- |
| `updateData`       | version             | -            | 版本检查         |
| `indexData`        | -                   | -            | 大盘指数         |
| `qrcode`           | -                   | -            | 获取二维码       |
| `scannerCodeState` | qr_id               | -            | 轮询扫码         |
| `accountList`      | truthy→加query      | -            | 账户列表         |
| `accountCollect`   | -                   | -            | 多账户汇总       |
| `fundData`         | account_id          | -            | 持仓列表         |
| `incomeData`       | account_id          | `"all"`→汇总 | 击败基民         |
| `incomeLineData`   | query string        | -            | 收益曲线         |
| `fundSearch`       | keyword             | account_id   | 搜索基金         |
| `addFund`          | POST body           | -            | 添加基金         |
| `removeFund`       | query string        | -            | 删除基金         |
| `noticeBar`        | -                   | -            | 公告             |
| `openInterval`     | -                   | -            | 开启角标轮询     |
| `closeInterval`    | -                   | -            | 关闭角标轮询     |
| `getBadgeData`     | -                   | -            | 刷新角标         |
| `hiddenBadgeData`  | -                   | -            | 隐藏角标         |
| `updateEarnData`   | `{earn, earn_rate}` | -            | 本地更新角标     |
| `chooseShowBadge`  | 0或1                | -            | 切换角标显示模式 |

---

## 限流与时段

- 交易时段（工作日 9:30–11:31, 13:30–15:01）：
  - 指数：每 10s 刷新
  - 角标/汇总：每 30s 刷新
  - 击败基民：每 60s 刷新
- HTTP 429：请求频繁
