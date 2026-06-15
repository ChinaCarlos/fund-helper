package com.fundhelper.actions

import com.fundhelper.service.FundHelperService
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent

class RefreshAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        FundHelperService.getInstance().controller.refreshAll()
    }
}
