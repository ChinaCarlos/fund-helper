import { MenubarLoginView } from "@/components/MenubarLoginView";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow, WebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  compareFunds,
  defaultFundSortKey,
  fundSortLabel,
  sortOrderSymbol,
  type FundSortKey,
  type FundSortOrder,
} from "@/lib/fundSort";
import { formatMoney, formatPercent, formatSigned, trendColor } from "@/lib/format";
import { api, isUnauthorized } from "@/lib/tauri-api";
import { clearTrayTitle } from "@/lib/tray-sync";
import type { AuthStatus, FundItem, PortfolioSnapshot } from "@/types/portfolio";

function formatRefreshHint(updatedAt: string): string {
  const match = updatedAt.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
  return match ? match[1] : updatedAt;
}

function trendClass(value: number): string {
  if (value > 0) return "mb-rise";
  if (value < 0) return "mb-fall";
  return "mb-flat";
}

function LogoutIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <polyline points="21 3 21 9 15 9" />
    </svg>
  );
}

export function MenubarPopoverApp() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [sortKey, setSortKey] = useState<FundSortKey>("day_earn");
  const [sortOrder, setSortOrder] = useState<FundSortOrder>("desc");

  const loadPortfolio = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const status = await api.getAuthStatus();
      if (!status.bound) {
        setAuth(null);
        setSnapshot(null);
        return;
      }
      setAuth(status);
      const data = await api.fetchPortfolio();
      setSnapshot(data);
      setSortKey(defaultFundSortKey(data.trading));
    } catch (err) {
      if (isUnauthorized(err)) {
        setAuth(null);
        setSnapshot(null);
        return;
      }
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "加载失败"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLoggedIn = useCallback(
    (status: AuthStatus) => {
      setAuth(status);
      void loadPortfolio();
    },
    [loadPortfolio]
  );

  useEffect(() => {
    void loadPortfolio();
    if (!isTauri()) return;

    let cancelled = false;
    const unsubs: Array<Promise<() => void>> = [];

    void (async () => {
      try {
        unsubs.push(
          listen<PortfolioSnapshot>("portfolio-updated", (event) => {
            if (cancelled) return;
            setSnapshot(event.payload);
            setLoading(false);
            setError("");
          })
        );
        unsubs.push(
          listen("popover-shown", () => {
            if (cancelled) return;
            void loadPortfolio();
          })
        );
      } catch (err) {
        console.error("menubar event listen failed", err);
      }
    })();

    return () => {
      cancelled = true;
      void Promise.all(unsubs).then((fns) => fns.forEach((fn) => fn()));
    };
  }, [loadPortfolio]);

  const handleSortClick = (key: FundSortKey) => {
    if (key === sortKey) {
      setSortOrder((order) => (order === "desc" ? "asc" : "desc"));
      return;
    }
    setSortKey(key);
    setSortOrder("desc");
  };

  const tabs = useMemo(
    () => [
      { id: "all", label: "全部" },
      ...(snapshot?.accounts.map((account) => ({
        id: String(account.account_id),
        label: account.title || `账户${account.account_id}`,
      })) ?? []),
    ],
    [snapshot?.accounts]
  );

  const activeAccount = snapshot?.accounts.find(
    (account) => String(account.account_id) === activeTab
  );

  const funds: FundItem[] =
    activeTab === "all" ? (snapshot?.funds ?? []) : (activeAccount?.funds ?? []);

  const sortOptions = useMemo((): FundSortKey[] => ["day_rate", "day_earn", "hold_sum"], []);

  const sortedFunds = useMemo(
    () =>
      [...funds].sort((a, b) => compareFunds(a, b, sortKey, sortOrder, snapshot?.trading ?? false)),
    [funds, sortKey, sortOrder, snapshot?.trading]
  );

  const handleLogout = useCallback(async () => {
    try {
      await api.logout();
      await clearTrayTitle();
    } finally {
      setAuth(null);
      setSnapshot(null);
      setError("");
      setActiveTab("all");
    }
  }, []);

  const openMainWindow = async () => {
    if (!isTauri()) return;
    const main = await WebviewWindow.getByLabel("main");
    if (main) {
      await main.show();
      await main.unminimize();
      await main.setFocus();
    }
    await getCurrentWebviewWindow().hide();
  };

  if (loading && !auth && !snapshot) {
    return (
      <div className="menubar-popover">
        <div className="menubar-state">
          <div className="menubar-spinner" />
          <span>加载中…</span>
        </div>
      </div>
    );
  }

  if (!auth?.bound || !snapshot) {
    return (
      <div className="menubar-popover menubar-popover--login">
        <MenubarLoginView onLoggedIn={handleLoggedIn} />
      </div>
    );
  }

  const trading = snapshot.trading;

  return (
    <div className="menubar-shell">
      <section className="menubar-scroll">
        <header className="menubar-header">
          <div className="menubar-user">
            <div className="menubar-user-meta">
              <span className="menubar-user-name">{auth.nickname || "养基宝用户"}</span>
              <span className="menubar-meta-line" title={`更新于 ${snapshot.updated_at}`}>
                {trading ? "交易时段" : "非交易时段"}
                {" · "}
                {loading ? "刷新中…" : formatRefreshHint(snapshot.updated_at)}
              </span>
            </div>
          </div>
          <div className="menubar-actions">
            <button
              type="button"
              className="menubar-icon-btn"
              title="刷新"
              disabled={loading}
              onClick={() => void loadPortfolio()}
            >
              <RefreshIcon />
            </button>
            <button
              type="button"
              className="menubar-icon-btn menubar-icon-btn-logout"
              title="退出登录"
              onClick={() => void handleLogout()}
            >
              <LogoutIcon />
            </button>
          </div>
        </header>

        {error ? <div className="menubar-banner-error">{error}</div> : null}

        {snapshot.indices.length > 0 ? (
          <div className="menubar-indices">
            {snapshot.indices.map((item) => (
              <div key={item.code} className="menubar-index-pill">
                <div className="menubar-index-name">{item.name || item.code}</div>
                <div className="menubar-index-row">
                  <span className="menubar-index-value">{item.v ?? "—"}</span>
                  <span className={trendClass(item.dir)} style={{ color: trendColor(item.dir) }}>
                    {formatPercent(item.dir)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="menubar-summary">
          <div className="menubar-summary-card">
            <span className="menubar-label">总资产</span>
            <span className="menubar-value-lg">{formatMoney(snapshot.total_assets)}</span>
          </div>
          <div className="menubar-summary-card menubar-summary-highlight">
            <span className="menubar-label">当日收益</span>
            <span
              className={`menubar-value-lg ${trendClass(snapshot.today_income)}`}
              style={{ color: trendColor(snapshot.today_income) }}
            >
              {formatSigned(snapshot.today_income)}
            </span>
            <span
              className={`menubar-value-sub ${trendClass(snapshot.today_income_rate)}`}
              style={{ color: trendColor(snapshot.today_income_rate) }}
            >
              {formatPercent(snapshot.today_income_rate)}
            </span>
          </div>
          <div className="menubar-summary-bar">
            <span className="menubar-label">涨跌</span>
            <span className="menubar-rise-fall">
              <span className="mb-rise">↑ {snapshot.rise_count}</span>
              <span className="mb-flat">·</span>
              <span className="mb-fall">↓ {snapshot.fall_count}</span>
            </span>
          </div>
        </div>

        <div className="menubar-segmented" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`menubar-segment ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeAccount ? (
          <div className="menubar-account-strip">
            <span>
              当日{" "}
              <strong
                className={trendClass(activeAccount.today_income)}
                style={{ color: trendColor(activeAccount.today_income) }}
              >
                {formatSigned(activeAccount.today_income)}
              </strong>
              （{formatPercent(activeAccount.today_income_rate)}）
            </span>
            <span>资产 {formatMoney(activeAccount.account_assets)}</span>
          </div>
        ) : null}

        {funds.length > 0 ? (
          <div className="menubar-sort-bar">
            <span className="menubar-sort-label">排序</span>
            {sortOptions.map((key) => (
              <button
                key={key}
                type="button"
                className={`menubar-sort-btn ${sortKey === key ? "active" : ""}`}
                title={
                  sortKey === key
                    ? sortOrder === "desc"
                      ? "当前倒序，点击切换正序"
                      : "当前正序，点击切换倒序"
                    : undefined
                }
                onClick={() => handleSortClick(key)}
              >
                {fundSortLabel(key, trading)}
                {sortKey === key ? (
                  <span className="menubar-sort-order">{sortOrderSymbol(sortOrder)}</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        <div className="menubar-fund-list">
          {sortedFunds.length === 0 ? (
            <div className="menubar-empty-hint">暂无持仓基金</div>
          ) : (
            sortedFunds.map((fund) => (
              <article key={`${fund.account_id}-${fund.code}`} className="menubar-fund-card">
                <div className="menubar-fund-main">
                  <div className="menubar-fund-name">{fund.short_name || fund.code}</div>
                  <div
                    className={`menubar-fund-earn ${trendClass(fund.day_earn)}`}
                    style={{ color: trendColor(fund.day_earn) }}
                  >
                    {formatSigned(fund.day_earn)}
                  </div>
                </div>
                <div className="menubar-fund-sub">
                  <div className="menubar-fund-code">
                    {fund.code}
                    {fund.account_title && activeTab === "all" ? ` · ${fund.account_title}` : ""}
                  </div>
                  <div
                    className={`menubar-fund-rate ${trendClass(fund.day_rate)}`}
                    style={{ color: trendColor(fund.day_rate) }}
                  >
                    {formatPercent(fund.day_rate)}
                  </div>
                </div>
                <div className="menubar-fund-meta">
                  市值 {formatMoney(fund.hold_sum)} · 持有收益 {formatSigned(fund.hold_earn)}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <footer className={`menubar-dock ${loading ? "is-loading" : ""}`}>
        <div className="menubar-dock-stat">
          <span className="menubar-label">当日收益</span>
          <span
            className={`menubar-dock-value ${trendClass(snapshot.today_income)}`}
            style={{ color: trendColor(snapshot.today_income) }}
          >
            {formatSigned(snapshot.today_income)}
          </span>
          <span
            className={`menubar-dock-rate ${trendClass(snapshot.today_income_rate)}`}
            style={{ color: trendColor(snapshot.today_income_rate) }}
          >
            {formatPercent(snapshot.today_income_rate)}
          </span>
        </div>
        <button
          type="button"
          className="menubar-btn-secondary"
          onClick={() => void openMainWindow()}
        >
          打开应用
        </button>
      </footer>
    </div>
  );
}
