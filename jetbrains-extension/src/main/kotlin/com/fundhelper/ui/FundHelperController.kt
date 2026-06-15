package com.fundhelper.ui

import com.fundhelper.portfolio.PortfolioFetcher
import com.fundhelper.portfolio.PortfolioSnapshot
import com.fundhelper.portfolio.QrStateResult
import com.fundhelper.portfolio.YjbSession
import com.fundhelper.session.SessionStorageService
import com.fundhelper.yjb.YjbApiException
import com.fundhelper.yjb.YjbClient
import com.google.gson.Gson
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.project.ProjectManager
import com.intellij.util.concurrency.AppExecutorUtil
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

class FundHelperController {
    private val gson = Gson()
    private val yjb = YjbClient()
    private val sessionStorage = service<SessionStorageService>()
    private val listeners = CopyOnWriteArraySet<(String) -> Unit>()
    private var lastSnapshot: PortfolioSnapshot? = null
    private val loading = AtomicBoolean(false)
    private val fetching = AtomicBoolean(false)
    private var autoRefreshFuture: ScheduledFuture<*>? = null

    fun addListener(listener: (String) -> Unit) {
        listeners.add(listener)
        syncStateTo(listener)
    }

    fun resyncPanel(listener: (String) -> Unit) {
        syncStateTo(listener)
        val session = sessionStorage.load()
        if (session?.token?.isNotBlank() == true && lastSnapshot == null) {
            loadPortfolio(session, silent = false)
        }
    }

    private fun syncStateTo(listener: (String) -> Unit) {
        val session = sessionStorage.load()
        listener(gson.toJson(mapOf("type" to "session", "session" to session)))
        lastSnapshot?.let { snapshot ->
            listener(gson.toJson(mapOf("type" to "portfolio", "snapshot" to snapshot)))
        }
        listener(gson.toJson(mapOf("type" to "loading", "loading" to loading.get())))
    }

    fun removeListener(listener: (String) -> Unit) {
        listeners.remove(listener)
    }

    fun getLastSnapshot(): PortfolioSnapshot? = lastSnapshot

    fun startAutoRefresh() {
        stopAutoRefresh()
        autoRefreshFuture = AppExecutorUtil.getAppScheduledExecutorService().scheduleWithFixedDelay(
            {
                val session = sessionStorage.load()
                if (session?.token?.isNotBlank() == true) {
                    refreshAll(silent = true)
                }
            },
            AUTO_REFRESH_MS,
            AUTO_REFRESH_MS,
            TimeUnit.MILLISECONDS,
        )
    }

    fun stopAutoRefresh() {
        autoRefreshFuture?.cancel(false)
        autoRefreshFuture = null
    }

    fun dispose() {
        stopAutoRefresh()
        listeners.clear()
    }

    fun handleMessage(raw: String) {
        val msg = gson.fromJson(raw, Map::class.java)
        val type = msg["type"]?.toString() ?: return

        when (type) {
            "boot" -> sendBoot()
            "startLogin" -> handleStartLogin()
            "pollQr" -> handlePollQr(msg["qrId"]?.toString() ?: return)
            "refresh" -> {
                val session = sessionStorage.load()
                if (session?.token?.isNotBlank() == true) {
                    loadPortfolio(session)
                }
            }
            "logout" -> handleLogout()
        }
    }

    fun refreshAll(silent: Boolean = false) {
        val session = sessionStorage.load()
        if (session?.token.isNullOrBlank()) {
            notify(mapOf("type" to "session", "session" to null))
            FundHelperStatusBarNotifier.update(null)
            return
        }
        loadPortfolio(session!!, silent)
    }

    private fun sendBoot() {
        val session = sessionStorage.load()
        notify(mapOf("type" to "session", "session" to session))

        if (lastSnapshot != null) {
            notify(mapOf("type" to "portfolio", "snapshot" to lastSnapshot))
        } else if (session?.token?.isNotBlank() == true) {
            loadPortfolio(session, silent = false)
        }
    }

    private fun handleStartLogin() {
        runBackground {
            try {
                val qr = yjb.getQrcode()
                notify(mapOf("type" to "qr", "id" to qr.id, "url" to qr.url))
            } catch (err: Exception) {
                notify(mapOf("type" to "error", "message" to (err.message ?: "获取二维码失败")))
            }
        }
    }

    private fun handlePollQr(qrId: String) {
        runBackground {
            try {
                val result = yjb.getQrcodeState(qrId)
                notify(
                    mapOf(
                        "type" to "qrState",
                        "result" to mapOf(
                            "state" to result.state,
                            "token" to result.token,
                            "nickname" to result.nickname,
                            "avatar" to result.avatar,
                        ),
                    ),
                )

                if (QrStateResult.isLoginSuccess(result.state) && !result.token.isNullOrBlank()) {
                    val session = YjbSession(
                        token = result.token,
                        nickname = result.nickname ?: "",
                        avatar = result.avatar ?: "",
                        loginTime = java.time.Instant.now().toString(),
                    )
                    sessionStorage.save(session)
                    notify(mapOf("type" to "session", "session" to session))
                    hideBottomPanelsForAllProjects()
                    loadPortfolio(session, silent = false)
                }
            } catch (err: Exception) {
                notify(mapOf("type" to "error", "message" to (err.message ?: "查询二维码状态失败")))
            }
        }
    }

    private fun handleLogout() {
        sessionStorage.clear()
        lastSnapshot = null
        notify(mapOf("type" to "session", "session" to null))
        notify(mapOf("type" to "portfolio", "snapshot" to null))
        hideBottomPanelsForAllProjects()
        FundHelperStatusBarNotifier.update(null)
    }

    private fun hideBottomPanelsForAllProjects() {
        ApplicationManager.getApplication().invokeLater {
            for (project in ProjectManager.getInstance().openProjects) {
                if (!project.isDisposed) {
                    FundHelperBottomPanelManager.getInstance(project).hidePanel()
                }
            }
        }
    }

    private fun loadPortfolio(
        session: YjbSession,
        silent: Boolean = false,
    ) {
        if (!fetching.compareAndSet(false, true)) return
        if (!silent) {
            setLoading(true)
        }

        runBackground {
            try {
                val collect = yjb.getCollect(session.token)
                val indices = yjb.getIndex(session.token)

                @Suppress("UNCHECKED_CAST")
                val accountData = (collect["account_data"] as? List<Map<String, Any?>>) ?: emptyList()
                val fundsByAccount = linkedMapOf<Int, List<Map<String, Any?>>>()
                for (acc in accountData) {
                    val accountId = acc["account_id"].toString().toDoubleOrNull()?.toInt() ?: continue
                    fundsByAccount[accountId] = yjb.getFunds(session.token, accountId)
                }

                val snapshot = PortfolioFetcher.buildSnapshot(collect, fundsByAccount, indices)
                lastSnapshot = snapshot
                notify(mapOf("type" to "portfolio", "snapshot" to snapshot))
                FundHelperStatusBarNotifier.update(snapshot)
            } catch (err: YjbApiException) {
                if (err.statusCode == 401) {
                    sessionStorage.clear()
                    lastSnapshot = null
                    notify(mapOf("type" to "session", "session" to null))
                    notify(mapOf("type" to "portfolio", "snapshot" to null))
                    FundHelperStatusBarNotifier.update(null)
                } else {
                    notify(mapOf("type" to "error", "message" to (err.message ?: "加载失败")))
                }
            } catch (err: Exception) {
                notify(mapOf("type" to "error", "message" to (err.message ?: "加载失败")))
            } finally {
                fetching.set(false)
                if (!silent) {
                    setLoading(false)
                }
            }
        }
    }

    private fun setLoading(value: Boolean) {
        loading.set(value)
        notify(mapOf("type" to "loading", "loading" to value))
    }

    private fun notify(payload: Map<String, Any?>) {
        ApplicationManager.getApplication().invokeLater {
            postAll(payload)
        }
    }

    private fun postAll(payload: Map<String, Any?>) {
        val json = gson.toJson(payload)
        for (listener in listeners) {
            listener(json)
        }
    }

    private fun runBackground(task: () -> Unit) {
        ApplicationManager.getApplication().executeOnPooledThread(task)
    }

    companion object {
        private const val AUTO_REFRESH_MS = 10_000L
    }
}

/** 避免 controller ↔ statusbar 循环依赖 */
object FundHelperStatusBarNotifier {
    private var callback: ((PortfolioSnapshot?) -> Unit)? = null

    fun setCallback(cb: (PortfolioSnapshot?) -> Unit) {
        callback = cb
    }

    fun clearCallback() {
        callback = null
    }

    fun update(snapshot: PortfolioSnapshot?) {
        ApplicationManager.getApplication().invokeLater {
            callback?.invoke(snapshot)
        }
    }
}
