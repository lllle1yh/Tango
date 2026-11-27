import { Children, isValidElement, type ReactNode } from "react";

// 搬自 T3 的 MarkdownCodeBlock.logic：从围栏代码块里取出语言和文件名。
// T3 用 Shiki，Tango 用 rehype-highlight，但「这一块是什么语言 / 哪个文件」
// 的信息来源相同：code 元素的 language-* 类名和围栏后的 meta。

const CODE_FENCE_LANGUAGE_REGEX = /(?:^|\s)language-([^\s]+)/;

export function extractFenceLanguage(className: string | undefined): string {
  const match = className?.match(CODE_FENCE_LANGUAGE_REGEX);
  return match?.[1] ?? "text";
}

const FENCE_TITLE_ATTR_REGEX = /(?:^|\s)(?:title|file(?:name)?)=(?:"([^"]+)"|'([^']+)'|(\S+))/i;
const FENCE_FILENAME_TOKEN_REGEX = /^[\w@][\w@./-]*\.[A-Za-z0-9]+$/;

export function extractFenceTitle(meta: string | undefined): string | null {
  if (!meta) return null;
  const attrMatch = FENCE_TITLE_ATTR_REGEX.exec(meta);
  const attrTitle = attrMatch?.[1] ?? attrMatch?.[2] ?? attrMatch?.[3];
  if (attrTitle) return attrTitle;
  return meta.split(/\s+/).find((candidate) => FENCE_FILENAME_TOKEN_REGEX.test(candidate)) ?? null;
}

export function nodeToPlainText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map((child) => nodeToPlainText(child)).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeToPlainText(node.props.children);
  return "";
}

export function extractCodeBlock(
  children: ReactNode,
): { className: string | undefined; code: string } | null {
  const childNodes = Children.toArray(children);
  if (childNodes.length !== 1) return null;
  const onlyChild = childNodes[0];
  if (!isValidElement<{ className?: string; children?: ReactNode; node?: { tagName?: string } }>(onlyChild)) {
    return null;
  }
  if (onlyChild.type !== "code" && onlyChild.props.node?.tagName !== "code") return null;
  return { className: onlyChild.props.className, code: nodeToPlainText(onlyChild.props.children) };
}

/** 把代码块写成 Markdown 围栏（复制整段消息时用），内容里有 ``` 就加长围栏。 */
export function serializeCodeBlockToMarkdown(source: string, language: string | null): string {
  const code = source.replace(/\n$/, "");
  const longestRun = Math.max(0, ...Array.from(code.matchAll(/`+/g), (match) => match[0].length));
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  return `${fence}${language ?? ""}\n${code}\n${fence}\n\n`;
}
