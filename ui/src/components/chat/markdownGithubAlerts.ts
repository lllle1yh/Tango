// 搬自 T3 packages/shared/src/markdownGithubAlerts.ts：
// 把 GitHub 的 > [!NOTE] / [!WARNING] 一类引用块标成 data-alert，
// 交给 MarkdownAlert 渲染成带图标和颜色的提示块。没改逻辑，只加了说明。
interface MarkdownAstNode {
  type?: string;
  value?: unknown;
  data?: {
    hProperties?: Record<string, unknown>;
  };
  children?: MarkdownAstNode[];
}

export const GITHUB_ALERT_MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\r?\n|$)/i;

function readGithubAlert(node: MarkdownAstNode): void {
  if (node.type !== "blockquote") return;
  const paragraph = node.children?.[0];
  const text = paragraph?.children?.[0];
  if (paragraph?.type !== "paragraph" || text?.type !== "text" || typeof text.value !== "string") {
    return;
  }
  const match = GITHUB_ALERT_MARKER.exec(text.value);
  if (!match?.[1]) return;

  const remainder = text.value.slice(match[0].length);
  // 标记后面如果空着，正文可能在下一个兄弟节点里；要保留“标记是否独占一行”的信息。
  const markerEndsItsLine = match[0].endsWith("\n");
  if (remainder.length > 0) {
    text.value = remainder;
  } else if (markerEndsItsLine || paragraph.children?.length === 1) {
    paragraph.children?.shift();
    if (paragraph.children?.length === 0) {
      node.children?.shift();
    }
  } else {
    return;
  }

  node.data = {
    ...node.data,
    hProperties: {
      ...node.data?.hProperties,
      dataAlert: match[1].toLowerCase(),
    },
  };
}

export function remarkGithubAlerts() {
  return (tree: MarkdownAstNode) => {
    const visit = (node: MarkdownAstNode) => {
      node.children?.forEach(visit);
      readGithubAlert(node);
    };
    visit(tree);
  };
}
