import { cn } from "@/lib/utils";
import type { ReactNode, SelectHTMLAttributes, ButtonHTMLAttributes } from "react";

type NativeButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary";
};

/** 使用系统原生按钮外观（WebKit / Chromium 平台样式） */
export function NativeButton({
  className,
  variant = "default",
  type = "button",
  ...props
}: NativeButtonProps) {
  return (
    <button
      type={type}
      className={cn("native-btn", variant === "primary" && "native-btn-primary", className)}
      {...props}
    />
  );
}

type NativeSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** 使用系统原生下拉框 */
export function NativeSelect({ className, ...props }: NativeSelectProps) {
  return <select className={cn("native-select", className)} {...props} />;
}

export function NativeFieldset({
  legend,
  children,
  className,
}: {
  legend?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("native-fieldset", className)}>
      {legend ? <legend className="native-legend">{legend}</legend> : null}
      {children}
    </fieldset>
  );
}

export function NativeLabel({
  children,
  htmlFor,
  className,
}: {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("native-label", className)}>
      {children}
    </label>
  );
}
