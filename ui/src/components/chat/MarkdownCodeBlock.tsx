import { Check, Copy, WrapText } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { extractCodeBlock, extractFenceLanguage, extractFenceTitle } from "../../lib/markdownCodeBlock";
import { cn } from "../../lib/utils";

// 搬自 T3 的 MarkdownCodeBlock：代码块顶栏写语言（围栏里给了文件名就写文件名），
// 右侧是换行开关和复制；下面是高亮后的代码。高亮本身仍由 Markdown.tsx 的
// rehype-highlight 完成，这里只负责外壳。

export function MarkdownCodeBlockFrame({
  language,
  title,
  wrapped,
  actions,
  children,
}: {
  language: string;
  title: ReactNode;
  wrapped: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      dir="ltr"
      data-language={language}
      data-wrap={wrapped ? "true" : "false"}
      className={cn(
        "chat-markdown-codeblock my-[0.65rem] overflow-hidden rounded-lg border border-border/70 bg-secondary text-start leading-snug",
        wrapped ? "[&_pre]:whitespace-pre-wrap [&_pre]:break-words" : "[&_pre]:whitespace-pre",
      )}
    >
      <div className="flex select-none items-center justify-between gap-2 pt-1.5 pr-1.5 pb-0 pl-3">
        <span className="inline-flex min-w-0 items-center gap-1.5 font-mono text-2xs text-muted-foreground">
          {title}
        </span>
        <span className="flex shrink-0 items-center gap-0.5">{actions}</span>
      </div>
      <div className="min-w-0 px-0">{children}</div>
    </div>
  );
}

export function MarkdownCodeBlock({ children }: { children?: ReactNode }) {
  const extracted = extractCodeBlock(children);
  const preRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [wrapped, setWrapped] = useState(true);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const language = extracted ? extractFenceLanguage(extracted.className) : "text";
  const fenceTitle = extracted?.className ? extractFenceTitle(extracted.className.replace(/language-\S+/, "")) : null;
  return (
    <MarkdownCodeBlockFrame
      language={language}
      wrapped={wrapped}
      title={fenceTitle ?? language}
      actions={
        <>
          <button
            type="button"
            aria-label={wrapped ? "Turn off line wrapping" : "Wrap long lines"}
            aria-pressed={wrapped}
            title={wrapped ? "Turn off line wrapping" : "Wrap long lines"}
            className="grid size-6 place-items-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground aria-pressed:text-foreground"
            onClick={() => setWrapped((value) => !value)}
          >
            <WrapText size={13} />
          </button>
          <button
            type="button"
            aria-label="Copy code"
            title="Copy code"
            className="inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => {
              const text = preRef.current?.querySelector("pre")?.innerText ?? extracted?.code ?? "";
              void navigator.clipboard.writeText(text).then(() => setCopied(true));
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span className="text-xs">{copied ? "Copied" : "Copy"}</span>
          </button>
        </>
      }
    >
      <div ref={preRef}>{children}</div>
    </MarkdownCodeBlockFrame>
  );
}
