package com.fundhelper.yjb

class YjbApiException(
    message: String,
    val statusCode: Int? = null,
) : Exception(message)
