import { AlertCircle, X } from "lucide-react";

import { cn } from "../../lib/utils";

// 搬自 T3 的 ThreadErrorBanner：贴在时间线上方的错误条。
// ToolItem 这类 Agent 错误常常带一长串 JSON，T3 的做法是先取里面真正的人话，
// 再把完整原文收进可展开区域；这里沿用同样的两步。

export function getThreadErrorBannerMessage(error: string): string {
  let payload: unknown;
  try {
    payload = JSON.parse(error);
  } catch {
    return error;
  }
  if (typeof payload !== "object" || payload === null || !("error" in payload)) return error;
  const nested = (payload as { error: unknown }).error;
  if (typeof nested !== "object" || nested === null || !("message" in nested)) return error;
  const message = (nested as { message: unknown }).message;
  return typeof message === "string" && message.trim().length > 0 ? message : error;
}

export function ThreadErrorBanner({
  error,
  onDismiss,
  onRetry,
  retryLabel = "Retry",
}: {
  error: string | null;
  onDismiss?: () => void;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  if (!error) return null;
  const summary = getThreadErrorBannerMessage(error);
  const hasMore = summary !== error && error.length > summary.length;
  return (
    <div className="pointer-events-auto mx-auto w-fit max-w-[min(48rem,calc(100%-2rem))] pt-3">
      <div
        role="alert"
        className={cn(
          "flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive-foreground",
        )}
      >
        <AlertCircle size={16} className="mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium break-words">{summary}</p>
          {hasMore && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground select-none">Show full error</summary>
              <pre className="mt-1 max-h-40 overflow-auto break-words whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
                {error}
              </pre>
            </details>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onRetry && (
            <button
              type="button"
              className="h-7 rounded-sm px-2 text-xs font-medium text-foreground hover:bg-accent"
              onClick={onRetry}
            >
              {retryLabel}
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              aria-label="Dismiss error"
              title="Dismiss error"
              className="grid size-7 place-items-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={onDismiss}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
