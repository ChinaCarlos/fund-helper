import * as vscode from 'vscode';
import {
  FundHelperController,
  FundHelperWebviewProvider,
  openFundHelperPanel,
  revealFundHelperBottomPanel,
  revealFundHelperSidebar,
} from './fundHelperController';
import { SessionStore } from './sessionStore';

let controller: FundHelperController | undefined;

export function activate(context: vscode.ExtensionContext): void {
  try {
    const sessionStore = new SessionStore(context);

    const statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      50,
    );
    statusBarItem.command = 'fundHelper.show';
    statusBarItem.text = '$(graph) Fund Helper';
    statusBarItem.tooltip = 'Fund Helper · 点击查看基金持仓';
    statusBarItem.show();

    controller = new FundHelperController(context.extensionUri, sessionStore, statusBarItem);

    const sidebarProvider = new FundHelperWebviewProvider(controller);
    const panelProvider = new FundHelperWebviewProvider(controller);

    context.subscriptions.push(
      statusBarItem,
      vscode.window.registerWebviewViewProvider('fundHelper.sidebarView', sidebarProvider, {
        webviewOptions: { retainContextWhenHidden: true },
      }),
      vscode.window.registerWebviewViewProvider('fundHelper.panelView', panelProvider, {
        webviewOptions: { retainContextWhenHidden: true },
      }),
      vscode.commands.registerCommand('fundHelper.show', async () => {
        await revealFundHelperSidebar();
      }),
      vscode.commands.registerCommand('fundHelper.openPanel', () => {
        if (controller) {
          openFundHelperPanel(controller, context.extensionUri);
        }
      }),
      vscode.commands.registerCommand('fundHelper.focusSidebar', async () => {
        await revealFundHelperSidebar();
      }),
      vscode.commands.registerCommand('fundHelper.showBottomPanel', async () => {
        await revealFundHelperBottomPanel();
      }),
      vscode.commands.registerCommand('fundHelper.refresh', () => {
        void controller?.refreshAll();
      }),
    );

    void controller.refreshAll();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`Fund Helper 启动失败: ${message}`);
    throw err;
  }
}

export function deactivate(): void {
  controller = undefined;
}
