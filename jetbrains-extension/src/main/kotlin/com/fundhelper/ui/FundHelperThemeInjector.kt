package com.fundhelper.ui

import com.intellij.ui.JBColor
import com.intellij.util.ui.UIUtil
import java.awt.Color

object FundHelperThemeInjector {
    fun buildCss(): String {
        val editorBg = UIUtil.getPanelBackground()
        val foreground = JBColor.foreground()
        val sidebarBg = JBColor.namedColor("SideBar.background", editorBg)
        val widgetBg = JBColor.namedColor("ToolWindow.background", sidebarBg)
        val border = JBColor.namedColor("Component.borderColor", JBColor.border())
        val muted = JBColor.namedColor("Label.disabledForeground", JBColor.GRAY)
        val buttonBg = JBColor.namedColor("Button.default.startBackground", JBColor.namedColor("Link.activeForeground", JBColor.BLUE))
        val buttonFg = JBColor.namedColor("Button.default.foreground", Color.WHITE)
        val buttonSecondaryBg = JBColor.namedColor("Button.background", JBColor.PanelBackground)
        val buttonSecondaryFg = JBColor.namedColor("Button.foreground", foreground)
        val errorBg = JBColor.namedColor("ValidationError.background", Color(255, 0, 0, 25))
        val errorBorder = JBColor.namedColor("ValidationError.borderColor", Color(190, 17, 0))
        val errorFg = JBColor.namedColor("ValidationError.foreground", Color(244, 135, 113))
        val focusBorder = JBColor.namedColor("Component.focusedBorderColor", JBColor.namedColor("Link.activeForeground", JBColor.BLUE))
        val warning = JBColor.namedColor("Component.warningFocusColor", Color(191, 136, 3))
        val passed = JBColor.namedColor("ProgressBar.passedColor", Color(55, 148, 255))
        val font = UIUtil.getLabelFont()

        val vars = linkedMapOf(
            "--vscode-editor-background" to colorToCss(editorBg),
            "--vscode-sideBar-background" to colorToCss(sidebarBg),
            "--vscode-editorWidget-background" to colorToCss(widgetBg),
            "--vscode-panel-border" to colorToCss(border),
            "--vscode-widget-border" to colorToCss(border),
            "--vscode-foreground" to colorToCss(foreground),
            "--vscode-descriptionForeground" to colorToCss(muted),
            "--vscode-button-background" to colorToCss(buttonBg),
            "--vscode-button-foreground" to colorToCss(buttonFg),
            "--vscode-button-secondaryBackground" to colorToCss(buttonSecondaryBg),
            "--vscode-button-secondaryForeground" to colorToCss(buttonSecondaryFg),
            "--vscode-inputValidation-errorBackground" to colorToCss(errorBg),
            "--vscode-inputValidation-errorBorder" to colorToCss(errorBorder),
            "--vscode-errorForeground" to colorToCss(errorFg),
            "--vscode-focusBorder" to colorToCss(focusBorder),
            "--vscode-editorWarning-foreground" to colorToCss(warning),
            "--vscode-testing-iconPassed" to colorToCss(passed),
            "--vscode-font-family" to font.family,
            "--vscode-font-size" to "${font.size}px",
            "--bg" to colorToCss(editorBg),
            "--card" to colorToCss(widgetBg),
            "--border" to colorToCss(border),
            "--text" to colorToCss(foreground),
            "--muted" to colorToCss(muted),
            "--flat" to colorToCss(muted),
            "--primary" to colorToCss(buttonBg),
            "--primary-fg" to colorToCss(buttonFg),
            "--primary-soft" to colorToCss(buttonSecondaryBg),
            "--primary-soft-fg" to colorToCss(buttonSecondaryFg),
            "--error-bg" to colorToCss(errorBg),
            "--error-border" to colorToCss(errorBorder),
            "--error-fg" to colorToCss(errorFg),
            "--focus-border" to colorToCss(focusBorder),
        )

        return buildString {
            append("(function(){")
            for ((name, value) in vars) {
                append("document.documentElement.style.setProperty('$name',${escapeJs(value)});")
            }
            append("window.dispatchEvent(new CustomEvent('jetbrains-theme'));")
            append("})();")
        }
    }

    private fun colorToCss(color: Color): String =
        String.format("#%02x%02x%02x", color.red, color.green, color.blue)

    private fun escapeJs(value: String): String =
        buildString {
            append('"')
            for (ch in value) {
                when (ch) {
                    '\\' -> append("\\\\")
                    '"' -> append("\\\"")
                    '\n' -> append("\\n")
                    '\r' -> append("\\r")
                    else -> append(ch)
                }
            }
            append('"')
        }
}
