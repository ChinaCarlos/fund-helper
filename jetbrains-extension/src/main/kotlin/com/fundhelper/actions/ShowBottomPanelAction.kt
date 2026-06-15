package com.fundhelper.actions

import com.fundhelper.ui.FundHelperBottomPanelManager
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.Project

class ShowBottomPanelAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        show(project)
    }

    companion object {
        fun show(project: Project) {
            FundHelperBottomPanelManager.getInstance(project).showPanel()
        }
    }
}
