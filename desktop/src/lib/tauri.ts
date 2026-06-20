declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke: (...args: unknown[]) => Promise<unknown>;
      metadata?: {
        currentWindow: { label: string };
        currentWebview: { label: string };
      };
    };
  }
}

export function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.__TAURI_INTERNALS__?.invoke === "function") return true;
  const label = window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label;
  return label === "main" || label === "menubar-popover";
}

export async function showMainWindow(): Promise<void> {
  if (!isTauriRuntime()) return;
  const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const window = getCurrentWebviewWindow();
  await window.show();
  await window.unminimize();
  await window.setFocus();
}

export async function getWebviewWindow() {
  if (!isTauriRuntime()) return null;
  const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  return getCurrentWebviewWindow();
}
