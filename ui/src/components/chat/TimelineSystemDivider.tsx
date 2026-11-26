import type { LucideIcon } from "lucide-react";

import { cn } from "../../lib/utils";

// 搬自 T3 的 TimelineSystemDivider：时间线里「暂停 / 交接 / 恢复」这类系统分隔行，
// 两侧细线中间一个胶囊，可带图标、说明和一个可点的动作。
export function TimelineSystemDivider({
  label,
  detail,
  tone = "neutral",
  icon: Icon,
  actionLabel,
  onAction,
}: {
  label: string;
  detail?: string | null;
  tone?: "neutral" | "danger";
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const content = (
    <>
      <span className="inline-flex shrink-0 items-baseline gap-1.5 whitespace-nowrap font-medium">
        {Icon ? <Icon className="size-3 shrink-0 self-center" /> : null}
        {label}
      </span>
      {detail ? (
        <span className="inline-flex min-w-0 items-center max-w-[min(22rem,60vw)] truncate opacity-70">
          {"· "}
          {detail}
        </span>
      ) : null}
    </>
  );

  return (
    <div
      className={cn(
        "turn-divider flex min-w-0 items-center gap-2 py-2 text-[0.6875rem] text-muted-foreground",
        tone === "danger" && "turn-divider-danger text-destructive",
      )}
    >
      <span aria-hidden="true" className="h-px flex-1 bg-border/70 turn-divider-line" />
      {onAction ? (
        <button
          type="button"
          aria-label={actionLabel}
          title={actionLabel}
          onClick={onAction}
          className="flex min-w-0 cursor-pointer items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 py-1 transition-colors hover:bg-accent hover:text-foreground"
        >
          {content}
        </button>
      ) : (
        <span className="flex min-w-0 flex-wrap items-center justify-center gap-1.5 rounded-full px-2 py-1 turn-divider-label">
          {content}
        </span>
      )}
      <span aria-hidden="true" className="h-px flex-1 bg-border/70 turn-divider-line" />
    </div>
  );
}
