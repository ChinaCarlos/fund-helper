import { useMemo, useState } from "react";
import { LogoutIcon, RefreshIcon } from "@/components/Icons";
import {
  compareFunds,
  defaultFundSortKey,
  fundSortLabel,
  sortOrderSymbol,
  type FundSortKey,
  type FundSortOrder,
} from "@/lib/fundSort";
import { fundRateTagKind, fundRateTagLabel } from "@/lib/fundRateTag";
import {
  colorClass,
  formatMoney,
  formatPercent,
  formatSigned,
} from "@/lib/format";
import type {
  FundItem,
  PortfolioSnapshot,
  YjbSession,
} from "@/types/portfolio";
import { postToExtension } from "@/bridge";

function formatRefreshHint(updatedAt: string): string {
  const match = updatedAt.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
  return match ? match[1] : updatedAt;
}

interface PortfolioViewProps {
  session: YjbSession;
  snapshot: PortfolioSnapshot;
  error: string;
  loading?: boolean;
}

export function PortfolioView({
  session,
  snapshot,
  error,
  loading = false,
}: PortfolioViewProps) {
  const [activeTab, setActiveTab] = useState("all");
  const [sortKey, setSortKey] = useState<FundSortKey>(() =>
    defaultFundSortKey(snapshot.trading),
  );
  const [sortOrder, setSortOrder] = useState<FundSortOrder>("desc");

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
      ...snapshot.accounts.map((a) => ({
        id: String(a.account_id),
        label: a.title || `账户${a.account_id}`,
      })),
    ],
    [snapshot.accounts],
  );

  const activeAccount = snapshot.accounts.find(
    (a) => String(a.account_id) === activeTab,
  );

  const funds: FundItem[] =
    activeTab === "all" ? snapshot.funds : (activeAccount?.funds ?? []);

  const sortOptions = useMemo((): FundSortKey[] => {
    return ["day_rate", "day_earn", "hold_sum"];
  }, []);

  const sortedFunds = useMemo(
    () =>
      [...funds].sort((a, b) =>
        compareFunds(a, b, sortKey, sortOrder, snapshot.trading),
      ),
    [funds, sortKey, sortOrder, snapshot.trading],
  );

  const avatarUrl = session.avatar?.replace(/^http:\/\//, "https://");

  return (
    <div className="portfolio-shell">
      <section className="view portfolio-scroll">
        <header className="header header-compact">
          <div className="user-row">
            {avatarUrl ? (
              <img className="avatar" src={avatarUrl} alt="" />
            ) : (
              <span className="avatar avatar-fallback">
                {session.nickname?.[0] ?? "基"}
              </span>
            )}
            <div className="user-meta">
              <span className="user-name">
                {session.nickname || "养基宝用户"}
              </span>
              <span
                className="meta-line"
                title={`更新于 ${snapshot.updated_at}`}
              >
                {snapshot.trading ? "交易时段" : "非交易时段"}
                {" · "}
                {loading ? "刷新中…" : formatRefreshHint(snapshot.updated_at)}
              </span>
            </div>
          </div>
          <div className="header-actions">
            <button
              className="icon-btn"
              type="button"
              title="刷新"
              onClick={() => postToExtension({ type: "refresh" })}
              disabled={loading}
            >
              <RefreshIcon />
            </button>
            <button
              className="icon-btn icon-btn-logout"
              type="button"
              title="退出登录"
              onClick={() => postToExtension({ type: "logout" })}
            >
              <LogoutIcon />
            </button>
          </div>
        </header>

        {snapshot.indices.length > 0 ? (
          <div className="indices">
            {snapshot.indices.map((item) => (
              <div key={item.code} className="index-item">
                <div className="index-name">{item.name || item.code}</div>
                <div>
                  <span className="index-value">{item.v ?? "—"}</span>
                  <span className={`index-dir ${colorClass(item.dir)}`}>
                    {formatPercent(item.dir)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="summary-grid">
          <div className="summary-card">
            <span className="summary-label">总资产</span>
            <span className="summary-value">
              {formatMoney(snapshot.total_assets)}
            </span>
          </div>
          <div className="summary-card">
            <span className="summary-label">当日收益</span>
            <span
              className={`summary-value ${colorClass(snapshot.today_income)}`}
            >
              {formatSigned(snapshot.today_income)}
            </span>
            <span
              className={`summary-sub ${colorClass(snapshot.today_income_rate)}`}
            >
              {formatPercent(snapshot.today_income_rate)}
            </span>
          </div>
          <div className="summary-card summary-card-sm">
            <span className="summary-label">涨跌</span>
            <span className="summary-value summary-value-sm">
              <span className="rise">↑ {snapshot.rise_count}</span>
              {" · "}
              <span className="fall">↓ {snapshot.fall_count}</span>
            </span>
          </div>
        </div>

        <div className="tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeAccount ? (
          <div className="account-summary">
            <span>
              当日{" "}
              <strong className={colorClass(activeAccount.today_income)}>
                {formatSigned(activeAccount.today_income)}
              </strong>
              （{formatPercent(activeAccount.today_income_rate)}）
            </span>
            <span>资产 {formatMoney(activeAccount.account_assets)}</span>
          </div>
        ) : null}

        {funds.length > 0 ? (
          <div className="sort-bar">
            <span className="sort-label">排序</span>
            {sortOptions.map((key) => (
              <button
                key={key}
                type="button"
                className={`sort-btn ${sortKey === key ? "active" : ""}`}
                title={
                  sortKey === key
                    ? sortOrder === "desc"
                      ? "当前倒序，点击切换正序"
                      : "当前正序，点击切换倒序"
                    : undefined
                }
                onClick={() => handleSortClick(key)}
              >
                {fundSortLabel(key, snapshot.trading)}
                {sortKey === key ? (
                  <span className="sort-order">
                    {sortOrderSymbol(sortOrder)}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        <div className="fund-list">
          {sortedFunds.length === 0 ? (
            <div className="empty-hint">暂无持仓基金</div>
          ) : (
            sortedFunds.map((fund) => {
              const rateValue = fund.day_rate;
              const tagKind = fundRateTagKind(fund, snapshot.trading);

              return (
                <div
                  key={`${fund.account_id}-${fund.code}`}
                  className="fund-row"
                >
                  <div>
                    <div className="fund-name">
                      {fund.short_name || fund.code}
                    </div>
                    <div className="fund-code">
                      {fund.code}
                      {fund.account_title && activeTab === "all"
                        ? ` · ${fund.account_title}`
                        : ""}
                    </div>
                  </div>
                  <div className="fund-right">
                    <div className={`fund-earn ${colorClass(fund.day_earn)}`}>
                      {formatSigned(fund.day_earn)}
                    </div>
                    <div className={`fund-rate ${colorClass(rateValue)}`}>
                      {tagKind ? (
                        <span className={`rate-tag rate-tag-${tagKind}`}>
                          {fundRateTagLabel(tagKind)}
                        </span>
                      ) : null}
                      <span className="fund-rate-value">
                        {formatPercent(rateValue)}
                      </span>
                    </div>
                  </div>
                  <div className="fund-assets">
                    市值 {formatMoney(fund.hold_sum)} · 持有收益{" "}
                    {formatSigned(fund.hold_earn)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <footer className={`portfolio-dock ${loading ? "is-loading" : ""}`}>
        {error ? <div className="dock-error">{error}</div> : null}
        <div className="dock-body">
          <div className="dock-stat">
            <span className="dock-label">当日收益</span>
            <span className={`dock-value ${colorClass(snapshot.today_income)}`}>
              {formatSigned(snapshot.today_income)}
            </span>
            <span
              className={`dock-rate ${colorClass(snapshot.today_income_rate)}`}
            >
              {formatPercent(snapshot.today_income_rate)}
            </span>
          </div>
          <div className="dock-meta">
            {loading ? (
              <span className="dock-status">
                <span className="dock-spinner" aria-hidden="true" />
                刷新中
              </span>
            ) : (
              <span className="dock-status">
                {formatRefreshHint(snapshot.updated_at)} 更新
              </span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
