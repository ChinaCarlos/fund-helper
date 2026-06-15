package com.fundhelper.ui

import com.fundhelper.service.FundHelperService
import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowManager

@Service(Service.Level.PROJECT)
class FundHelperBottomPanelManager(private val project: Project) {
    fun hidePanel() {
        if (project.isDisposed) return
        toolWindowManager().invokeLater {
            if (project.isDisposed) return@invokeLater
            getToolWindow()?.hide()
        }
    }

    fun showPanel() {
        if (project.isDisposed) return
        toolWindowManager().invokeLater {
            if (project.isDisposed) return@invokeLater
            val toolWindow = getToolWindow() ?: return@invokeLater
            if (!toolWindow.isAvailable) {
                toolWindow.setAvailable(true) {
                    activateBottomPanel(toolWindow)
                }
            } else {
                activateBottomPanel(toolWindow)
            }
        }
    }

    private fun activateBottomPanel(toolWindow: ToolWindow) {
        toolWindow.show(null)
        toolWindow.activate(null)
        FundHelperService.getInstance().controller.refreshAll(silent = true)
    }

    private fun getToolWindow() =
        toolWindowManager().getToolWindow(BOTTOM_TOOL_WINDOW_ID)

    private fun toolWindowManager(): ToolWindowManager =
        ToolWindowManager.getInstance(project)

    companion object {
        const val BOTTOM_TOOL_WINDOW_ID = "Fund Helper Panel"

        fun getInstance(project: Project): FundHelperBottomPanelManager =
            project.getService(FundHelperBottomPanelManager::class.java)
    }
}
