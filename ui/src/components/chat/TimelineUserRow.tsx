// 对齐 T3 的 TimelineUserMessageRow：右对齐气泡、max-w-[80%]、rounded-2xl、bg-message，
// 操作按钮只在悬停/聚焦时出现。Tango 的交接消息单独用可折叠的上下文块。
import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon, RotateCcwIcon } from "lucide-react";

import { Markdown } from "../../Markdown";
import { cn } from "../../lib/utils";
import { MessageCopyButton } from "./MessageCopyButton";
import { MessageAuthorHeading, TimelineRowTimestamp } from "./TimelineRowParts";

export function TimelineUserRow({
  text,
  createdAt,
  handoff = false,
  highlight,
  onResend,
}: {
  text: string;
  createdAt: string;
  handoff?: boolean;
  highlight?: string;
  onResend?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const summary = handoff ? text.split("\n\n").find((part) => part.startsWith("Task:")) ?? text.split("\n\n")[0] : "";

  if (handoff) {
    return (
      <div className="group/timeline-row min-w-0 px-1 py-0.5">
        <MessageAuthorHeading>Handoff</MessageAuthorHeading>
        <div className="rounded-lg border border-border bg-secondary/50">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left text-sm text-secondary-label"
          >
            {open ? <ChevronDownIcon className="size-3.5 shrink-0" /> : <ChevronRightIcon className="size-3.5 shrink-0" />}
            <span className="min-w-0 truncate">{summary}</span>
            <span className="ml-auto shrink-0 text-2xs text-muted-foreground">{open ? "Hide context" : "Show context"}</span>
          </button>
          {open && (
            <div className="border-t border-border px-2.5 py-2">
              <Markdown text={text} highlight={highlight} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="group/timeline-row flex min-w-0 justify-end px-1 py-0.5">
      <div className="flex min-w-0 max-w-[80%] flex-col items-end">
        <MessageAuthorHeading>You</MessageAuthorHeading>
        <div className="min-w-0 max-w-full rounded-2xl rounded-tr-md bg-message px-3 py-2 text-message-foreground">
          <div data-thread-find-text="true">
            <Markdown text={text} highlight={highlight} />
          </div>
        </div>
        <div
          className={cn(
            "mt-1 flex items-center gap-1 text-2xs text-muted-foreground",
            "opacity-0 transition-opacity group-hover/timeline-row:opacity-100 group-focus-within/timeline-row:opacity-100",
          )}
        >
          <TimelineRowTimestamp createdAt={createdAt} />
          {onResend && (
            <button
              type="button"
              onClick={onResend}
              title="Put this prompt back in the composer"
              className="inline-flex items-center gap-0.5 rounded-sm px-1 text-2xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcwIcon className="size-3" />
              Resend
            </button>
          )}
          <MessageCopyButton text={text} />
        </div>
      </div>
    </div>
  );
}
