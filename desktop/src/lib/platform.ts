export type AppPlatform = "macos" | "windows" | "linux" | "unknown";

export function detectPlatform(): AppPlatform {
  if (typeof navigator === "undefined") return "unknown";

  const platform = navigator.platform?.toLowerCase() ?? "";
  const ua = navigator.userAgent;

  if (platform.includes("mac") || ua.includes("Mac")) return "macos";
  if (platform.includes("win") || ua.includes("Windows")) return "windows";
  if (platform.includes("linux") || ua.includes("Linux")) return "linux";
  return "unknown";
}

export function applyPlatformAttribute(platform: AppPlatform = detectPlatform()): AppPlatform {
  document.documentElement.dataset.platform = platform;
  return platform;
}

export function isMacPlatform(platform: AppPlatform = detectPlatform()): boolean {
  return platform === "macos";
}
