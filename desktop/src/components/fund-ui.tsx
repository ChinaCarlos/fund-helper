import { memo, type ReactNode } from "react";
import { NativeButton, NativeLabel, NativeSelect } from "@/components/native-controls";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/format";
import type { IndexItem } from "@/types/portfolio";

export function WebCard({
  className,
  bodyClassName,
  children,
  padding = true,
}: {
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
  padding?: boolean;
}) {
  return (
    <div className={cn("web-card", className)}>
      <div className={cn(padding && "web-card-body", bodyClassName)}>{children}</div>
    </div>
  );
}

export function IndexBar({ items }: { items: IndexItem[] }) {
  if (!items.length) return null;

  return (
    <WebCard padding={false} bodyClassName="px-4 py-3">
      <div className="flex flex-wrap gap-3">
        {items.map((item) => {
          const trendClass =
            item.dir > 0 ? "text-rise" : item.dir < 0 ? "text-fall" : "text-flat";
          return (
            <div
              key={item.code}
              className="index-pill flex min-w-[180px] flex-1 items-center gap-2.5 px-4 py-2.5"
            >
              <span className="truncate text-sm font-semibold">{item.name || item.code}</span>
              <span className={cn("mono-num text-lg font-bold leading-none", trendClass)}>
                {item.v ?? "—"}
              </span>
              <span className={cn("mono-num text-base font-semibold leading-none", trendClass)}>
                {formatPercent(item.dir)}
              </span>
            </div>
          );
        })}
      </div>
    </WebCard>
  );
}

export function SummaryCard({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <WebCard className="h-full">
      <div className="text-muted-foreground mb-2 text-sm">{label}</div>
      <div className={cn("mono-num text-[26px] leading-tight font-bold", valueClass)}>{value}</div>
      {sub ? <div className="text-muted-foreground mt-1 text-xs">{sub}</div> : null}
    </WebCard>
  );
}

export function AccountSelect({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeLabel htmlFor="account-select">账户</NativeLabel>
      <NativeSelect
        id="account-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-[160px]"
      >
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

export function SortSelect<K extends string>({
  items,
  value,
  orderSymbol,
  onChange,
  onToggleOrder,
}: {
  items: { key: K; label: string }[];
  value: K;
  orderSymbol: () => string;
  onChange: (key: K) => void;
  onToggleOrder: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeLabel htmlFor="sort-select">排序</NativeLabel>
      <NativeSelect
        id="sort-select"
        value={value}
        onChange={(e) => onChange(e.target.value as K)}
        className="min-w-[140px]"
      >
        {items.map((item) => (
          <option key={item.key} value={item.key}>
            {item.label}
          </option>
        ))}
      </NativeSelect>
      <NativeButton onClick={onToggleOrder} title="切换升序/降序">
        {orderSymbol()}
      </NativeButton>
    </div>
  );
}

export const FundRow = memo(function FundRow({
  name,
  code,
  accountTitle,
  showAccount,
  dayEarn,
  dayEarnClass,
  rateText,
  rateClass,
  holdSum,
  holdEarn,
  holdEarnClass,
}: {
  name: string;
  code: string;
  accountTitle?: string;
  showAccount: boolean;
  dayEarn: string;
  dayEarnClass: string;
  rateText: string;
  rateClass: string;
  holdSum: string;
  holdEarn: string;
  holdEarnClass: string;
}) {
  return (
    <tr className="fund-list-item border-b border-[var(--border)] last:border-b-0">
      <td className="px-4 py-2.5">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="text-muted-foreground truncate text-xs">
          {code}
          {showAccount && accountTitle ? ` · ${accountTitle}` : ""}
        </div>
      </td>
      <td className={cn("mono-num px-3 py-2.5 text-right text-sm font-semibold", dayEarnClass)}>
        {dayEarn}
      </td>
      <td className={cn("mono-num px-3 py-2.5 text-right text-sm font-semibold", rateClass)}>
        {rateText}
      </td>
      <td className="mono-num text-muted-foreground hidden px-3 py-2.5 text-right text-sm sm:table-cell">
        {holdSum}
      </td>
      <td
        className={cn(
          "mono-num hidden px-4 py-2.5 text-right text-sm font-medium md:table-cell",
          holdEarnClass,
        )}
      >
        {holdEarn}
      </td>
    </tr>
  );
});
