import { Children, isValidElement } from "react";
import type * as React from "react";

import { cn } from "../../lib/utils";

// 搬自 T3 的 Alert：图标 + 标题 + 说明 + 右侧动作的一条提示。
// 子元素的角色按 data-slot 或组件名区分，所以调用方不用关心顺序。

const variants = {
  default: "bg-transparent [&_svg]:text-muted-foreground",
  sidebar:
    "rounded-lg border border-sidebar-border bg-secondary px-2 py-1.5 text-[11px] leading-4",
  error: "border-error/32 bg-error-surface text-error-foreground [&_svg]:text-error",
  info: "border-info/32 bg-info/4 [&_svg]:text-info",
  success: "border-success/32 bg-success/4 [&_svg]:text-success",
  warning: "border-warning/32 bg-warning-surface text-warning-foreground [&_svg]:text-warning",
};

function childSlot(child: React.ReactElement): string | undefined {
  const propsSlot = (child.props as Record<string, string | undefined>)["data-slot"];
  if (propsSlot) return propsSlot;
  const type = child.type as { displayName?: string; name?: string };
  switch (type.displayName ?? type.name) {
    case "AlertAction":
      return "alert-action";
    case "AlertTitle":
      return "alert-title";
    case "AlertDescription":
      return "alert-description";
    default:
      return undefined;
  }
}

export function Alert({
  className,
  variant = "default",
  controlAlignment = "center",
  children,
  ...props
}: React.ComponentProps<"div"> & {
  variant?: keyof typeof variants;
  controlAlignment?: "center" | "first-line";
}) {
  const icon: React.ReactNode[] = [];
  const content: React.ReactNode[] = [];
  const action: React.ReactNode[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      content.push(child);
      return;
    }
    const slot = childSlot(child);
    if (slot === "alert-action") action.push(child);
    else if (slot === "alert-title" || slot === "alert-description") content.push(child);
    else icon.push(child);
  });

  return (
    <div
      className={cn("relative rounded-xl border px-3.5 py-3 text-sm text-foreground", variants[variant], className)}
      data-slot="alert"
      data-variant={variant}
      role="alert"
      {...props}
    >
      <div className={cn("flex gap-2", controlAlignment === "first-line" ? "items-start" : "items-center")}>
        {icon.length > 0 && (
          <div
            className={cn(
              "flex shrink-0 items-center justify-center",
              controlAlignment === "first-line" ? "h-5 w-4 [&>svg]:size-4" : "size-4 [&>svg]:size-full",
            )}
          >
            {icon}
          </div>
        )}
        {content.length > 0 && <div className="flex min-w-0 flex-1 flex-col gap-0.5">{content}</div>}
        {action.length > 0 && (
          <div
            className={cn(
              "flex shrink-0 items-center gap-1",
              controlAlignment === "first-line" && "[&>div]:self-start",
            )}
          >
            {action}
          </div>
        )}
      </div>
    </div>
  );
}

export function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("font-medium", className)} data-slot="alert-title" {...props} />;
}

export function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2.5 text-muted-foreground", className)}
      data-slot="alert-description"
      {...props}
    />
  );
}

export function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex gap-1", className)} data-slot="alert-action" {...props} />;
}
