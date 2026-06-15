package com.fundhelper.portfolio

import com.google.gson.annotations.SerializedName

data class QrCreateResult(
    val id: String = "",
    val url: String = "",
)

data class QrStateResult(
    val state: String = "",
    val token: String? = null,
    val nickname: String? = null,
    val avatar: String? = null,
) {
    companion object {
        fun normalizeState(raw: Any?): String {
            if (raw == null) return ""
            val text = raw.toString().trim()
            text.toDoubleOrNull()?.toLong()?.let { return it.toString() }
            return text.removeSuffix(".0")
        }

        fun isLoginSuccess(state: String): Boolean = normalizeState(state) == "2"

        fun isExpired(state: String): Boolean = normalizeState(state) == "3"

        fun fromRaw(raw: Map<String, Any?>): QrStateResult = QrStateResult(
            state = normalizeState(raw["state"]),
            token = raw["token"]?.toString(),
            nickname = raw["nickname"]?.toString(),
            avatar = raw["avatar"]?.toString(),
        )
    }
}
