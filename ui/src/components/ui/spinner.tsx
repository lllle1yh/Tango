import { LoaderCircle } from "lucide-react";
import type * as React from "react";

import { cn } from "../../lib/utils";

// 搬自 T3 的 Spinner：四档尺寸、两种色调；动画只在可见时运行（visible-animate-spin）。
const sizes = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
};

export function Spinner({
  className,
  size,
  tone = "current",
  ...props
}: React.ComponentPropsWithoutRef<typeof LoaderCircle> & {
  size?: keyof typeof sizes;
  tone?: "current" | "muted";
}) {
  return (
    <LoaderCircle
      aria-label="Loading"
      role="status"
      className={cn(
        "motion-safe:visible-animate-spin",
        size && sizes[size],
        tone === "muted" && "text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
