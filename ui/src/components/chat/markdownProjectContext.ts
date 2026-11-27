// 消息里的文件路径要知道它们属于哪个项目才能打开。T3 把 cwd 一层层传给 ChatMarkdown；
// Tango 的 Markdown 在多处渲染（时间线、用户消息、流式输出），用一个上下文传一次即可。
import { createContext, useContext } from "react";

export const MarkdownProjectContext = createContext<string | null>(null);

export function useMarkdownProjectPath(): string | null {
  return useContext(MarkdownProjectContext);
}
