#[cfg(target_os = "macos")]
pub mod menu_bar;

#[cfg(target_os = "macos")]
pub mod macos_tray_click;

pub mod system_tray;

#[cfg(not(target_os = "macos"))]
pub mod menu_bar {
    use tauri::AppHandle;

    use crate::portfolio::PortfolioSnapshot;

    pub fn init_popover(_app: &AppHandle) -> Result<(), String> {
        Ok(())
    }

    pub fn sync_from_snapshot(_app: &AppHandle, _snapshot: &PortfolioSnapshot) {}

    pub fn clear_tray_title(_app: &AppHandle) {}

    pub fn toggle_popover(_app: &AppHandle, _anchor: tauri::Rect, _cursor: Option<tauri::PhysicalPosition<f64>>) {}

    pub async fn refresh_if_logged_in(_app: &AppHandle) {}
}
