// 移植 T3 的 QueuedRunsControl：排队中的消息按行列出，行内可以立即发送、
// 放回输入框编辑、或从队列里删掉；超过三行时折叠，只留“显示全部”。
import { useState } from "react";
import { ArrowUpIcon, ChevronDownIcon, PencilIcon, XIcon } from "lucide-react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export interface QueuedRunItem {
  key: string;
  text: string;
  agentName: string;
}

// A longer queue shows its first messages and a button that shows the rest.
const QUEUE_VISIBLE_ROWS = 3;

export function QueuedRuns({
  items,
  onSendNow,
  onEdit,
  onRemove,
  disabled = false,
}: {
  items: QueuedRunItem[];
  onSendNow: (index: number) => void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  if (items.length === 0) return null;

  const collapsible = items.length > QUEUE_VISIBLE_ROWS;
  const visible = collapsible && !showAll ? items.slice(0, QUEUE_VISIBLE_ROWS - 1) : items;

  return (
    <section
      aria-label={`${items.length} queued ${items.length === 1 ? "message" : "messages"}`}
      className="relative mx-auto flex w-full max-w-(--chat-content-max-width) flex-col gap-2 pb-2"
    >
      <span className="sr-only" aria-live="polite">
        {items.length} queued
      </span>
      <ol className="flex flex-col items-end gap-2">
        {visible.map((item, position) => (
          <li
            key={item.key}
            aria-label={`Queued message ${position + 1} of ${items.length}, not sent`}
            className="group/queued flex w-full flex-col items-end gap-1"
          >
            <div
              className={cn(
                "flex min-w-0 max-w-[80%] flex-col rounded-2xl border border-dashed px-3 py-2 text-sm",
                "border-muted-foreground/40 text-muted-foreground",
              )}
            >
              <p className="whitespace-pre-wrap wrap-anywhere">{item.text}</p>
            </div>
            <div className="flex items-center gap-0.5 pe-1 text-2xs text-muted-foreground">
              <span className="me-1 flex items-center gap-2 px-1 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover/queued:opacity-100">
                <span className="text-subtle-fg">{item.agentName}</span>
                <Tooltip>
                  <TooltipTrigger render={<span className="flex shrink-0" />}>
                    <Button
                      size="xs"
                      variant="ghost-muted"
                      disabled={disabled}
                      onClick={() => onSendNow(position)}
                    >
                      <ArrowUpIcon />
                      Send next
                    </Button>
                  </TooltipTrigger>
                  <TooltipPopup>Move this message to the front of the queue</TooltipPopup>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger render={<span className="flex shrink-0" />}>
                    <Button
                      size="icon-xs"
                      variant="ghost-muted"
                      aria-label="Edit queued message"
                      disabled={disabled}
                      onClick={() => onEdit(position)}
                    >
                      <PencilIcon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipPopup>Put this message back in the composer</TooltipPopup>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="icon-xs"
                        variant="ghost-muted"
                        aria-label="Remove queued message"
                        disabled={disabled}
                        onClick={() => onRemove(position)}
                      />
                    }
                  >
                    <XIcon />
                  </TooltipTrigger>
                  <TooltipPopup>Remove from queue</TooltipPopup>
                </Tooltip>
              </span>
            </div>
          </li>
        ))}
      </ol>
      {collapsible ? (
        <div className="self-end pe-1 text-2xs">
          <button
            type="button"
            aria-expanded={showAll}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => setShowAll((value) => !value)}
            className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 text-muted-foreground hover:text-foreground"
          >
            {showAll ? "Show fewer" : `Show all ${items.length} queued`}
            <ChevronDownIcon
              aria-hidden
              className={cn(
                "size-3 transition-transform duration-150 motion-reduce:transition-none",
                showAll && "rotate-180",
              )}
            />
          </button>
        </div>
      ) : null}
    </section>
  );
}
