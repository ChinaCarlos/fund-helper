package com.fundhelper.ui.jcef

import com.intellij.openapi.Disposable
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.util.Disposer
import org.cef.callback.CefCallback
import org.cef.handler.CefResourceHandlerAdapter
import org.cef.misc.IntRef
import org.cef.misc.StringRef
import org.cef.network.CefRequest
import org.cef.network.CefResponse
import java.io.IOException
import java.io.InputStream

/**
 * Streams a classpath resource to JCEF. Vendored from IntelliJ Platform JBCefStreamResourceHandler.
 */
class FundHelperStreamResourceHandler(
    private val stream: InputStream,
    private val mimeType: String,
    parent: Disposable,
    private val headers: Map<String, String> = emptyMap(),
) : CefResourceHandlerAdapter(), Disposable {
    init {
        Disposer.register(parent, this)
    }

    override fun processRequest(request: CefRequest, callback: CefCallback): Boolean {
        callback.Continue()
        return true
    }

    override fun getResponseHeaders(
        response: CefResponse,
        responseLength: IntRef,
        redirectUrl: StringRef,
    ) {
        response.mimeType = mimeType
        response.status = 200
        for ((name, value) in headers) {
            response.setHeaderByName(name, value, true)
        }
    }

    override fun readResponse(
        dataOut: ByteArray,
        bytesToRead: Int,
        bytesRead: IntRef,
        callback: CefCallback,
    ): Boolean {
        try {
            bytesRead.set(stream.read(dataOut, 0, bytesToRead))
            if (bytesRead.get() != -1) {
                return true
            }
        } catch (_: IOException) {
            callback.cancel()
        }
        bytesRead.set(0)
        Disposer.dispose(this)
        return false
    }

    override fun cancel() {
        Disposer.dispose(this)
    }

    override fun dispose() {
        try {
            stream.close()
        } catch (e: IOException) {
            Logger.getInstance(FundHelperStreamResourceHandler::class.java)
                .warn("Failed to close webview resource stream", e)
        }
    }
}
