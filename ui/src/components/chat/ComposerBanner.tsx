// 搬自 T3 的 ComposerBanner：贴在输入框上方的提示卡片。
// 相邻卡片首尾相接，最下面一张的底边塞进输入框玻璃壳下面 1rem+1px（遮住接缝）。
// T3 的 Surface / Row 用 useRender 做多态；这里用普通元素，
// 需要可点的时候由调用方传 `as="button"`。
import type { ComponentProps } from "react";
import { XIcon } from "lucide-react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

export type ComposerBannerVariant = "default" | "error" | "info" | "success" | "warning";

const neutralOutline = cn(
  "[--chat-composer-attached-outline:color-mix(in_srgb,var(--foreground)_8%,transparent)]",
  "dark:[--chat-composer-attached-outline:color-mix(in_srgb,white_8%,transparent)]",
);

const variantColors: Record<ComposerBannerVariant, string> = {
  default: neutralOutline,
  error:
    "[--chat-composer-attached-outline:color-mix(in_srgb,var(--error)_32%,transparent)] [--chat-composer-attached-tint:color-mix(in_srgb,var(--error)_8%,transparent)]",
  info: neutralOutline,
  success: neutralOutline,
  warning:
    "[--chat-composer-attached-outline:color-mix(in_srgb,var(--warning)_28%,transparent)] [--chat-composer-attached-tint:color-mix(in_srgb,var(--warning)_8%,transparent)]",
};

function Surface({
  variant = "default",
  detached = false,
  className,
  as,
  ...props
}: ComponentProps<"div"> & {
  variant?: ComposerBannerVariant;
  detached?: boolean;
  as?: "div" | "button";
}) {
  const Tag = (as ?? "div") as "div";
  return (
    <Tag
      data-composer-banner-surface={detached ? "detached" : "attached"}
      data-variant={variant}
      className={cn(
        "relative isolate border-0 bg-transparent shadow-none [--chat-composer-attached-tint:transparent]",
        "[--chat-composer-attached-surface:var(--card)] dark:[--chat-composer-attached-surface:var(--surface-raised)]",
        variantColors[variant],
        detached
          ? "[--chat-composer-attachment-overlap:0px] before:rounded-2xl"
          : // 底边多伸 1px，盖住 Chromium 分数像素下的玻璃接缝。
            "[--chat-composer-attachment-overlap:calc(1rem+1px)] before:rounded-t-2xl before:mask-t-from-transparent before:mask-t-from-4 before:mask-t-to-black before:mask-t-to-4",
        "before:pointer-events-none before:absolute before:inset-0 before:-z-1 before:border before:border-(--chat-composer-attached-outline)",
        "before:bg-(--chat-composer-attached-surface)/(--glass-opacity) before:bg-linear-to-b before:from-(--chat-composer-attached-tint) before:to-(--chat-composer-attached-tint) before:backdrop-blur-(--glass-blur) before:backdrop-saturate-(--glass-saturation)",
        "before:shadow-composer",
        "not-supports-[((backdrop-filter:blur(1px))_or_(-webkit-backdrop-filter:blur(1px)))]:before:bg-(--chat-composer-attached-surface)",
        className,
      )}
      {...props}
    />
  );
}

function Attachment({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="composer-banner-attachment"
      className={cn(
        "mx-auto -mb-[calc(1rem+1px)] w-[calc(100%-2*var(--chat-composer-drawer-inset))]",
        // 只有贴着输入框的那张要暗色接缝；叠起来的会一条条出现。
        "[\&:has(+[data-slot=composer-banner-attachment])]:[--chat-composer-attached-seam:transparent]",
        "[\&+[data-slot=composer-banner-attachment]_[data-composer-banner-surface=attached]]:before:rounded-none [\&+[data-slot=composer-banner-attachment]_[data-composer-banner-surface=attached]]:before:border-t-0 [\&+[data-slot=composer-banner-attachment]_[data-composer-banner-surface=attached]]:[--composer-banner-corner-top:var(--control-radius)]",
        className,
      )}
      {...props}
    />
  );
}

// 只给「贴着输入框的那一摞」留位置：没有 attached 卡片时整行不出现，输入框不会被顶起来。
function Dock({ className, ...props }: ComponentProps<"div">) {
  return (
    <Attachment
      className={cn(
        "flex items-end gap-1 not-has-data-[composer-banner-surface=attached]:hidden",
        className,
      )}
      {...props}
    />
  );
}

function Column({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col empty:hidden",
        "[\&>[data-slot=composer-banner-attachment]]:w-full [\&>[data-slot=composer-banner-attachment]:last-child]:mb-0",
        className,
      )}
      {...props}
    />
  );
}

function Root({
  className,
  density = "default",
  variant = "default",
  width = "fill",
  detached = false,
  ...props
}: ComponentProps<typeof Surface> & {
  density?: "default" | "comfortable" | "spacious";
  width?: "fill" | "content";
}) {
  return (
    <Surface
      detached={detached}
      className={cn(
        "min-w-0 px-1 py-(--composer-banner-padding-block) after:block after:h-(--chat-composer-attachment-overlap) text-xs/4 [--composer-banner-corner-top:var(--radius-xl)] [--composer-banner-icon-column:--spacing(7)] [--composer-banner-padding-block:--spacing(1)] sm:[--composer-banner-icon-column:--spacing(6)]",
        density === "comfortable" && "[--composer-banner-padding-block:--spacing(1.25)]",
        density === "spacious" && "px-3 [--composer-banner-padding-block:--spacing(3)]",
        width === "content" ? "w-fit max-w-full flex-none" : "@container",
        className,
      )}
      data-slot="composer-banner"
      data-composer-banner-width={width}
      variant={variant}
      {...props}
    />
  );
}

function Row({
  className,
  as,
  layout = "inline",
  ...props
}: ComponentProps<"div"> & {
  as?: "div" | "button";
  layout?: "inline" | "wrap-actions" | "approval";
}) {
  const Tag = (as ?? "div") as "div";
  return (
    <Tag
      className={cn(
        "group/banner-row grid min-h-(--composer-banner-icon-column) w-full min-w-0 grid-cols-[var(--composer-banner-icon-column)_minmax(0,1fr)_auto] items-center gap-x-1 text-start",
        "not-has-[>[data-slot=composer-banner-actions]]:grid-cols-[var(--composer-banner-icon-column)_minmax(0,1fr)]",
        "[\&:is(button)]:cursor-pointer [\&:is(button)]:rounded-xl [\&:is(button)]:hover:bg-foreground/5 [\&:is(button)]:focus-visible:outline-2 [\&:is(button)]:focus-visible:-outline-offset-2 [\&:is(button)]:focus-visible:outline-ring",
        layout === "wrap-actions" &&
          "flex flex-wrap *:data-[slot=composer-banner-content]:max-w-[calc(100%-var(--composer-banner-icon-column)-var(--spacing))] *:data-[slot=composer-banner-content]:grow",
        layout === "approval" && "items-start gap-x-2 gap-y-3",
        className,
      )}
      data-composer-banner-row="true"
      data-composer-banner-layout={layout}
      {...props}
    />
  );
}

function Icon({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      data-slot="composer-banner-icon"
      className={cn(
        "col-start-1 row-start-1 flex w-(--composer-banner-icon-column) min-w-0 flex-none items-center justify-center text-muted-foreground [\&>svg]:size-3",
        "group-data-[composer-banner-layout=approval]/banner-row:pt-0.5 group-data-[composer-banner-layout=approval]/banner-row:text-warning group-data-[composer-banner-layout=approval]/banner-row:[\&>svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function Content({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="composer-banner-content"
      className={cn(
        "col-start-2 row-start-1 flex min-w-0 items-center gap-1 *:data-[slot=composer-banner-separator]:mx-0",
        "@max-[560px]:group-data-[composer-banner-layout=approval]/banner-row:col-end-4",
        "group-not-has-[>[data-slot=composer-banner-icon]]/banner-row:col-[1/3] group-not-has-[>[data-slot=composer-banner-icon]]/banner-row:ps-2 sm:group-not-has-[>[data-slot=composer-banner-icon]]/banner-row:ps-1.5",
        "group-not-has-[>[data-slot=composer-banner-icon],>[data-slot=composer-banner-actions]]/banner-row:pe-2 sm:group-not-has-[>[data-slot=composer-banner-icon],>[data-slot=composer-banner-actions]]/banner-row:pe-1.5",
        className,
      )}
      {...props}
    />
  );
}

function Separator() {
  return (
    <span
      aria-hidden
      data-slot="composer-banner-separator"
      className="mx-1 inline-block flex-none text-muted-foreground/40"
    >
      ·
    </span>
  );
}

function Actions({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="composer-banner-actions"
      className={cn(
        "col-start-3 row-start-1 flex flex-wrap items-center justify-end gap-1",
        "group-data-[composer-banner-layout=approval]/banner-row:self-center group-data-[composer-banner-layout=approval]/banner-row:gap-1.5 @max-[560px]:group-data-[composer-banner-layout=approval]/banner-row:col-start-2 @max-[560px]:group-data-[composer-banner-layout=approval]/banner-row:col-end-4 @max-[560px]:group-data-[composer-banner-layout=approval]/banner-row:row-start-2",
        "group-data-[composer-banner-layout=wrap-actions]/banner-row:ms-auto",
        className,
      )}
      {...props}
    />
  );
}

function Children({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("grid gap-px [\&_[data-composer-banner-row]]:min-h-5", className)}
      {...props}
    />
  );
}

function Count({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex min-w-(--composer-banner-icon-column,1em) flex-none justify-center font-medium text-muted-foreground tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

function Body({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("min-w-0 ps-8 sm:ps-7", className)} {...props} />;
}

function Dot({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("size-1.5 flex-none rounded-full bg-current", className)} {...props} />;
}

function Dismiss({ className, children, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button size="icon-xs" variant="ghost" className={className} {...props}>
      {children ?? <XIcon className="size-3.5" />}
    </Button>
  );
}

export const ComposerBanner = {
  Surface,
  Attachment,
  Dock,
  Column,
  Root,
  Row,
  Icon,
  Content,
  Separator,
  Actions,
  Children,
  Count,
  Body,
  Dot,
  Dismiss,
};
