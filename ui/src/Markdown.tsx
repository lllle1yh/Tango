import { Fragment, useMemo } from "react";
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

export function Markdown({ text }: { text: string }) {
  const tree = useMemo(() => processor.runSync(processor.parse(text)), [text]);
  return <div className="markdown">{toJsxRuntime(tree, { Fragment, jsx, jsxs })}</div>;
}
