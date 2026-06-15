package com.fundhelper.yjb

import com.fundhelper.portfolio.QrCreateResult
import com.fundhelper.portfolio.QrStateResult
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.security.MessageDigest
import java.time.Duration

class YjbClient {
    private val gson = Gson()
    private val http = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(15))
        .build()

    fun getQrcode(): QrCreateResult = request("GET", "/qr_code")

    fun getQrcodeState(qrId: String): QrStateResult =
        request("GET", "/qr_code_state/$qrId")

    fun getCollect(token: String): Map<String, Any?> =
        request("GET", "/account_collect", token = token)

    fun getFunds(token: String, accountId: Int): List<Map<String, Any?>> =
        request("GET", "/fund_hold", token = token, params = mapOf("account_id" to accountId.toString()))

    fun getIndex(token: String = ""): Map<String, Map<String, Any?>> =
        request("GET", "/index_data", token = token)

    @Suppress("UNCHECKED_CAST")
    private inline fun <reified T> request(
        method: String,
        path: String,
        token: String = "",
        params: Map<String, String> = emptyMap(),
    ): T {
        val timestamp = System.currentTimeMillis() / 1000
        val query = if (params.isEmpty()) {
            ""
        } else {
            "?" + params.entries.joinToString("&") { "${it.key}=${it.value}" }
        }
        val url = "$BASE_URL$path$query"

        val requestBuilder = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(Duration.ofSeconds(30))
            .header("Content-Type", "application/json")
            .header("Authorization", token)
            .header("Request-Time", timestamp.toString())
            .header("Request-Sign", sign(path, token, timestamp))

        val request = when (method) {
            "GET" -> requestBuilder.GET().build()
            else -> requestBuilder.method(method, HttpRequest.BodyPublishers.noBody()).build()
        }

        val response = http.send(request, HttpResponse.BodyHandlers.ofString())

        if (response.statusCode() == 401) {
            throw YjbApiException("Token 已失效，请重新登录", 401)
        }
        if (response.statusCode() == 429) {
            throw YjbApiException("请求频繁，请稍后再试", 429)
        }

        val mapType = object : TypeToken<Map<String, Any?>>() {}.type
        val payload: Map<String, Any?> = try {
            gson.fromJson(response.body(), mapType)
        } catch (_: Exception) {
            throw YjbApiException("响应解析失败: ${response.statusCode()}")
        }

        val code = (payload["code"] as? Number)?.toInt()
            ?: payload["code"]?.toString()?.toIntOrNull()
        if (code != 200) {
            val message = payload["message"]?.toString() ?: payload.toString()
            if (TOKEN_PATTERN.containsMatchIn(message)) {
                throw YjbApiException(message, 401)
            }
            throw YjbApiException(message, response.statusCode())
        }

        val data = payload["data"]
        return when (T::class) {
            QrCreateResult::class -> gson.fromJson(gson.toJson(data), QrCreateResult::class.java) as T
            QrStateResult::class -> {
                @Suppress("UNCHECKED_CAST")
                val raw = data as? Map<String, Any?> ?: emptyMap()
                QrStateResult.fromRaw(raw) as T
            }
            else -> when (data) {
                is Map<*, *> -> data as T
                is List<*> -> data as T
                else -> gson.fromJson(gson.toJson(data), object : TypeToken<T>() {}.type)
            }
        }
    }

    private fun sign(path: String, token: String, timestamp: Long): String {
        val input = "$path$token$timestamp$API_SECRET"
        val digest = MessageDigest.getInstance("MD5")
        return digest.digest(input.toByteArray()).joinToString("") { "%02x".format(it) }
    }

    companion object {
        private const val BASE_URL = "http://browser-plug-api.yangjibao.com"
        private const val API_SECRET = "YxmKSrQR4uoJ5lOoWIhcbd7SlUEh9OOc"
        private val TOKEN_PATTERN = Regex("token|登录|授权", RegexOption.IGNORE_CASE)
    }
}
