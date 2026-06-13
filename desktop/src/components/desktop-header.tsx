import { LogOut, Moon, Sun } from "lucide-react";
import { NativeButton } from "@/components/native-controls";
import { useTheme } from "@/components/theme-provider";

interface DesktopHeaderProps {
  nickname: string;
  avatarUrl?: string;
  loading?: boolean;
  onRefresh: () => void;
  onLogout: () => void;
}

export function DesktopHeader({
  nickname,
  avatarUrl,
  loading,
  onRefresh,
  onLogout,
}: DesktopHeaderProps) {
  const { theme, setTheme } = useTheme();
  const letter = nickname?.[0]?.toUpperCase() ?? "基";

  return (
    <header className="app-toolbar shrink-0 border-b border-[var(--border)] bg-[var(--card-solid)]">
      <div className="flex items-center justify-between gap-4 px-[var(--content-padding-x)] py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-base font-bold text-[var(--foreground)]">Fund Helper</span>
          <span className="text-muted-foreground hidden text-sm sm:inline">持仓</span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <NativeButton onClick={onRefresh} disabled={loading}>
            {loading ? "刷新中…" : "刷新持仓"}
          </NativeButton>

          <NativeButton
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title="切换主题"
            aria-label="切换主题"
          >
            {theme === "dark" ? <Sun className="inline size-3.5" /> : <Moon className="inline size-3.5" />}
          </NativeButton>

          <NativeButton onClick={onLogout} title="退出登录">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="mr-1 inline size-5 rounded-full object-cover align-middle"
              />
            ) : (
              <span className="mr-1 inline-flex size-5 items-center justify-center rounded-full bg-[var(--primary)] text-[10px] font-bold text-white align-middle">
                {letter}
              </span>
            )}
            <span className="hidden max-w-[88px] truncate align-middle md:inline">{nickname}</span>
            <LogOut className="ml-1 inline size-3.5 opacity-70" />
          </NativeButton>
        </div>
      </div>
    </header>
  );
}
