package com.fundhelper.ui

import com.fundhelper.service.FundHelperService
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import javax.swing.JPanel

class FundHelperSidebarToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        attachPanel(project, toolWindow)
    }
}

class FundHelperBottomToolWindowFactory : ToolWindowFactory, DumbAware {
    override fun shouldBeAvailable(project: Project): Boolean = false

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        attachPanel(project, toolWindow)
    }
}

private fun attachPanel(project: Project, toolWindow: ToolWindow) {
    val service = FundHelperService.getInstance()
    val panel = FundHelperJcefPanel(service.controller, project)
    val wrapper = JPanel(java.awt.BorderLayout())
    wrapper.add(panel, java.awt.BorderLayout.CENTER)

    val content = ContentFactory.getInstance().createContent(wrapper, "", false)
    content.isCloseable = false
    toolWindow.contentManager.addContent(content)

    Disposer.register(content) {
        panel.dispose()
    }
}
