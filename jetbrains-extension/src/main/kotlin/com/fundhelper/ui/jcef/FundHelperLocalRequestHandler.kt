package com.fundhelper.ui.jcef

import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.callback.CefCallback
import org.cef.handler.CefRequestHandlerAdapter
import org.cef.handler.CefResourceHandler
import org.cef.handler.CefResourceHandlerAdapter
import org.cef.handler.CefResourceRequestHandler
import org.cef.handler.CefResourceRequestHandlerAdapter
import org.cef.misc.BoolRef
import org.cef.network.CefRequest
import java.net.URL

/**
 * Serves classpath webview assets at a virtual origin (e.g. http://fundhelper/).
 * Vendored from IntelliJ Platform JBCefLocalRequestHandler for compatibility with IDE 2024.2 SDK.
 */
class FundHelperLocalRequestHandler(
    private val protocol: String,
    private val authority: String,
) : CefRequestHandlerAdapter() {
    private val resources: MutableMap<String, () -> CefResourceHandler?> = HashMap()

    private val rejectingHandler = object : CefResourceHandlerAdapter() {
        override fun processRequest(request: CefRequest, callback: CefCallback): Boolean {
            callback.cancel()
            return false
        }
    }

    private val resourceRequestHandler = object : CefResourceRequestHandlerAdapter() {
        override fun getResourceHandler(
            browser: CefBrowser?,
            frame: CefFrame?,
            request: CefRequest,
        ): CefResourceHandler {
            val url = URL(request.url)
            if (url.protocol != protocol || url.authority != authority) {
                return rejectingHandler
            }
            return try {
                val path = url.path.trim('/')
                resources[path]?.invoke() ?: rejectingHandler
            } catch (_: RuntimeException) {
                rejectingHandler
            }
        }
    }

    fun createResource(resourcePath: String, resourceProvider: () -> CefResourceHandler?): String {
        val normalizedPath = resourcePath.trim('/')
        resources[normalizedPath] = resourceProvider
        return "$protocol://$authority/$normalizedPath"
    }

    override fun getResourceRequestHandler(
        browser: CefBrowser?,
        frame: CefFrame?,
        request: CefRequest?,
        isNavigation: Boolean,
        isDownload: Boolean,
        requestInitiator: String?,
        disableDefaultHandling: BoolRef?,
    ): CefResourceRequestHandler = resourceRequestHandler
}
