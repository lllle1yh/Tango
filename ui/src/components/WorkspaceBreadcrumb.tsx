import type { ComponentProps, ReactNode } from "react";

import { cn } from "../lib/utils";

// 搬自 T3 的 WorkspaceBreadcrumb：项目 / 标题用同一套面包屑排布，
// 标题作为“当前页”加重，分隔符用反斜杠样式，宽度收紧时省略。

export function WorkspaceBreadcrumb({
  ariaLabel,
  children,
  className,
}: {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <nav aria-label={ariaLabel} className={cn("min-w-0", className)}>
      <ol className="m-0 flex min-w-0 list-none items-center gap-2 p-0 text-sm sm:gap-3">
        {children}
      </ol>
    </nav>
  );
}

export function WorkspaceBreadcrumbText({ children, className, ...props }: ComponentProps<"span">) {
  return (
    <span data-slot="workspace-breadcrumb-text" className={cn("block min-w-0 truncate", className)} {...props}>
      {children}
    </span>
  );
}

export function WorkspaceBreadcrumbItem({
  children,
  className,
  current = false,
}: {
  children: ReactNode;
  className?: string;
  current?: boolean;
}) {
  return (
    <li
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex min-w-0 items-center font-medium",
        current ? "text-foreground" : "shrink-0 text-muted-foreground",
        className,
      )}
    >
      {children}
    </li>
  );
}

export function WorkspaceBreadcrumbSeparator({
  className,
  children = "/",
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <li aria-hidden="true" className={cn("flex shrink-0 items-center text-icon-muted", className)}>
      {children}
    </li>
  );
}
