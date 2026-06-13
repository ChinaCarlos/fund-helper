import { useEffect, useState, type ReactNode } from "react";
import { getWebviewWindow, isTauriRuntime } from "@/lib/tauri";
import { usePlatform } from "@/hooks/use-platform";
import { Minus, Maximize2, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TitleBarProps {
  title?: string;
  showMinimize?: boolean;
  showMaximize?: boolean;
  showClose?: boolean;
  rightActions?: ReactNode;
  onDoubleClick?: () => void;
  isMaximized?: boolean;
}

export function TitleBar({
  title = "Fund Helper",
  showMinimize = true,
  showMaximize = true,
  showClose = true,
  rightActions,
  onDoubleClick,
  isMaximized: isMaximizedProp,
}: TitleBarProps) {
  const platform = usePlatform();
  const isMac = platform === "macos";
  const [isMaximizedLocal, setIsMaximizedLocal] = useState(false);
  const isMaximized = isMaximizedProp ?? isMaximizedLocal;

  useEffect(() => {
    if (isMaximizedProp !== undefined || !showMaximize || !isTauriRuntime()) return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void getWebviewWindow().then(async (appWindow) => {
      if (!appWindow || cancelled) return;
      setIsMaximizedLocal(await appWindow.isMaximized());
      unlisten = await appWindow.onResized(async () => {
        setIsMaximizedLocal(await appWindow.isMaximized());
      });
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [showMaximize, isMaximizedProp]);

  const handleMinimize = () => void getWebviewWindow().then((w) => w?.minimize());
  const handleToggleMaximize = () => void getWebviewWindow().then((w) => w?.toggleMaximize());
  const handleClose = () => void getWebviewWindow().then((w) => w?.close());

  const handleDragRegionDoubleClick = () => {
    if (onDoubleClick) onDoubleClick();
    else if (showMaximize) handleToggleMaximize();
  };

  if (isMac) {
    return (
      <div
        className={cn(
          "titlebar-macos flex shrink-0 items-center border-b border-[var(--border)] bg-[var(--card-solid)] select-none",
          showMaximize && isMaximized ? "" : "rounded-t-[var(--radius-window)]",
        )}
        style={{ height: "var(--titlebar-height)" }}
      >
        <div className="mac-traffic-lights shrink-0">
          {showClose ? (
            <button
              type="button"
              className="mac-traffic-light mac-traffic-close"
              aria-label="关闭"
              onClick={handleClose}
            />
          ) : null}
          {showMinimize ? (
            <button
              type="button"
              className="mac-traffic-light mac-traffic-minimize"
              aria-label="最小化"
              onClick={handleMinimize}
            />
          ) : null}
          {showMaximize ? (
            <button
              type="button"
              className="mac-traffic-light mac-traffic-maximize"
              aria-label={isMaximized ? "还原" : "最大化"}
              onClick={handleToggleMaximize}
            />
          ) : null}
        </div>

        <div
          data-tauri-drag-region
          onDoubleClick={handleDragRegionDoubleClick}
          className="flex min-w-0 flex-1 items-center justify-center px-4"
        >
          <span className="text-muted-foreground truncate text-[13px] font-medium">{title}</span>
        </div>

        <div className="flex shrink-0 items-center pr-3">{rightActions}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "titlebar-windows flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--card-solid)] select-none",
        showMaximize && isMaximized ? "" : "rounded-t-[var(--radius-window)]",
      )}
      style={{ height: "var(--titlebar-height)" }}
    >
      <div
        data-tauri-drag-region
        onDoubleClick={handleDragRegionDoubleClick}
        className="flex min-w-0 flex-1 items-center gap-2 pl-3"
      >
        <span
          className="flex size-4 shrink-0 items-center justify-center rounded-sm text-[10px] font-bold text-white"
          style={{ background: "var(--primary)" }}
        >
          基
        </span>
        <span className="truncate text-xs text-[var(--foreground)]">{title}</span>
      </div>

      <div className="flex shrink-0 items-center">
        {rightActions ? <div className="mr-2 flex items-center">{rightActions}</div> : null}

        {showMinimize ? (
          <button
            type="button"
            onClick={handleMinimize}
            className="titlebar-win-btn"
            aria-label="最小化"
            tabIndex={-1}
          >
            <Minus className="size-3.5" strokeWidth={1.5} />
          </button>
        ) : null}

        {showMaximize ? (
          <button
            type="button"
            onClick={handleToggleMaximize}
            className="titlebar-win-btn"
            aria-label={isMaximized ? "还原" : "最大化"}
            tabIndex={-1}
          >
            {isMaximized ? (
              <Square className="size-3" strokeWidth={1.5} />
            ) : (
              <Maximize2 className="size-3.5" strokeWidth={1.5} />
            )}
          </button>
        ) : null}

        {showClose ? (
          <button
            type="button"
            onClick={handleClose}
            className="titlebar-win-btn titlebar-win-btn-close"
            aria-label="关闭"
            tabIndex={-1}
          >
            <X className="size-3.5" strokeWidth={1.5} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
