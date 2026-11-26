// 搬自 T3 ChatMarkdown 的 GITHUB_ALERT_PRESENTATIONS 与 blockquote 渲染：
// > [!NOTE] 之类的引用块变成左侧一条色线、标题带图标和颜色的提示块。
// T3 表格里还有一个 insight，它来自 T3 自己的助手洞察，Markdown 解析器不会产出，这里不收。
import {
  InfoIcon,
  LightbulbIcon,
  MessageSquareWarningIcon,
  OctagonAlertIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

export const MARKDOWN_ALERT_PRESENTATIONS = {
  note: {
    label: "Note",
    Icon: InfoIcon,
    borderClassName: "border-blue-500/70",
    titleClassName: "text-blue-600 dark:text-blue-400",
  },
  tip: {
    label: "Tip",
    Icon: LightbulbIcon,
    borderClassName: "border-emerald-500/70",
    titleClassName: "text-emerald-600 dark:text-emerald-400",
  },
  important: {
    label: "Important",
    Icon: MessageSquareWarningIcon,
    borderClassName: "border-purple-500/70",
    titleClassName: "text-purple-600 dark:text-purple-400",
  },
  warning: {
    label: "Warning",
    Icon: TriangleAlertIcon,
    borderClassName: "border-amber-500/70",
    titleClassName: "text-amber-600 dark:text-amber-500",
  },
  caution: {
    label: "Caution",
    Icon: OctagonAlertIcon,
    borderClassName: "border-red-500/70",
    titleClassName: "text-red-600 dark:text-red-400",
  },
} as const;

export function isMarkdownAlert(kind: string | undefined): kind is keyof typeof MARKDOWN_ALERT_PRESENTATIONS {
  return kind !== undefined && kind in MARKDOWN_ALERT_PRESENTATIONS;
}

export function MarkdownAlert({
  kind,
  dir,
  children,
}: {
  kind: keyof typeof MARKDOWN_ALERT_PRESENTATIONS;
  dir?: string;
  children: ReactNode;
}) {
  const alert = MARKDOWN_ALERT_PRESENTATIONS[kind];
  return (
    <div
      role="note"
      data-markdown-alert={kind}
      dir={dir}
      className={cn("my-1 border-s-2 ps-3", alert.borderClassName)}
    >
      <p
        data-markdown-alert-label=""
        className={cn("flex items-center gap-1.5 font-medium", alert.titleClassName)}
      >
        <alert.Icon aria-hidden className="size-3.5 shrink-0" />
        {alert.label}
      </p>
      {children}
    </div>
  );
}
