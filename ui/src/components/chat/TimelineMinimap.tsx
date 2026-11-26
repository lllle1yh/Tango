import { ChevronDown, ChevronUp } from "lucide-react";
import { useRef, useState } from "react";

import { cn } from "../../lib/utils";

// 搬自 T3 的 TimelineMinimap：长对话左侧的缩略刻度，每条用户消息一根短条，
// 鼠标移上去显示那一条的原文和回复摘要，点击直接跳过去。

export interface TimelineMinimapItem {
  id: string;
  rowIndex: number;
  userText: string | null;
  assistantText: string | null;
  /** 该条在时间线总行数里的位置，用来算刻度。 */
  index: number;
}

const ITEM_SPACING = 8;
const MAX_HEIGHT_CSS = "max(4rem, calc(100% - 9rem))";
const MIN_ITEMS = 2;

function topPercent(index: number, itemCount: number): number {
  if (itemCount <= 1) return 0;
  return (Math.max(0, Math.min(index, itemCount - 1)) / (itemCount - 1)) * 100;
}

function heightStyle(itemCount: number): string {
  const natural = Math.max(1, (itemCount - 1) * ITEM_SPACING);
  return `min(${natural}px, ${MAX_HEIGHT_CSS})`;
}

export function TimelineMinimap({
  items,
  currentIndex,
  onSelect,
}: {
  items: ReadonlyArray<TimelineMinimapItem>;
  /** 当前视口里第一条用户消息在 items 里的下标，没有就传 null。 */
  currentIndex: number | null;
  onSelect: (item: TimelineMinimapItem) => void;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const pressedRef = useRef(false);

  if (items.length < MIN_ITEMS) return null;

  const resolvedActive = activeIndex !== null && activeIndex < items.length ? activeIndex : null;
  const activeItem = resolvedActive === null ? null : items[resolvedActive] ?? null;
  const current =
    currentIndex !== null && currentIndex >= 0 && currentIndex < items.length ? currentIndex : null;
  const previousItem = current === null ? null : items[current - 1] ?? null;
  const nextItem = current === null ? null : items[current + 1] ?? null;

  return (
    <div className="chat-minimap" data-slot="timeline-minimap" aria-hidden={false}>
      <button
        type="button"
        aria-label="Previous message"
        title="Previous message"
        disabled={!previousItem}
        onClick={() => previousItem && onSelect(previousItem)}
        className="chat-minimap-nav chat-minimap-nav-previous"
      >
        <ChevronUp size={14} />
      </button>
      <div
        className="chat-minimap-rail"
        style={{ height: heightStyle(items.length) }}
        onMouseLeave={() => setActiveIndex(null)}
        onMouseDown={(event) => {
          pressedRef.current = true;
          event.preventDefault();
          const stop = () => {
            pressedRef.current = false;
            window.removeEventListener("mouseup", stop);
          };
          window.addEventListener("mouseup", stop);
        }}
      >
        {items.map((item, index) => {
          const distance = resolvedActive === null ? null : Math.abs(index - resolvedActive);
          return (
            <button
              key={item.id}
              type="button"
              tabIndex={-1}
              aria-label={`Jump to: ${item.userText ?? "message"}`}
              className={cn(
                "chat-minimap-strip",
                distance === 0 && "is-active",
                distance === 1 && "is-near",
                index === current && "is-current",
              )}
              style={{ top: `${topPercent(index, items.length)}%` }}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onSelect(item)}
            />
          );
        })}
        {activeItem && (
          <div className="chat-minimap-preview" style={{ top: `${topPercent(resolvedActive!, items.length)}%` }}>
            <span className="chat-minimap-preview-user">{activeItem.userText ?? "User message"}</span>
            {activeItem.assistantText && <span className="chat-minimap-preview-reply">{activeItem.assistantText}</span>}
          </div>
        )}
      </div>
      <button
        type="button"
        aria-label="Next message"
        title="Next message"
        disabled={!nextItem}
        onClick={() => nextItem && onSelect(nextItem)}
        className="chat-minimap-nav chat-minimap-nav-next"
      >
        <ChevronDown size={14} />
      </button>
    </div>
  );
}
