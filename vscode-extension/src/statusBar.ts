import * as vscode from "vscode";
import type { FundItem, PortfolioSnapshot } from "./types/portfolio";

const MAX_TOOLTIP_FUNDS = 16;

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

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

function formatMoney(value: number): string {
  return Math.abs(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const RISE_COLOR = "#e51400";
const FALL_COLOR = "#008000";
const FLAT_COLOR = "#8b95a8";

function coloredValue(value: number, text: string): string {
  const color =
    value > 0 ? RISE_COLOR : value < 0 ? FALL_COLOR : FLAT_COLOR;
  return `<span style="color:${color};font-weight:600">${escapeHtml(text)}</span>`;
}

function rateTagBadge(label: string, color: string): string {
  return (
    `<span style="display:inline-block;font-size:9px;font-weight:600;line-height:1.15;` +
    `padding:0 3px;border-radius:3px;color:${color};` +
    `background:${color}1f;border:1px solid ${color}47;` +
    `vertical-align:1px;margin-right:2px">${label}</span>`
  );
}

function rateTagHtml(fund: FundItem, trading: boolean): string {
  if (fund.nv_info?.nav_updated) {
    return rateTagBadge("已更新", "#3794ff");
  }
  if (trading) {
    return rateTagBadge("预估", "#b45309");
  }
  return "";
}

function sortFundsForTooltip(
  funds: FundItem[],
  trading: boolean,
): FundItem[] {
  const key = trading ? "day_rate" : "day_earn";
  return [...funds].sort((a, b) => {
    const av = key === "day_rate" ? a.day_rate : a.day_earn;
    const bv = key === "day_rate" ? b.day_rate : b.day_earn;
    return bv - av;
  });
}

function truncateName(name: string, maxLen = 10): string {
  if (name.length <= maxLen) {
    return name;
  }
  return `${name.slice(0, maxLen - 1)}…`;
}

function formatRefreshTime(updatedAt: string): string {
  const match = updatedAt.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
  return match ? match[1] : updatedAt;
}

function buildFundTooltipTable(
  funds: FundItem[],
  trading: boolean,
): string {
  const lines = [
    `<table style="border-collapse:collapse;width:100%;font-size:12px;line-height:1.5">`,
    `<tr style="color:${FLAT_COLOR}">`,
    `<th align="left" style="padding:2px 8px 2px 0;font-weight:500">基金</th>`,
    `<th align="right" style="padding:2px 6px;font-weight:500">收益</th>`,
    `<th align="right" style="padding:2px 0 2px 6px;font-weight:500">涨幅</th>`,
    `</tr>`,
  ];

  for (const fund of funds) {
    const tag = rateTagHtml(fund, trading);
    const tagPrefix = tag ? `${tag}&nbsp;` : "";
    lines.push(
      `<tr>`,
      `<td style="padding:2px 8px 2px 0;max-width:120px;overflow:hidden">${escapeHtml(truncateName(fund.short_name || fund.code))}</td>`,
      `<td align="right" style="padding:2px 6px;white-space:nowrap">${coloredValue(fund.day_earn, formatSigned(fund.day_earn))}</td>`,
      `<td align="right" style="padding:2px 0 2px 6px;white-space:nowrap">${tagPrefix}${coloredValue(fund.day_rate, formatPercent(fund.day_rate))}</td>`,
      `</tr>`,
    );
  }

  lines.push(`</table>`);
  return lines.join("");
}

export function buildStatusBarContent(snapshot: PortfolioSnapshot | null): {
  text: string;
  tooltip: string | vscode.MarkdownString;
} {
  if (!snapshot) {
    return {
      text: "$(graph) Fund Helper",
      tooltip: "Fund Helper · 点击打开底部持仓面板",
    };
  }

  const income = snapshot.today_income;
  const rate = snapshot.today_income_rate;
  const text = `$(graph) ${formatSigned(income)} ${formatPercent(rate)}`;

  const md = new vscode.MarkdownString(undefined, true);
  md.supportHtml = true;
  md.isTrusted = true;

  const refreshTime = formatRefreshTime(snapshot.updated_at);
  const summaryRateLabel = snapshot.trading ? "预估涨幅" : "当日涨幅";

  md.appendMarkdown(
    `<div style="line-height:1.6">` +
      `<div style="font-size:13px;font-weight:600;margin-bottom:6px">Fund Helper</div>` +
      `<div style="margin-bottom:8px">` +
      `当日收益 ${coloredValue(income, formatSigned(income))}` +
      `&nbsp;&nbsp;${summaryRateLabel} ${coloredValue(rate, formatPercent(rate))}` +
      `</div>` +
      `<div style="color:${FLAT_COLOR};font-size:11px;margin-bottom:10px">` +
      `总资产 ${formatMoney(snapshot.total_assets)} · ` +
      `<span style="color:${RISE_COLOR}">↑${snapshot.rise_count}</span> / ` +
      `<span style="color:${FALL_COLOR}">↓${snapshot.fall_count}</span> · ` +
      `${escapeHtml(refreshTime)} 更新` +
      `</div>`,
  );

  const funds = sortFundsForTooltip(snapshot.funds, snapshot.trading);
  if (funds.length === 0) {
    md.appendMarkdown(
      `<div style="color:var(--vscode-descriptionForeground);font-size:12px">暂无持仓基金</div>`,
    );
  } else {
    const shown = funds.slice(0, MAX_TOOLTIP_FUNDS);
    md.appendMarkdown(
      `<div style="font-size:11px;font-weight:600;color:var(--vscode-descriptionForeground);margin-bottom:4px">` +
        `持仓 ${funds.length}` +
        `</div>`,
    );
    md.appendMarkdown(buildFundTooltipTable(shown, snapshot.trading));
    const rest = funds.length - shown.length;
    if (rest > 0) {
      md.appendMarkdown(
        `<div style="color:var(--vscode-descriptionForeground);font-size:11px;margin-top:6px">` +
          `… 另有 ${rest} 只基金` +
          `</div>`,
      );
    }
  }

  md.appendMarkdown(
    `<div style="color:var(--vscode-descriptionForeground);font-size:11px;margin-top:10px">` +
      `点击打开底部面板查看详情` +
      `</div></div>`,
  );

  return { text, tooltip: md };
}
