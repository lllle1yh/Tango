import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

// 照搬 T3 的 ThreadStatusLine：时间线末尾的一行状态，图标 + 说明 + 行内动作，
// 与 ThreadNow 同一族，宽度对齐消息列。
export function ThreadStatusLine({
  icon,
  label,
  actionLabel,
  actionDisabled = false,
  onAction,
}: {
  icon: ReactNode;
  label: string;
  actionLabel: string;
  actionDisabled?: boolean;
  onAction: () => void;
}) {
  return (
    <div
      data-chat-thread-status-line="true"
      className={cn(
        "mx-auto flex w-full min-w-0 max-w-(--chat-content-max-width) items-center gap-1.5 px-1 pb-2 text-xs text-muted-foreground",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
      )}
    >
      {icon}
      <span className="min-w-0 truncate">{label}</span>
      <span aria-hidden="true">·</span>
      <button
        type="button"
        data-slot="inline-button"
        disabled={actionDisabled}
        onClick={onAction}
        className="shrink-0 rounded-sm px-1 font-medium text-foreground underline-offset-2 hover:underline disabled:pointer-events-none disabled:opacity-50"
      >
        {actionLabel}
      </button>
    </div>
  );
}
