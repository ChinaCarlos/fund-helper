package com.fundhelper.actions

import com.fundhelper.service.FundHelperService
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindowManager

class ShowSidebarAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        show(project)
    }

    companion object {
        fun show(project: Project) {
            val toolWindow = ToolWindowManager.getInstance(project).getToolWindow("Fund Helper")
            toolWindow?.activate(null)
        }
    }
}
