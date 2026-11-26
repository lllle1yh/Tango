import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState, type ComponentProps } from "react";

import { serializeTable, type TableCopyFormat } from "../../lib/markdownTable";

// 搬自 T3 的 MarkdownTable：宽表格在消息内部横向滚动，右下角一个复制按钮，
// 可以按 Markdown / CSV / HTML 三种格式复制（HTML 粘进邮件或文档是真正的表）。

const FORMATS: Array<{ format: TableCopyFormat; label: string }> = [
  { format: "markdown", label: "Copy as Markdown" },
  { format: "csv", label: "Copy as CSV" },
  { format: "html", label: "Copy as HTML" },
];

export function MarkdownTable({ children, ...props }: ComponentProps<"table">) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<TableCopyFormat | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  const copy = (format: TableCopyFormat) => {
    const table = containerRef.current?.querySelector("table");
    if (!table) return;
    const text = serializeTable(table, format);
    const data = format === "html" ? { "text/html": `<meta charset="utf-8">${text}`, "text/plain": text } : undefined;
    if (data && typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
      void navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([data["text/html"]], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]).then(() => setCopied(format));
      return;
    }
    void navigator.clipboard.writeText(text).then(() => setCopied(format));
  };

  return (
    <div ref={containerRef} className="chat-markdown-table-container">
      <div className="w-full max-w-full overflow-x-auto">
        <table {...props}>{children}</table>
      </div>
      <div className="mt-0.5 -mx-1 flex items-center justify-end select-none">
        <div className="relative">
          <button
            type="button"
            aria-label="Copy table"
            title="Copy table"
            aria-haspopup="menu"
            aria-expanded={open}
            className="grid size-6 place-items-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => setOpen((value) => !value)}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
          {open && (
            <div
              role="menu"
              className="absolute right-0 bottom-full z-30 mb-1 flex w-max min-w-[10rem] flex-col rounded-lg border border-border bg-popover p-1 shadow-lg"
              onMouseDown={(event) => event.stopPropagation()}
            >
              {FORMATS.map(({ format, label }) => (
                <button
                  key={format}
                  type="button"
                  role="menuitem"
                  className="flex h-7 items-center justify-between gap-3 rounded-sm px-2 text-left text-xs hover:bg-accent"
                  onClick={() => {
                    copy(format);
                    setOpen(false);
                  }}
                >
                  {label}
                  {copied === format && <Check size={12} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
