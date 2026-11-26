import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { cn } from "../../lib/utils";

// 照搬 T3 的 ThreadFindBar：对话内查找条，带「第几 / 共几」计数、
// 上下跳转和关闭，Enter 下一条、Shift+Enter 上一条。
export function ThreadFindBar({
  open,
  query,
  matchCount,
  activeIndex,
  focusRequestId,
  onQueryChange,
  onNext,
  onPrevious,
  onClose,
}: {
  open: boolean;
  query: string;
  matchCount: number;
  activeIndex: number;
  focusRequestId: number;
  onQueryChange: (query: string) => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 每次按快捷键都重新聚焦并全选，已经在开的查找条也一样。
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusRequestId, open]);

  if (!open) return null;

  const hasQuery = query.trim().length > 0;
  const noResults = hasQuery && matchCount === 0;
  const label = hasQuery ? (matchCount === 0 ? "0/0" : `${activeIndex + 1}/${matchCount}`) : "";
  const navigationDisabled = matchCount === 0;

  return (
    <div className="chat-search" role="search" aria-label="Find in conversation" data-thread-find-bar>
      <input
        ref={inputRef}
        type="search"
        value={query}
        maxLength={200}
        spellCheck={false}
        autoComplete="off"
        placeholder="Find in conversation"
        aria-label="Find in conversation"
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            if (event.shiftKey) onPrevious();
            else onNext();
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
      />
      <span
        aria-hidden="true"
        className={cn("chat-search-count", noResults && "chat-search-count-empty")}
      >
        {label}
      </span>
      <button
        type="button"
        className="icon-button"
        aria-label="Previous match"
        title="Previous match (Shift Enter)"
        disabled={navigationDisabled}
        onClick={onPrevious}
      >
        <ChevronUp size={13} />
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label="Next match"
        title="Next match (Enter)"
        disabled={navigationDisabled}
        onClick={onNext}
      >
        <ChevronDown size={13} />
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label="Close find"
        title="Close find (Esc)"
        onClick={onClose}
      >
        <X size={13} />
      </button>
    </div>
  );
}
