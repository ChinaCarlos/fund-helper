package com.fundhelper.statusbar

import com.fundhelper.actions.ShowBottomPanelAction
import com.fundhelper.portfolio.PortfolioSnapshot
import com.fundhelper.ui.FundHelperStatusBarNotifier
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.CustomStatusBarWidget
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.StatusBarWidgetFactory
import com.intellij.openapi.wm.impl.status.widget.StatusBarWidgetsManager
import com.intellij.ui.components.JBLabel
import com.intellij.util.ui.JBUI
import java.awt.Cursor
import java.awt.event.MouseAdapter
import java.awt.event.MouseEvent
import javax.swing.SwingConstants

class FundHelperStatusBarWidgetFactory : StatusBarWidgetFactory {
    override fun getId(): String = ID
    override fun getDisplayName(): String = "Fund Helper"
    override fun isAvailable(project: Project): Boolean = true

    override fun createWidget(project: Project): StatusBarWidget =
        FundHelperStatusBarWidget(project)

    override fun disposeWidget(widget: StatusBarWidget) {
        FundHelperStatusBarNotifier.clearCallback()
    }

    override fun canBeEnabledOn(statusBar: StatusBar): Boolean = true

    companion object {
        const val ID = "FundHelperStatusBar"
    }
}

class FundHelperStatusBarWidget(
    private val project: Project,
) : StatusBarWidget, CustomStatusBarWidget {
    private val label = JBLabel("Fund Helper", SwingConstants.LEFT)
    private var snapshot: PortfolioSnapshot? = null

    init {
        label.isOpaque = false
        label.cursor = Cursor.getPredefinedCursor(Cursor.HAND_CURSOR)
        label.border = JBUI.Borders.empty(0, 6)
        label.addMouseListener(object : MouseAdapter() {
            override fun mouseClicked(e: MouseEvent) {
                ShowBottomPanelAction.show(project)
            }
        })
        FundHelperStatusBarNotifier.setCallback { snap ->
            snapshot = snap
            updatePresentation()
            project.service<StatusBarWidgetsManager>().updateWidget(FundHelperStatusBarWidgetFactory::class.java)
        }
        updatePresentation()
    }

    override fun ID(): String = FundHelperStatusBarWidgetFactory.ID

    override fun getPresentation(type: StatusBarWidget.PlatformType): StatusBarWidget.WidgetPresentation? = null

    override fun install(statusBar: StatusBar) {}

    override fun getComponent() = label

    override fun dispose() {
        FundHelperStatusBarNotifier.clearCallback()
    }

    private fun updatePresentation() {
        val snap = snapshot
        if (snap == null) {
            label.text = "Fund Helper"
        } else {
            label.text = "${formatSigned(snap.todayIncome)} ${formatPercent(snap.todayIncomeRate)}"
        }
        label.toolTipText = null
    }
}

private fun formatSigned(value: Double): String {
    val sign = when {
        value > 0 -> "+"
        value < 0 -> "-"
        else -> ""
    }
    return sign + String.format("%,.2f", kotlin.math.abs(value))
}

private fun formatPercent(value: Double): String {
    val sign = when {
        value > 0 -> "+"
        value < 0 -> "-"
        else -> ""
    }
    return "$sign${String.format("%.2f", kotlin.math.abs(value))}%"
}
