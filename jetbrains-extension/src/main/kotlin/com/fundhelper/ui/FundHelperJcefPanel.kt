package com.fundhelper.ui

import com.intellij.ide.ui.LafManagerListener
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.util.Disposer
import com.intellij.ui.jcef.JBCefApp
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefJSQuery
import java.awt.BorderLayout
import javax.swing.JLabel
import javax.swing.JPanel

class FundHelperJcefPanel(
    private val controller: FundHelperController,
    parentDisposable: Disposable,
) : JPanel(BorderLayout()), Disposable {
    private val browser: JBCefBrowser?
    private val jsQuery: JBCefJSQuery?
    private val pageUrl: String
    private val messageListener: (String) -> Unit = { json -> postToBrowser(json) }

    init {
        if (!JBCefApp.isSupported()) {
            browser = null
            jsQuery = null
            pageUrl = ""
            add(
                JLabel(
                    "<html><center>JCEF 不可用，无法加载 Fund Helper 界面。<br/>请使用支持 JCEF 的 JetBrains IDE。</center></html>",
                    JLabel.CENTER,
                ),
                BorderLayout.CENTER,
            )
        } else {
            val jbBrowser = JBCefBrowser()
            val (resourceHandler, indexUrl) = FundHelperWebviewResources.createRequestHandler(this)
            browser = jbBrowser
            pageUrl = indexUrl
            jsQuery = JBCefJSQuery.create(jbBrowser)
            jsQuery.addHandler { message ->
                controller.handleMessage(message)
                null
            }

            Disposer.register(parentDisposable, jbBrowser)
            Disposer.register(parentDisposable, this)

            jbBrowser.jbCefClient.addRequestHandler(resourceHandler, jbBrowser.cefBrowser)

            controller.addListener(messageListener)
            subscribeThemeChanges(parentDisposable)
            injectBridgeScript()
            jbBrowser.component.background = java.awt.Color(0x2b, 0x2b, 0x2b)
            jbBrowser.loadURL(indexUrl)
            add(jbBrowser.component, BorderLayout.CENTER)
        }
    }

    private fun injectBridgeScript() {
        val query = jsQuery ?: return
        val jbBrowser = browser ?: return
        val cefBrowser = jbBrowser.cefBrowser
        val inject = """
            (function() {
              if (window.__fundHelperBridgeInstalled) return;
              window.__fundHelperBridgeInstalled = true;
              window.__jetbrainsBridge__ = {
                postMessage: function(msg) {
                  ${query.inject("typeof msg === 'string' ? msg : JSON.stringify(msg)")}
                }
              };
              window.addEventListener('jetbrains-theme', function() {
                /* theme hook */
              });
            })();
        """.trimIndent()
        jbBrowser.jbCefClient.addLoadHandler(
            object : org.cef.handler.CefLoadHandlerAdapter() {
                override fun onLoadEnd(
                    browser: org.cef.browser.CefBrowser?,
                    frame: org.cef.browser.CefFrame?,
                    httpStatusCode: Int,
                ) {
                    if (frame?.isMain == true) {
                        injectThemeVariables()
                        browser?.executeJavaScript(inject, pageUrl, 0)
                        ApplicationManager.getApplication().invokeLater {
                            controller.resyncPanel(messageListener)
                        }
                    }
                }
            },
            cefBrowser,
        )
    }

    private fun subscribeThemeChanges(parentDisposable: Disposable) {
        val connection = ApplicationManager.getApplication().messageBus.connect(parentDisposable)
        connection.subscribe(LafManagerListener.TOPIC, LafManagerListener {
            injectThemeVariables()
        })
    }

    private fun injectThemeVariables() {
        browser?.cefBrowser?.executeJavaScript(FundHelperThemeInjector.buildCss(), pageUrl, 0)
    }

    fun postToBrowser(json: String) {
        ApplicationManager.getApplication().invokeLater {
            browser?.cefBrowser?.executeJavaScript(
                "window.dispatchEvent(new CustomEvent('jetbrains-message', { detail: $json }));",
                pageUrl,
                0,
            )
        }
    }

    override fun dispose() {
        controller.removeListener(messageListener)
        jsQuery?.dispose()
    }
}
