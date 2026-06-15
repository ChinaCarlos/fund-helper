import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { PORTFOLIO_AUTO_REFRESH_MS } from "./constant";
import { fetchPortfolioSnapshot } from "./portfolio";
import { SessionStore } from "./sessionStore";
import type { PortfolioSnapshot, YjbSession } from "./types/portfolio";
import { yjb, YjbApiError } from "./yjb";

type WebviewInbound =
  | { type: "boot" }
  | { type: "startLogin" }
  | { type: "pollQr"; qrId: string }
  | { type: "refresh" }
  | { type: "logout" };

function formatSigned(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return (
    sign +
    Math.abs(value).toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function getNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

export function getWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
): string {
  const webviewDist = vscode.Uri.joinPath(extensionUri, "dist", "webview");
  const htmlPath = path.join(webviewDist.fsPath, "index.html");

  if (!fs.existsSync(htmlPath)) {
    return `<!DOCTYPE html><html><body><p>请先运行 npm run build 构建 webview。</p></body></html>`;
  }

  let html = fs.readFileSync(htmlPath, "utf8");
  const nonce = getNonce();

  html = html.replace(
    /(href|src)="([^"]+)"/g,
    (_match, attr: string, url: string) => {
      if (url.startsWith("http") || url.startsWith("data:")) {
        return `${attr}="${url}"`;
      }
      const clean = url.replace(/^\.\//, "");
      const resource = webview.asWebviewUri(
        vscode.Uri.joinPath(webviewDist, clean),
      );
      return `${attr}="${resource}"`;
    },
  );

  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}' ${webview.cspSource}`,
    `img-src ${webview.cspSource} https: data:`,
    `font-src ${webview.cspSource}`,
  ].join("; ");

  html = html.replace(
    "<head>",
    `<head>
    <meta http-equiv="Content-Security-Policy" content="${csp}">`,
  );
  html = html.replace(
    /<script type="module"/g,
    `<script nonce="${nonce}" type="module"`,
  );

  return html;
}

export class FundHelperController {
  private readonly webviews = new Set<vscode.Webview>();
  private lastSnapshot: PortfolioSnapshot | null = null;
  private loading = false;
  private fetching = false;
  private autoRefreshTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly sessionStore: SessionStore,
    private readonly statusBarItem: vscode.StatusBarItem,
  ) {}

  getExtensionUri(): vscode.Uri {
    return this.extensionUri;
  }

  registerWebview(webview: vscode.Webview): vscode.Disposable {
    this.webviews.add(webview);
    if (!webview.options.enableScripts) {
      webview.options = {
        ...webview.options,
        enableScripts: true,
        localResourceRoots: [this.extensionUri],
      };
    }
    webview.html = getWebviewHtml(webview, this.extensionUri);

    const sub = webview.onDidReceiveMessage((msg: WebviewInbound) => {
      void this.handleMessage(webview, msg);
    });

    void this.sendBoot(webview);

    return new vscode.Disposable(() => {
      sub.dispose();
      this.webviews.delete(webview);
    });
  }

  async refreshAll(options?: { silent?: boolean }): Promise<void> {
    const session = this.sessionStore.load();
    if (!session?.token) {
      this.postAll({ type: "session", session: null });
      this.updateStatusBar(null);
      return;
    }
    await this.loadPortfolio(session, undefined, options);
  }

  startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.autoRefreshTimer = setInterval(() => {
      const session = this.sessionStore.load();
      if (!session?.token) {
        return;
      }
      void this.refreshAll({ silent: true });
    }, PORTFOLIO_AUTO_REFRESH_MS);
  }

  stopAutoRefresh(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = undefined;
    }
  }

  dispose(): void {
    this.stopAutoRefresh();
    this.webviews.clear();
  }

  private postAll(message: unknown): void {
    for (const webview of this.webviews) {
      void webview.postMessage(message);
    }
  }

  private post(webview: vscode.Webview, message: unknown): void {
    void webview.postMessage(message);
  }

  private setLoading(loading: boolean): void {
    this.loading = loading;
    this.postAll({ type: "loading", loading });
  }

  private updateStatusBar(snapshot: PortfolioSnapshot | null): void {
    if (!snapshot) {
      this.statusBarItem.text = "$(graph) Fund Helper";
      this.statusBarItem.tooltip = "点击查看基金持仓";
      return;
    }
    const income = snapshot.today_income;
    const sign = income > 0 ? "+" : "";
    this.statusBarItem.text = `$(graph) ${sign}${formatSigned(income)}`;
    this.statusBarItem.tooltip = `Fund Helper · 当日收益 ${formatSigned(income)} (${snapshot.updated_at})`;
  }

  private async sendBoot(webview: vscode.Webview): Promise<void> {
    const session = this.sessionStore.load();
    this.post(webview, { type: "session", session });

    if (this.lastSnapshot) {
      this.post(webview, { type: "portfolio", snapshot: this.lastSnapshot });
    } else if (session?.token) {
      await this.loadPortfolio(session, webview);
    }
  }

  private async handleMessage(
    webview: vscode.Webview,
    msg: WebviewInbound,
  ): Promise<void> {
    switch (msg.type) {
      case "boot":
        await this.sendBoot(webview);
        break;
      case "startLogin":
        await this.handleStartLogin(webview);
        break;
      case "pollQr":
        await this.handlePollQr(webview, msg.qrId);
        break;
      case "refresh": {
        const session = this.sessionStore.load();
        if (session?.token) {
          await this.loadPortfolio(session);
        }
        break;
      }
      case "logout":
        await this.sessionStore.clear();
        this.lastSnapshot = null;
        this.postAll({ type: "session", session: null });
        this.postAll({ type: "portfolio", snapshot: null });
        this.updateStatusBar(null);
        break;
    }
  }

  private async handleStartLogin(webview: vscode.Webview): Promise<void> {
    try {
      const qr = await yjb.getQrcode();
      this.post(webview, { type: "qr", id: qr.id, url: qr.url });
    } catch (err) {
      this.post(webview, {
        type: "error",
        message: err instanceof Error ? err.message : "获取二维码失败",
      });
    }
  }

  private async handlePollQr(
    webview: vscode.Webview,
    qrId: string,
  ): Promise<void> {
    try {
      const result = await yjb.getQrcodeState(qrId);
      this.post(webview, { type: "qrState", result });

      if (String(result.state) === "2" && result.token) {
        const session: YjbSession = {
          token: result.token,
          nickname: result.nickname ?? "",
          avatar: result.avatar ?? "",
          login_time: new Date().toISOString(),
        };
        await this.sessionStore.save(session);
        this.postAll({ type: "session", session });
        await this.loadPortfolio(session);
      }
    } catch (err) {
      this.post(webview, {
        type: "error",
        message: err instanceof Error ? err.message : "查询二维码状态失败",
      });
    }
  }

  private async loadPortfolio(
    session: YjbSession,
    target?: vscode.Webview,
    options?: { silent?: boolean },
  ): Promise<void> {
    const silent = options?.silent ?? false;
    if (this.fetching) {
      return;
    }
    if (!silent) {
      this.setLoading(true);
    }
    this.fetching = true;

    try {
      const snapshot = await fetchPortfolioSnapshot(session.token);
      this.lastSnapshot = snapshot;
      const message = { type: "portfolio" as const, snapshot };
      if (target) {
        this.post(target, message);
      } else {
        this.postAll(message);
      }
      this.updateStatusBar(snapshot);
    } catch (err) {
      if (err instanceof YjbApiError && err.statusCode === 401) {
        await this.sessionStore.clear();
        this.lastSnapshot = null;
        this.postAll({ type: "session", session: null });
        this.postAll({ type: "portfolio", snapshot: null });
        this.updateStatusBar(null);
        return;
      }
      const message = err instanceof Error ? err.message : "加载失败";
      if (target) {
        this.post(target, { type: "error", message });
      } else {
        this.postAll({ type: "error", message });
      }
    } finally {
      this.fetching = false;
      if (!silent) {
        this.setLoading(false);
      }
    }
  }
}

export class FundHelperWebviewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly controller: FundHelperController) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.controller.getExtensionUri()],
    };
    const disposable = this.controller.registerWebview(webviewView.webview);
    webviewView.onDidDispose(() => disposable.dispose());
  }
}

let editorPanel: vscode.WebviewPanel | undefined;

export async function revealFundHelperSidebar(): Promise<void> {
  await vscode.commands.executeCommand("workbench.view.extension.fund-helper");
  try {
    await vscode.commands.executeCommand("fundHelper.sidebarView.focus");
  } catch {
    // focus 命令在部分宿主上可能不可用，忽略
  }
}

export async function revealFundHelperBottomPanel(): Promise<void> {
  await vscode.commands.executeCommand("workbench.action.togglePanel");
  await vscode.commands.executeCommand(
    "workbench.view.extension.fund-helper-panel",
  );
  try {
    await vscode.commands.executeCommand("fundHelper.panelView.focus");
  } catch {
    // ignore
  }
}

export function openFundHelperPanel(
  controller: FundHelperController,
  extensionUri: vscode.Uri,
): void {
  if (editorPanel) {
    editorPanel.reveal(vscode.ViewColumn.One);
    return;
  }

  editorPanel = vscode.window.createWebviewPanel(
    "fundHelperPanel",
    "Fund Helper",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [extensionUri],
    },
  );
  const disposable = controller.registerWebview(editorPanel.webview);
  editorPanel.onDidDispose(() => {
    disposable.dispose();
    editorPanel = undefined;
  });
}
