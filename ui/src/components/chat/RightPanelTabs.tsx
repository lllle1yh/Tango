// 照 T3 的 RightPanelTabs 改写的 Tango 版：右侧面板的标签栏。
// T3 能并列开好几个面板（改动 / 预览 / 终端 / 详情），拖动排序、按快捷键切换；
// Tango 只有「改动」和「详情」两页，所以这里保留它最关键的交互——两页能同时挂着、点标签切换，
// 而不是点另一个按钮就把前一页关掉。
import { FileDiff, SlidersHorizontal, X } from "lucide-react";

import { cn } from "../../lib/utils";

export type RightPanelId = "changes" | "details";

const PANEL_TABS: Array<{ id: RightPanelId; label: string; Icon: typeof FileDiff }> = [
  { id: "changes", label: "Changes", Icon: FileDiff },
  { id: "details", label: "Details", Icon: SlidersHorizontal },
];

export function RightPanelTabs({
  active,
  onSelect,
  onClose,
}: {
  active: RightPanelId;
  onSelect: (id: RightPanelId) => void;
  onClose: () => void;
}) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border px-2" data-right-panel-tabs={active}>
      <div className="flex min-w-0 items-center gap-0.5" role="tablist" aria-label="Right panel">
        {PANEL_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium",
              active === id
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
            onClick={() => onSelect(id)}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label="Close panel"
        title="Close panel"
        className="ml-auto grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={onClose}
      >
        <X size={14} />
      </button>
    </div>
  );
}
