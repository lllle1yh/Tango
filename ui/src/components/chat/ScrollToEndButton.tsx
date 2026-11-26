// 搬自 T3 的 TimelineOverlays.ScrollToEndButton：时间线不在底部时，居中浮一个
// 「Scroll to end」胶囊；右侧还可以带一句末尾是谁在等的摘要。
import { ChevronDownIcon } from "lucide-react";

export function ScrollToEndButton({
  bottom,
  summary,
  onScrollToEnd,
}: {
  bottom: number;
  summary: string | null;
  onScrollToEnd: () => void;
}) {
  return (
    <div
      className="chat-scroll-to-bottom pointer-events-none absolute z-30 flex justify-center py-1.5"
      style={{ bottom }}
    >
      <button
        type="button"
        data-scroll-to-end="true"
        onPointerDown={(event) => event.preventDefault()}
        onClick={onScrollToEnd}
        className="pointer-events-auto inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-border/60 bg-surface-3 px-2.5 text-xs text-foreground shadow-sm hover:bg-accent"
      >
        <ChevronDownIcon className="size-3.5" />
        Scroll to end
        {summary === null ? null : (
          <span className="max-w-48 truncate text-muted-foreground">
            <span aria-hidden>· </span>
            {summary}
          </span>
        )}
      </button>
    </div>
  );
}
