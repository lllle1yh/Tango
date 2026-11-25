import { Fragment, useMemo, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";

// Same pipeline shape T3 Code uses for chat messages: remark → rehype → React.
// Sanitising in the middle means we can render agent output without trusting it.
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize)
  // Highlight after sanitising: the sanitizer only ever sees plain code text.
  .use(rehypeHighlight, { detect: false });

function CodeBlock({ children, ...props }: ComponentPropsWithoutRef<"pre"> & { children?: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  return (
    <div className="code-block">
      <button
        type="button"
        className="code-copy"
        aria-label="Copy code"
        title="Copy code"
        onClick={() => {
          const text = ref.current?.innerText ?? "";
          void navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          });
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre ref={ref} {...props}>{children}</pre>
    </div>
  );
}

const components = { pre: CodeBlock };

export function Markdown({ text }: { text: string }) {
  const tree = useMemo(() => processor.runSync(processor.parse(text)), [text]);
  return <div className="markdown">{toJsxRuntime(tree, { Fragment, jsx, jsxs, components: components as never })}</div>;
}
