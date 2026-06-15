package com.fundhelper.service

import com.fundhelper.ui.FundHelperController
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.logger

@Service(Service.Level.APP)
class FundHelperService {
    val controller = FundHelperController()

    fun initialize() {
        if (initialized) return
        initialized = true
        LOG.info("Fund Helper plugin initialized")
        controller.refreshAll(silent = true)
        controller.startAutoRefresh()
    }

    fun dispose() {
        controller.dispose()
        initialized = false
    }

    companion object {
        private val LOG = logger<FundHelperService>()
        private var initialized = false

        fun getInstance(): FundHelperService =
            com.intellij.openapi.application.ApplicationManager.getApplication()
                .getService(FundHelperService::class.java)
    }
}
