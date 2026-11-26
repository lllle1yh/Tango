import type * as React from "react";

import { cn } from "../../lib/utils";

// 搬自 T3 的 Badge：状态标签（失败、未读、交接、环境来源等）共用一套尺寸与色调。
const badgeBase =
  "relative inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-sm border border-transparent font-medium outline-none [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0";

const sizes = {
  default: "h-5 min-w-5 px-1 text-xs",
  sm: "h-5 min-w-5 rounded-[.25rem] px-1 text-xs leading-none",
  lg: "h-6 min-w-6 px-1.5 text-sm",
};

const variants = {
  default: "bg-primary text-primary-foreground",
  destructive: "bg-destructive text-white",
  error: "bg-destructive/8 text-destructive-foreground",
  info: "bg-info/8 text-info-foreground",
  outline: "border-input bg-background text-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  success: "bg-success/8 text-success-foreground",
  warning: "bg-warning/8 text-warning-foreground",
};

export function Badge({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<"span"> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeBase, sizes[size], variants[variant], className)}
      {...props}
    />
  );
}
