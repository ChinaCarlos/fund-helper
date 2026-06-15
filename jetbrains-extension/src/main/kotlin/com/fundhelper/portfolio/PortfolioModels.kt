package com.fundhelper.portfolio

import com.google.gson.annotations.SerializedName

data class FundNvInfo(
    val dwjz: Double = 0.0,
    val gzjz: Double = 0.0,
    val gszzl: Double = 0.0,
    val jzzzl: Double = 0.0,
    @SerializedName("nav_updated") val navUpdated: Boolean = false,
    val jzrq: String? = null,
)

data class FundItem(
    val id: Double? = null,
    val code: String = "",
    @SerializedName("short_name") val shortName: String = "",
    val money: Double = 0.0,
    @SerializedName("hold_sum") val holdSum: Double = 0.0,
    @SerializedName("hold_earn") val holdEarn: Double = 0.0,
    @SerializedName("day_earn") val dayEarn: Double = 0.0,
    @SerializedName("day_rate") val dayRate: Double = 0.0,
    @SerializedName("account_id") val accountId: Int? = null,
    @SerializedName("account_title") val accountTitle: String? = null,
    @SerializedName("nv_info") val nvInfo: FundNvInfo? = null,
)

data class AccountItem(
    @SerializedName("account_id") val accountId: Int = 0,
    val title: String = "",
    @SerializedName("today_income") val todayIncome: Double = 0.0,
    @SerializedName("today_income_rate") val todayIncomeRate: Double = 0.0,
    @SerializedName("hold_income") val holdIncome: Double = 0.0,
    @SerializedName("account_assets") val accountAssets: Double = 0.0,
    val up: Int = 0,
    val down: Int = 0,
    val funds: List<FundItem> = emptyList(),
)

data class IndexItem(
    val code: String = "",
    val name: String? = null,
    val v: String? = null,
    val dir: Double = 0.0,
)

data class PortfolioSnapshot(
    @SerializedName("total_assets") val totalAssets: Double = 0.0,
    @SerializedName("today_income") val todayIncome: Double = 0.0,
    @SerializedName("today_income_rate") val todayIncomeRate: Double = 0.0,
    @SerializedName("rise_count") val riseCount: Int = 0,
    @SerializedName("fall_count") val fallCount: Int = 0,
    val accounts: List<AccountItem> = emptyList(),
    val funds: List<FundItem> = emptyList(),
    val indices: List<IndexItem> = emptyList(),
    @SerializedName("updated_at") val updatedAt: String = "",
    val trading: Boolean = false,
)

data class YjbSession(
    val token: String = "",
    val nickname: String = "",
    val avatar: String = "",
    @SerializedName("login_time") val loginTime: String = "",
)
