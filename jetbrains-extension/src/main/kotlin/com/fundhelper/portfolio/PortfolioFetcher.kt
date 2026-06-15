package com.fundhelper.portfolio

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import kotlin.math.abs
import kotlin.math.round

object NvInfo {
    private fun isPresent(value: Any?): Boolean =
        value != null && value != "" && value != "null"

    fun toFloat(value: Any?, fallback: Double = 0.0): Double {
        if (!isPresent(value)) return fallback
        return when (value) {
            is Number -> value.toDouble().takeIf { it.isFinite() } ?: fallback
            is String -> value.trim().replace("%", "").replace(",", "").toDoubleOrNull() ?: fallback
            else -> fallback
        }
    }

    fun pickFirstFloat(nv: Map<String, Any?>, keys: List<String>, fallback: Double = 0.0): Double {
        for (key in keys) {
            if (isPresent(nv[key])) {
                return toFloat(nv[key], fallback)
            }
        }
        return fallback
    }

    fun pickEstimateRate(nv: Map<String, Any?>): Double =
        pickFirstFloat(nv, listOf("gszzl", "zsgzzl", "vgszzl"))

    fun pickPublishedRate(nv: Map<String, Any?>): Double =
        pickFirstFloat(nv, listOf("jzzzl", "rzzl"))

    fun pickEstimateNav(nv: Map<String, Any?>): Double =
        pickFirstFloat(nv, listOf("gzjz", "zsgz", "gsz", "vgsz"))

    private fun localDateString(): String = LocalDate.now().toString()

    fun isNavDateToday(jzrq: Any?): Boolean {
        if (!isPresent(jzrq)) return false
        return jzrq.toString().take(10) == localDateString()
    }

    fun isNavPublishedToday(nv: Map<String, Any?>): Boolean {
        if (isPresent(nv["gszzl"])) return true
        val jzrq = nv["jzrq"] ?: nv["zxjzrq"] ?: nv["true_valuation_date"]
        return isNavDateToday(jzrq)
    }

    fun pickRateForDayEarn(nv: Map<String, Any?>): Double {
        val estimate = pickEstimateRate(nv)
        if (estimate != 0.0) return estimate
        return pickPublishedRate(nv)
    }

    fun calcFundDayEarnFromNv(money: Double, nv: Map<String, Any?>): Double {
        val rate = pickRateForDayEarn(nv)
        return round(money * rate / 100.0 * 100.0) / 100.0
    }

    data class NormalizedNv(
        val gszzl: Double,
        val jzzzl: Double,
        val dayRate: Double,
        val dwjz: Double,
        val gzjz: Double,
        val navUpdated: Boolean,
        val jzrq: String,
    )

    fun normalizeFundNvInfo(nv: Map<String, Any?>): NormalizedNv {
        val gszzl = pickEstimateRate(nv)
        val jzzzl = pickPublishedRate(nv)
        val dayRate = if (gszzl != 0.0) gszzl else jzzzl
        val navUpdated = isNavPublishedToday(nv)
        val jzrq = if (isPresent(nv["jzrq"])) nv["jzrq"].toString().take(10) else ""
        return NormalizedNv(
            gszzl = gszzl,
            jzzzl = jzzzl,
            dayRate = dayRate,
            dwjz = pickFirstFloat(nv, listOf("dwjz")),
            gzjz = pickEstimateNav(nv),
            navUpdated = navUpdated,
            jzrq = jzrq,
        )
    }
}

object TradingHours {
    fun isTradingHours(): Boolean {
        val now = LocalDateTime.now()
        if (now.dayOfWeek == DayOfWeek.SATURDAY || now.dayOfWeek == DayOfWeek.SUNDAY) {
            return false
        }
        val minutes = now.hour * 60 + now.minute
        return (minutes in 570..691) || (minutes in 810..901)
    }
}

object PortfolioFetcher {
    private val updatedAtFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")

    @Suppress("UNCHECKED_CAST")
    fun buildSnapshot(
        collect: Map<String, Any?>,
        fundsByAccount: Map<Int, List<Map<String, Any?>>>,
        indices: Map<String, Map<String, Any?>>,
    ): PortfolioSnapshot {
        val accountData = (collect["account_data"] as? List<Map<String, Any?>>) ?: emptyList()
        val accounts = mutableListOf<AccountItem>()
        val allFunds = mutableListOf<FundItem>()

        for (acc in accountData) {
            val accountId = NvInfo.toFloat(acc["account_id"]).toInt()
            val title = acc["title"]?.toString() ?: ""
            val funds = (fundsByAccount[accountId] ?: emptyList())
                .map { enrichFund(it, accountId, title) }
                .sortedByDescending { abs(it.dayEarn) }

            allFunds.addAll(funds)
            accounts.add(
                AccountItem(
                    accountId = accountId,
                    title = title,
                    todayIncome = NvInfo.toFloat(acc["today_income"]),
                    todayIncomeRate = NvInfo.toFloat(acc["today_income_rate"]),
                    holdIncome = NvInfo.toFloat(acc["hold_income"]),
                    accountAssets = NvInfo.toFloat(acc["account_assets"]),
                    up = NvInfo.toFloat(acc["up"]).toInt(),
                    down = NvInfo.toFloat(acc["down"]).toInt(),
                    funds = funds,
                ),
            )
        }

        val keyIndices = listOf("1.000001", "1.000300", "0.399001", "0.399006")
        val indexList = keyIndices.mapNotNull { code ->
            val item = indices[code] ?: return@mapNotNull null
            IndexItem(
                code = code,
                name = item["name"]?.toString(),
                v = item["v"]?.toString(),
                dir = normalizeIndexDir(
                    NvInfo.toFloat(item["dir"]),
                    NvInfo.toFloat(item["div"]),
                ),
            )
        }

        return PortfolioSnapshot(
            totalAssets = NvInfo.toFloat(collect["assets_collect"]),
            todayIncome = NvInfo.toFloat(collect["today_income"]),
            todayIncomeRate = NvInfo.toFloat(collect["today_income_rate"]),
            riseCount = accountData.sumOf { NvInfo.toFloat(it["up"]).toInt() },
            fallCount = accountData.sumOf { NvInfo.toFloat(it["down"]).toInt() },
            accounts = accounts,
            funds = allFunds.sortedByDescending { abs(it.dayEarn) },
            indices = indexList,
            updatedAt = LocalDateTime.now().format(updatedAtFormatter),
            trading = TradingHours.isTradingHours(),
        )
    }

    @Suppress("UNCHECKED_CAST")
    private fun enrichFund(
        fund: Map<String, Any?>,
        accountId: Int,
        accountTitle: String,
    ): FundItem {
        val nv = (fund["nv_info"] as? Map<String, Any?>) ?: emptyMap()
        val normalized = NvInfo.normalizeFundNvInfo(nv)
        return FundItem(
            id = NvInfo.toFloat(fund["id"]).takeIf { it != 0.0 },
            code = fund["code"]?.toString() ?: "",
            shortName = fund["short_name"]?.toString() ?: "",
            money = NvInfo.toFloat(fund["money"]),
            holdSum = NvInfo.toFloat(fund["hold_sum"] ?: fund["money"]),
            holdEarn = NvInfo.toFloat(fund["hold_earn"]),
            dayEarn = NvInfo.calcFundDayEarnFromNv(NvInfo.toFloat(fund["money"]), nv),
            dayRate = normalized.dayRate,
            accountId = accountId,
            accountTitle = accountTitle,
            nvInfo = FundNvInfo(
                dwjz = normalized.dwjz,
                gzjz = normalized.gzjz,
                gszzl = normalized.gszzl,
                jzzzl = normalized.jzzzl,
                navUpdated = normalized.navUpdated,
                jzrq = normalized.jzrq.ifEmpty { null },
            ),
        )
    }

    private fun normalizeIndexDir(dirVal: Double, divVal: Double): Double {
        if (dirVal == 0.0) return 0.0
        val absDir = abs(dirVal)
        return when {
            divVal > 0 -> absDir
            divVal < 0 -> -absDir
            else -> dirVal
        }
    }
}
