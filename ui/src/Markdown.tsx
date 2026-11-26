import { Fragment, useMemo, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { MarkdownCodeBlock } from "./components/chat/MarkdownCodeBlock";
import { MarkdownTable } from "./components/chat/MarkdownTable";
import { MarkdownDetails } from "./components/chat/MarkdownDetails";
import { MarkdownExternalLinkContent } from "./components/chat/MarkdownExternalLink";

// Same pipeline shape T3 Code uses for chat messages: remark → rehype → React.
// Sanitising in the middle means we can render agent output without trusting it.
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize)
  // Highlight after sanitising: the sanitizer only ever sees plain code text.
  .use(rehypeHighlight, { detect: false });

function markdownAnchorProps(props: ComponentPropsWithoutRef<"a">) {
  const href = typeof props.href === "string" ? props.href : "";
  return { external: /^https?:\/\//i.test(href), host: href ? safeHost(href) : null };
}

function safeHost(href: string) {
  try {
    return new URL(href).host;
  } catch {
    return null;
  }
}

const components = {
  pre: ({ children }: ComponentPropsWithoutRef<"pre"> & { children?: ReactNode }) => (
    <MarkdownCodeBlock>{children}</MarkdownCodeBlock>
  ),
  table: MarkdownTable,
  details: (props: ComponentPropsWithoutRef<"details">) => (
    <MarkdownDetails open={props.open} dir={props.dir}>
      {props.children}
    </MarkdownDetails>
  ),
  a: (props: ComponentPropsWithoutRef<"a">) => {
    const { external, host } = markdownAnchorProps(props);
    if (!external || !host) {
      return <a {...props} target="_blank" rel="noreferrer noopener" />;
    }
    const plainText = typeof props.children === "string" ? props.children : null;
    return (
      <a {...props} target="_blank" rel="noreferrer noopener">
        <MarkdownExternalLinkContent host={host} plainText={plainText}>
          {props.children}
        </MarkdownExternalLinkContent>
      </a>
    );
  },
};

type HastNode = { type: string; value?: string; tagName?: string; properties?: Record<string, unknown>; children?: HastNode[] };

// While a search is filtering the transcript, the matched words are marked in place; the
// surrounding sentence is what tells the reader whether this is the hit they wanted.
function markMatches(node: HastNode, needle: string) {
  if (!node.children) return;
  const next: HastNode[] = [];
  for (const child of node.children) {
    const inCode = child.type === "element" && (child.tagName === "code" || child.tagName === "pre");
    if (child.type === "text" && child.value) {
      const lower = child.value.toLowerCase();
      let at = lower.indexOf(needle);
      if (at < 0) {
        next.push(child);
        continue;
      }
      let cursor = 0;
      while (at >= 0) {
        if (at > cursor) next.push({ type: "text", value: child.value.slice(cursor, at) });
        next.push({
          type: "element",
          tagName: "mark",
          properties: { className: ["chat-hit"] },
          children: [{ type: "text", value: child.value.slice(at, at + needle.length) }],
        });
        cursor = at + needle.length;
        at = lower.indexOf(needle, cursor);
      }
      if (cursor < child.value.length) next.push({ type: "text", value: child.value.slice(cursor) });
      continue;
    }
    // Code keeps its own token colours; a mark inside a token would fight them.
    if (child.type === "element" && !inCode && child.tagName !== "mark") markMatches(child, needle);
    next.push(child);
  }
  node.children = next;
}

export function Markdown({ text, highlight }: { text: string; highlight?: string }) {
  const tree = useMemo(() => {
    const parsed = processor.runSync(processor.parse(text));
    if (highlight) markMatches(parsed as unknown as HastNode, highlight.toLowerCase());
    return parsed;
  }, [text, highlight]);
  return <div className="markdown">{toJsxRuntime(tree, { Fragment, jsx, jsxs, components: components as never })}</div>;
}
