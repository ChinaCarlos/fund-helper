package com.fundhelper.ui

import com.intellij.openapi.Disposable
import com.intellij.ui.jcef.utils.JBCefLocalRequestHandler
import com.intellij.ui.jcef.utils.JBCefStreamResourceHandler

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
    ): Pair<JBCefLocalRequestHandler, String> {
        val handler = JBCefLocalRequestHandler(PROTOCOL, AUTHORITY)
        var indexUrl = ""

        for ((path, mimeType) in RESOURCE_FILES) {
            val resourcePath = "webview/$path"
            val url = handler.createResource(path) {
                val stream = classLoader.getResourceAsStream(resourcePath)
                    ?: error("Missing webview resource: $resourcePath")
                JBCefStreamResourceHandler(stream, mimeType, disposable, emptyMap())
            }
            if (path == "index.html") {
                indexUrl = url
            }
        }

        check(indexUrl.isNotEmpty()) { "Failed to register webview index.html" }
        return handler to indexUrl
    }
}
