// 对齐 T3 的 TimelineAssistantRows：助手回应没有可见头部，只留正文与悬停才出现的元信息行。
// 数据来自 Tango 的任务记录，因此把 T3 的 projectedItem / 流式订阅换成 props。
import { AlertCircleIcon, RotateCcwIcon } from "lucide-react";

import { Markdown } from "../../Markdown";
import { cn } from "../../lib/utils";
import { MessageCopyButton } from "./MessageCopyButton";
import { MESSAGE_HEADING_LEVEL, MessageAuthorHeading, TimelineRowTimestamp } from "./TimelineRowParts";

export interface AssistantTimelineRowProps {
  text: string;
  createdAt: string;
  agentName: string;
  streaming?: boolean;
  failed?: boolean;
  stopped?: boolean;
  highlight?: string;
  onRetry?: (() => void) | undefined;
}

export function AssistantTimelineRow({
  text,
  createdAt,
  agentName,
  streaming = false,
  failed = false,
  stopped = false,
  highlight,
  onRetry,
}: AssistantTimelineRowProps) {
  const messageText = text || (streaming ? "" : "(empty response)");
  return (
    <div className="group/timeline-row relative min-w-0 px-1 py-0.5">
      <MessageAuthorHeading>{agentName}</MessageAuthorHeading>
      <div data-thread-find-text="true">
        <Markdown text={messageText} highlight={highlight} />
      </div>
      {failed && (
        <div className="mt-1.5 flex">
          <span className="inline-flex items-center gap-1 rounded-sm bg-destructive/8 px-1.5 py-0.5 text-2xs text-destructive-foreground">
            <AlertCircleIcon className="size-3" />
            {stopped ? "stopped" : "interrupted"}
          </span>
        </div>
      )}
      <div
        className={cn(
          "mt-1 flex min-h-5 items-center gap-1.5 text-2xs text-muted-foreground",
          "opacity-0 transition-opacity group-hover/timeline-row:opacity-100 group-focus-within/timeline-row:opacity-100",
        )}
      >
        <TimelineRowTimestamp createdAt={createdAt} />
        <MessageCopyButton text={text} />
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-0.5 rounded-sm px-1 text-2xs text-muted-foreground hover:text-foreground"
            title="Send the prompt that failed again"
          >
            <RotateCcwIcon className="size-3" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export const ASSISTANT_HEADING_LEVEL = MESSAGE_HEADING_LEVEL;
