import { Fragment, useMemo, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { extractCodeBlock, extractFenceLanguage, extractFenceTitle } from "./lib/markdownCodeBlock";
import { MarkdownCodeBlock } from "./components/chat/MarkdownCodeBlock";
import { MarkdownMermaidCodeBlock } from "./components/chat/MarkdownMermaidCodeBlock";
import { MarkdownTable } from "./components/chat/MarkdownTable";
import { MarkdownDetails } from "./components/chat/MarkdownDetails";
import { MarkdownExternalLinkContent } from "./components/chat/MarkdownExternalLink";
import { isMarkdownAlert, MarkdownAlert } from "./components/chat/MarkdownAlert";
import { remarkGithubAlerts } from "./components/chat/markdownGithubAlerts";

// T3 给 blockquote 标 dataAlert，再在渲染时换成提示块；默认 schema 会把它洗掉，所以放开这一个。
const markdownSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    blockquote: [...(defaultSchema.attributes?.blockquote ?? []), "dataAlert"],
  },
};

// Same pipeline shape T3 Code uses for chat messages: remark → rehype → React.
// Sanitising in the middle means we can render agent output without trusting it.
// allowDangerousHtml + rehype-raw 是 T3 的做法：Markdown 里的 <details><summary> 这类
// HTML 块要真的变成元素，否则 MarkdownDetails 永远收不到 summary，折叠块就不存在。
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkGithubAlerts)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, markdownSchema)
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
  pre: ({ children }: ComponentPropsWithoutRef<"pre"> & { children?: ReactNode }) => {
    // ```mermaid 画成图（T3 的 MarkdownMermaidCodeBlock）；其它语言照旧。
    const extracted = extractCodeBlock(children);
    if (extracted && extractFenceLanguage(extracted.className) === "mermaid") {
      return (
        <MarkdownMermaidCodeBlock
          code={extracted.code}
          fenceTitle={extractFenceTitle(extracted.className?.replace(/language-\S+/, ""))}
        />
      );
    }
    return <MarkdownCodeBlock>{children}</MarkdownCodeBlock>;
  },
  table: MarkdownTable,
  blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => {
    const alertKind = (props as Record<string, unknown>)["data-alert"];
    const kind = typeof alertKind === "string" ? alertKind : undefined;
    if (isMarkdownAlert(kind)) {
      return (
        <MarkdownAlert kind={kind} dir={props.dir}>
          {props.children}
        </MarkdownAlert>
      );
    }
    return <blockquote {...props} />;
  },
  details:(props: ComponentPropsWithoutRef<"details">) => (
    <MarkdownDetails open={props.open} dir={props.dir}>
      {props.children}
    </MarkdownDetails>
  ),
  a: (props: ComponentPropsWithoutRef<"a">) => {
    // `#fragment` 是同一份文档里的锚点，不该新开窗口，也不该带站点图标。
    if (props.href?.startsWith("#")) {
      return <a {...props} />;
    }
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
