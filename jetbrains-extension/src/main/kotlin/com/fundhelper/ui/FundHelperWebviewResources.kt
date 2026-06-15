package com.fundhelper.ui

import com.intellij.openapi.Disposable
import com.fundhelper.ui.jcef.FundHelperLocalRequestHandler
import com.fundhelper.ui.jcef.FundHelperStreamResourceHandler
import org.cef.handler.CefRequestHandler

object FundHelperWebviewResources {
    private const val PROTOCOL = "http"
    private const val AUTHORITY = "fundhelper"

    private val RESOURCE_FILES = listOf(
        "index.html" to "text/html",
        "assets/index.js" to "application/javascript",
        "assets/index.css" to "text/css",
    )

    fun createRequestHandler(
        disposable: Disposable,
        classLoader: ClassLoader = FundHelperWebviewResources::class.java.classLoader,
    ): Pair<CefRequestHandler, String> {
        val handler = FundHelperLocalRequestHandler(PROTOCOL, AUTHORITY)
        var indexUrl = ""

        for ((path, mimeType) in RESOURCE_FILES) {
            val resourcePath = "webview/$path"
            val url = handler.createResource(path) {
                val stream = classLoader.getResourceAsStream(resourcePath)
                    ?: error("Missing webview resource: $resourcePath")
                FundHelperStreamResourceHandler(stream, mimeType, disposable)
            }
            if (path == "index.html") {
                indexUrl = url
            }
        }

        check(indexUrl.isNotEmpty()) { "Failed to register webview index.html" }
        return handler to indexUrl
    }
}
