import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

// 搬自 T3 的 ThreadDetailsPanel / ThreadDetailsSection 的排版：
// 右侧一栏「工作区 / 会话 / 活动」，每组一个小标题 + 若干 h-8 的整行，
// 行是可点的按钮，右侧放当前值。Tango 没有 Git / PR，所以只保留它有三样数据的分组。

export function ThreadDetailsSection({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="border-border/65 px-2 pt-2 pb-2.5 [&:not(:first-child)]:border-t [&>div:last-child:empty]:hidden"
    >
      <div className="mb-1 flex min-h-8 min-w-0 items-center justify-between gap-2 px-2.5">
        <h3 className="min-w-0 truncate text-2xs font-medium text-muted-foreground select-none">{title}</h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function ThreadDetailsRow({
  icon,
  label,
  value,
  onClick,
  title,
  disabled = false,
}: {
  icon?: ReactNode;
  label: string;
  value?: ReactNode;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
}) {
  const content = (
    <>
      {icon && <span className="shrink-0 text-muted-foreground [&_svg]:size-4">{icon}</span>}
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {value !== undefined && (
        <span className="min-w-0 max-w-[55%] shrink-0 truncate text-xs text-muted-foreground">{value}</span>
      )}
    </>
  );
  const className = cn(
    "flex h-8 w-full min-w-0 items-center justify-start gap-2.5 rounded-lg border border-transparent px-2.5 text-[13px] font-medium text-foreground/80",
    onClick && "hover:bg-black/[0.035] dark:hover:bg-white/[0.08]",
    disabled && "opacity-60",
  );
  if (!onClick || disabled) {
    return (
      <div className={className} title={title} aria-disabled={disabled || undefined}>
        {content}
      </div>
    );
  }
  return (
    <button type="button" className={className} title={title} onClick={onClick}>
      {content}
    </button>
  );
}

export function ThreadDetailsPanel({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <aside
      data-thread-details-panel="inline"
      className="conversation-details absolute top-0 right-0 bottom-0 z-20 flex w-[300px] flex-col border-l border-border bg-background"
    >
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <span className="text-xs font-medium text-muted-foreground select-none">Details</span>
        <button
          type="button"
          aria-label="Close details"
          title="Close details"
          className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">{children}</div>
    </aside>
  );
}
