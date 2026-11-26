// 从 T3 的 client-runtime/work-log/presentation.ts 整段搬过来的分组摘要规则：
// 同一轮里按动作归类，最多取两组写进一句话（"Ran 3 commands and read 1 file"），
// 其余归到 "other actions"。只去掉了 i18n 解析器，文案保留英文复数形式。
export type ToolGroupAction =
  | "read"
  | "edit"
  | "command"
  | "search"
  | "code-search"
  | "browser"
  | "device"
  | "thread-create"
  | "other"
  | "update";

export interface SummaryEntry {
  name: string;
  detail?: string;
  status: string;
  exitCode?: number;
  /** 同一文件的多次修改算一次，T3 按 changedFiles 去重；这里用 detail 里的路径近似。 */
  changedPath?: string;
}

// T3 的复数只换词尾：文案里写 "{count} command(s)"，这里按数量取一个。
const withCount = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

const has = (value: string | undefined, test: RegExp) => Boolean(value && test.test(value));

/** 动作判定顺序照抄 T3：先看明确的读取/修改，再看命令，最后才是搜索与其它。 */
export function toolGroupAction(entry: SummaryEntry): ToolGroupAction {
  const name = entry.name.toLowerCase();
  const detail = entry.detail ?? "";
  if (/dynamic|tool$/.test(name) && !/(bash|shell|command|exec)/.test(name)) return "other";
  if (/(read|view|open_file|cat|list_dir|glob)/.test(name)) return "read";
  if (/(file|patch|write|edit|apply_patch|str_replace)/.test(name)) return "edit";
  if (/(bash|shell|command|exec|terminal|run)/.test(name) || /^\$ /.test(detail)) return "command";
  if (/(grep|search|find|rg)/.test(name) && /(web|fetch|browser)/.test(name)) return "search";
  if (/(grep|search|find|rg)/.test(name)) return "code-search";
  if (/(web|fetch|http|browser)/.test(name)) return "search";
  if (has(detail, /\.\w{1,5}\b/) && !has(detail, /\s-\w|\s--/)) return "read";
  return "other";
}

function actionCount(action: ToolGroupAction, entries: SummaryEntry[]): number {
  if (action !== "edit") return entries.length;
  const paths = new Set<string>();
  let unknown = 0;
  for (const entry of entries) {
    const path = entry.changedPath ?? /(?:^|\s)([\w./\\-]+\.\w{1,5})\b/.exec(entry.detail ?? "")?.[1];
    if (path) paths.add(path);
    else unknown += 1;
  }
  return paths.size + unknown;
}

function actionLabel(action: ToolGroupAction, count: number): string {
  switch (action) {
    case "read":
      return `Read ${withCount(count, "file")}`;
    case "edit":
      return `Changed ${withCount(count, "file")}`;
    case "command":
      return `Ran ${withCount(count, "command")}`;
    case "search":
      return `Searched the web ${withCount(count, "time")}`;
    case "code-search":
      return `Searched code ${withCount(count, "time")}`;
    case "browser":
      return `Used browser ${withCount(count, "time")}`;
    case "device":
      return `Used device controls ${withCount(count, "time")}`;
    case "thread-create":
      return `Created ${withCount(count, "thread")}`;
    case "update":
      return `Received ${withCount(count, "update")}`;
    case "other":
      return `Used ${withCount(count, "tool")}`;
  }
}

function priority(action: ToolGroupAction): number {
  if (action === "command" || action === "edit" || action === "thread-create") return 0;
  if (action === "other" || action === "update") return 2;
  return 1;
}

function joinClauses(items: string[]): string {
  if (items.length < 2) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

/** 一条摘要就是整组工具做了什么；失败与否单独返回，供 UI 着色。 */
export function summarizeToolGroup(entries: SummaryEntry[]): { summary: string; hasFailure: boolean } {
  if (entries.length === 0) return { summary: "", hasFailure: false };
  const groups = new Map<ToolGroupAction, SummaryEntry[]>();
  for (const entry of entries) {
    const action = toolGroupAction(entry);
    const group = groups.get(action);
    if (group) group.push(entry);
    else groups.set(action, [entry]);
  }
  const summaries = [...groups].map(([action, group], index) => ({
    index,
    count: group.length,
    priority: priority(action),
    label: actionLabel(action, actionCount(action, group)),
    failedCount: group.filter((entry) => entry.status === "error" || (entry.exitCode ?? 0) !== 0).length,
  }));
  const selected = [...summaries].sort((a, b) => a.priority - b.priority || a.index - b.index).slice(0, 2).sort((a, b) => a.index - b.index);
  const labels = selected.map(({ label }) => label);
  const remaining = entries.length - selected.reduce((count, group) => count + group.count, 0);
  if (remaining > 0) labels.push(`Performed ${withCount(remaining, "other action")}`);
  // 第二个从句只降第一个词的首字母；工具名这类专有词留在首句里不动。
  const lowerFirst = (label: string) => label.charAt(0).toLowerCase() + label.slice(1);
  const sentence = joinClauses(labels.map((label, index) => (index === 0 ? label : lowerFirst(label))));
  return { summary: sentence, hasFailure: summaries.some((group) => group.failedCount > 0) };
}

/** 组图标跟着主要动作走（T3 的 toolGroupSummaryIconName）。 */
export function toolGroupSummaryIcon(action: ToolGroupAction): "terminal" | "file" | "globe" | "wrench" | "eye" | "edit" {
  switch (action) {
    case "command":
      return "terminal";
    case "read":
      return "eye";
    case "edit":
      return "edit";
    case "search":
    case "code-search":
    case "browser":
      return "globe";
    case "other":
      return "wrench";
    default:
      return "file";
  }
}
