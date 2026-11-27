// T3 的公式由上游服务端排版成 SVG；Tango 没有这一层，改为在本地用 katex 排版。
// katex 只在消息里真的出现公式时才加载，并且 trust:false —— TeX 里的链接、HTML 命令都不会生效。
import "katex/dist/katex.min.css";
import { useEffect, useState } from "react";

const rendered = new Map<string, string>();

// KaTeX 把反斜杠当成控制符，并把后面的真实换行/制表符当成它的名字；
// 消息里的代码片段可能带这些字符，先把它们换成显式的转义，让 KaTeX 原样当文本读。
function escapeControlCharacters(tex: string): string {
  return tex
    .split("\\").join("\\\\")
    .split(String.fromCharCode(10)).join("\\n")
    .split(String.fromCharCode(9)).join("\\t")
    .split(String.fromCharCode(13)).join("\\r");
}

export function MarkdownMath({ tex, display }: { tex: string; display: boolean }) {
  const key = (display ? "d:" : "i:") + tex;
  const [html, setHtml] = useState<string | null>(() => rendered.get(key) ?? null);

  useEffect(() => {
    if (rendered.has(key)) {
      setHtml(rendered.get(key)!);
      return;
    }
    let alive = true;
    void import("katex").then(({ default: katex }) => {
      if (!alive) return;
      let markup: string;
      try {
        markup = katex.renderToString(escapeControlCharacters(tex), {
          displayMode: display,
          output: "html",
          throwOnError: false,
          trust: false,
          strict: "ignore",
          maxSize: 20,
          maxExpand: 1000,
        });
      } catch {
        markup = "";
      }
      if (markup) rendered.set(key, markup);
      setHtml(markup || null);
    });
    return () => {
      alive = false;
    };
  }, [key, tex, display]);

  if (html === null) {
    // 还没加载完，或这条 TeX 排版失败：把源码显示出来，比空白好。
    return (
      <span
        data-markdown-math={display ? "display" : "inline"}
        className={display ? "block overflow-x-auto font-mono text-xs" : "font-mono text-xs"}
      >
        {tex}
      </span>
    );
  }

  return (
    <span
      data-markdown-math={display ? "display" : "inline"}
      className={display ? "block max-w-full overflow-x-auto overflow-y-hidden px-0.5 py-0.75" : "inline-block max-w-full overflow-x-auto overflow-y-hidden align-middle"}
      // katex 输出由 katex 自己生成（trust:false），不来自消息文本。
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
