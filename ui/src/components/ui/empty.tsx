import type * as React from "react";

import { cn } from "../../lib/utils";

// 搬自 T3 的 Empty：空状态的一组排版（容器、图标底盘、标题、说明、内容区）。

const emptySizes = {
  compact:
    "min-h-64 gap-4 p-6 [&_[data-slot=empty-media]]:mb-0 [&_[data-slot=empty-title]]:text-[1.0625rem] [&_[data-slot=empty-title]]:leading-6 [&_[data-slot=empty-description]]:text-[0.8125rem] [&_[data-slot=empty-description]]:leading-[1.125rem]",
  default: "gap-6 p-6 md:p-12",
  hero: "gap-6 p-6 md:p-12 [&_[data-slot=empty-title]]:text-2xl",
};

export function Empty({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: keyof typeof emptySizes }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center text-balance text-center",
        emptySizes[size],
        className,
      )}
      data-slot="empty"
      {...props}
    />
  );
}

export function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex max-w-sm flex-col items-center text-center", className)} data-slot="empty-header" {...props} />;
}

const mediaBase = "flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0";

export function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & { variant?: "default" | "icon" }) {
  return (
    <div className={cn("relative mb-6", className)} data-slot="empty-media" data-variant={variant} {...props}>
      {variant === "icon" && (
        <>
          <div
            aria-hidden="true"
            className={cn(
              mediaBase,
              className,
              "pointer-events-none absolute bottom-px origin-bottom-left -translate-x-0.5 -rotate-10 scale-84 rounded-md border bg-card",
            )}
          />
          <div
            aria-hidden="true"
            className={cn(
              mediaBase,
              className,
              "pointer-events-none absolute bottom-px origin-bottom-right translate-x-0.5 rotate-10 scale-84 rounded-md border bg-card",
            )}
          />
        </>
      )}
      <div
        className={cn(
          mediaBase,
          className,
          variant === "icon" && "size-9 rounded-md border bg-card text-foreground shadow-xs [&_svg:not([class*='size-'])]:size-4.5",
        )}
      />
    </div>
  );
}

export function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("font-semibold text-xl", className)} data-slot="empty-title" {...props} />;
}

export function EmptyDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-muted-foreground text-sm [&_a]:underline [&_a]:underline-offset-4 [[data-slot=empty-title]+&]:mt-1",
        className,
      )}
      data-slot="empty-description"
      {...props}
    />
  );
}

export function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex w-full min-w-0 max-w-sm flex-col items-center gap-4 text-balance text-sm", className)}
      data-slot="empty-content"
      {...props}
    />
  );
}
