import type * as React from "react";

import { cn } from "../../lib/utils";

// 搬自 T3 的 Skeleton：加载占位块，方块 / 卡片 / 胶囊三种形状。
const shapes = {
  block: "rounded-sm",
  card: "rounded-lg",
  pill: "rounded-full",
};

export function Skeleton({
  className,
  shape = "block",
  ...props
}: React.ComponentProps<"div"> & { shape?: keyof typeof shapes }) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted-foreground/15 motion-safe:animate-skeleton", shapes[shape], className)}
      {...props}
    />
  );
}
