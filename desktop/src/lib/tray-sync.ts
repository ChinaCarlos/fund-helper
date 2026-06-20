import { isTauriRuntime } from "@/lib/tauri";
import type { PortfolioSnapshot } from "@/types/portfolio";

export async function syncTrayFromSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
  if (!isTauriRuntime()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("update_tray_title", {
    income: snapshot.today_income,
    rate: snapshot.today_income_rate,
  });
}

export async function clearTrayTitle(): Promise<void> {
  if (!isTauriRuntime()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("clear_tray_title");
}
