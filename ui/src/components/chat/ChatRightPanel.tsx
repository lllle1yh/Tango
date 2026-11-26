// 搬自 T3 的 ChatRightPanel：右侧面板的外壳。T3 里它负责在窄窗口弹成 sheet、
// 宽窗口贴着对话列，并把宽度状态放在这一层。Tango 只有「改动」「详情」两页，
// 所以壳里只做两件事：页签切换（RightPanelTabs）和按页给宽度。
import type { ReactNode } from "react";

import { cn } from "../../lib/utils";
import { RightPanelTabs, type RightPanelId } from "./RightPanelTabs";

// 「改动」要放下并排的行号与代码，比「详情」宽；两页各自沿用之前的宽度。
const PANEL_WIDTH: Record<RightPanelId, string> = {
  changes: "w-[640px]",
  details: "w-[300px]",
};

export function ChatRightPanel({
  active,
  onSelect,
  onClose,
  children,
}: {
  active: RightPanelId;
  onSelect: (id: RightPanelId) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <aside
      data-chat-right-panel={active}
      aria-label="Right panel"
      className={cn(
        "absolute top-0 right-0 bottom-0 z-20 flex max-w-[calc(100%-46px)] flex-col border-l border-border bg-background",
        PANEL_WIDTH[active],
      )}
    >
      <RightPanelTabs active={active} onSelect={onSelect} onClose={onClose} />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </aside>
  );
}
