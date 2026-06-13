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
  return typeof window !== "undefined" && typeof window.__TAURI_INTERNALS__?.invoke === "function";
}

export async function showMainWindow(): Promise<void> {
  if (!isTauriRuntime()) return;
  const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  await getCurrentWebviewWindow().show();
}

export async function getWebviewWindow() {
  if (!isTauriRuntime()) return null;
  const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  return getCurrentWebviewWindow();
}
