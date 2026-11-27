// 搬自 T3 的 MarkdownMermaidCodeBlock：```mermaid 默认画成图，可以切回源码。
// T3 的这个组件自己调用 MarkdownCodeBlock 的完整接口；Tango 的 MarkdownCodeBlock
// 只吃 children，所以这里复用它的外壳 MarkdownCodeBlockFrame，源码视图直接放 children。
import { CodeIcon, Copy, WorkflowIcon } from "lucide-react";
import { useState } from "react";

import { MarkdownCodeBlockFrame } from "./MarkdownCodeBlock";
import { MermaidDiagram } from "./MermaidDiagram";

export function MarkdownMermaidCodeBlock({
  code,
  fenceTitle,
  isStreaming = false,
}: {
  code: string;
  fenceTitle: string | null;
  isStreaming?: boolean;
}) {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  // 流式过程中半截的图会一直失败，先显示源码；这一轮结束后再画。
  const showDiagram = !showCode && !isStreaming && code.trim().length > 0;

  return (
    <>
      <MarkdownCodeBlockFrame
        language="mermaid"
        title={fenceTitle ?? "mermaid"}
        wrapped
        actions={
          <>
            <button
              type="button"
              aria-label={showCode ? "Show diagram" : "Show code"}
              title={showCode ? "Show diagram" : "Show code"}
              className="grid size-6 place-items-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => setShowCode((value) => !value)}
            >
              {showCode ? <WorkflowIcon size={13} /> : <CodeIcon size={13} />}
            </button>
            {showCode && (
              <button
                type="button"
                aria-label="Copy code"
                title="Copy code"
                className="inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => {
                  void navigator.clipboard.writeText(code).then(() => setCopied(true));
                }}
              >
                <Copy size={13} />
                <span className="text-xs">{copied ? "Copied" : "Copy"}</span>
              </button>
            )}
          </>
        }
      >
        {showDiagram ? (
          <MermaidDiagram
            source={code}
            onExpand={(url) => setExpanded(url)}
          />
        ) : (
          <pre className="m-0 overflow-x-auto px-3 pb-2 font-mono text-xs whitespace-pre-wrap text-foreground/90">
            {code}
          </pre>
        )}
      </MarkdownCodeBlockFrame>
      {expanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Diagram preview"
          className="fixed inset-0 z-[120] flex flex-col items-center justify-center gap-3 bg-black/80 p-6"
          onClick={() => {
            URL.revokeObjectURL(expanded);
            setExpanded(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              URL.revokeObjectURL(expanded);
              setExpanded(null);
            }
          }}
        >
          <img
            src={expanded}
            alt="Mermaid diagram"
            className="max-h-[86vh] max-w-[92vw] rounded-lg bg-white shadow-2xl"
          />
          <button
            type="button"
            className="rounded-full border border-white/30 px-3 py-1 text-xs text-white hover:bg-white/10"
            onClick={() => {
              URL.revokeObjectURL(expanded);
              setExpanded(null);
            }}
          >
            Close
          </button>
        </div>
      )}
    </>
  );
}
