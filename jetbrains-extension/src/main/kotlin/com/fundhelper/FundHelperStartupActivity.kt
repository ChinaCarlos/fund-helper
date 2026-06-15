package com.fundhelper

import com.fundhelper.service.FundHelperService
import com.fundhelper.ui.FundHelperBottomPanelManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity

class FundHelperStartupActivity : ProjectActivity {
    override suspend fun execute(project: Project) {
        FundHelperService.getInstance().initialize()
        FundHelperBottomPanelManager.getInstance(project).hidePanel()
    }
}
