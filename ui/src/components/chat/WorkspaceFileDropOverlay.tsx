// 搬自 T3 的 TimelineOverlays.WorkspaceFileDropOverlay：文件拖到输入区时，卡片内浮一圈虚线，
// 告诉用户松手会附加文件。文案按 Tango 的写法固定为英文。
import { PaperclipIcon } from "lucide-react";

export function WorkspaceFileDropOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-2 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary/60 bg-primary/[0.035]"
      data-chat-workspace-drop-overlay="true"
    >
      <div
        role="status"
        className="flex items-center gap-2 rounded-full border border-primary/25 bg-background/95 px-4 py-2.5 text-sm font-medium text-foreground shadow-lg"
      >
        <PaperclipIcon className="size-4 text-primary" aria-hidden="true" />
        Drop files to attach
      </div>
    </div>
  );
}
