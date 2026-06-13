import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type WindowFrameProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

/** 内容容器；窗口边框/标题栏由操作系统原生提供 */
export function WindowFrame({ children, className, contentClassName }: WindowFrameProps) {
  return (
    <div className={cn("fund-app-bg flex h-screen w-screen flex-col overflow-hidden", className)}>
      <main className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", contentClassName)}>
        {children}
      </main>
    </div>
  );
}
