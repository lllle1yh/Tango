import { contextBridge, ipcRenderer, webUtils } from "electron";

type TerminalDataListener = (terminalId: string, data: string) => void;
type TerminalExitListener = (terminalId: string, exitCode: number) => void;
type CodexEventListener = (taskId: string, event: Record<string, unknown>) => void;
type AgentEventListener = (taskId: string, event: Record<string, unknown>) => void;
export type AppSettings = {
  theme: "light" | "dark";
  accent: string;
  chatWidth: "comfortable" | "wide";
  // 工具调用怎么显示：全部 / 只显示失败的 / Zen（不显示，只在运行时说 Thinking）
  toolDisplay: "all" | "failed" | "zen";
  defaultAgent: "codex" | "claude" | "dsh" | "pi";
  terminalShell: "powershell" | "gitbash" | "cmd";
  codexApprovalPolicy: "on-request" | "on-failure" | "never";
  codexSandbox: "read-only" | "workspace-write" | "danger-full-access";
  sidebarCollapsed: boolean;
  claudePermissionMode: "default" | "acceptEdits" | "auto" | "bypassPermissions" | "manual" | "dontAsk" | "plan";
};

export type WorkspaceLayout = {
  root: LayoutNode;
  activePaneId: string;
  // Names the user gave shells, keyed by pane id; optional so older layouts still load.
  labels?: Record<string, string>;
};
export type LayoutNode = { type: "pane"; id: string } | {
  type: "split";
  id: string;
  direction: "horizontal" | "vertical";
  ratio: number;
  first: LayoutNode;
  second: LayoutNode;
};

export type AppInfo = {
  version: string;
  platform: string;
  electron: string;
  node: string;
  dataFolder: string;
};

contextBridge.exposeInMainWorld("tango", {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke("app:info"),
  getWorkspace: (): Promise<string | null> => ipcRenderer.invoke("workspace:get"),
  openWorkspace: (): Promise<string | null> => ipcRenderer.invoke("workspace:open"),
  setWorkspace: (projectPath: string): Promise<string> => ipcRenderer.invoke("workspace:set", projectPath),
  detectAgents: (): Promise<AgentStatus[]> => ipcRenderer.invoke("agents:detect"),
  // T3 的 diff 统计与详情卡需要 Git 数据；Tango 用 git 命令补齐这一层。
  gitStatus: (projectPath: string): Promise<GitStatus> => ipcRenderer.invoke("git:status", projectPath),
  gitDiffStat: (projectPath: string, scope: "working" | "staged"): Promise<DiffStat> => ipcRenderer.invoke("git:diff-stat", projectPath, scope),
  gitDiff: (projectPath: string, scope: "working" | "staged"): Promise<DiffFile[]> => ipcRenderer.invoke("git:diff", projectPath, scope),
  detectMagpie: (): Promise<{ available: boolean; version: string | null }> => ipcRenderer.invoke("tools:magpie"),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke("settings:get"),
  runAppAction: (action: string): Promise<void> => ipcRenderer.invoke("app:action", action),
  onAppCommand: (listener: (command: "open-settings" | "new-task" | "open-project" | "show-shortcuts") => void): (() => void) => {
    const channels = ["app:open-settings", "app:new-task", "app:open-project", "app:show-shortcuts"] as const;
    const handles = channels.map((channel) => {
      const handle = () => listener(channel.replace("app:", "") as "open-settings" | "new-task" | "open-project" | "show-shortcuts");
      ipcRenderer.on(channel, handle);
      return () => ipcRenderer.removeListener(channel, handle);
    });
    return () => handles.forEach((remove) => remove());
  },
  saveSettings: (next: Partial<AppSettings>): Promise<AppSettings> => ipcRenderer.invoke("settings:save", next),
  revealDataFolder: (): Promise<void> => ipcRenderer.invoke("settings:reveal"),
  // 大段粘贴存成附件文件，让 Agent 按需读，而不是把整段撑进上下文。
  saveClip: (text: string): Promise<{ path: string; bytes: number }> => ipcRenderer.invoke("clip:save", text),
  // 拖进来的文件留在原处：只拿路径，不做复制。
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  projectFileExists: (projectPath: string, relativePath: string): Promise<{ exists: boolean }> =>
    ipcRenderer.invoke("files:exists", projectPath, relativePath),
  openProjectFile: (projectPath: string, relativePath: string): Promise<{ opened: string }> =>
    ipcRenderer.invoke("files:open", projectPath, relativePath),
  saveAttachment: (name: string, bytes: Uint8Array): Promise<{ path: string; bytes: number; name: string }> =>
    ipcRenderer.invoke("attachments:save", name, bytes),
  listTasks: (): Promise<TaskRecord[]> => ipcRenderer.invoke("tasks:list"),
  createTask: (title: string, projectPath: string): Promise<TaskRecord> =>
    ipcRenderer.invoke("tasks:create", title, projectPath),
  duplicateTask: (taskId: string): Promise<TaskRecord> =>
    ipcRenderer.invoke("tasks:duplicate", taskId),
  pinTask: (taskId: string, pinned: boolean): Promise<TaskRecord> =>
    ipcRenderer.invoke("tasks:pin", taskId, pinned),
  resetTaskSession: (taskId: string): Promise<TaskRecord> =>
    ipcRenderer.invoke("tasks:reset-session", taskId),
  clearTaskRunning: (taskId: string): Promise<TaskRecord | null> =>
    ipcRenderer.invoke("tasks:clear-running", taskId),
  reorderTasks: (taskIds: string[]): Promise<TaskRecord[]> =>
    ipcRenderer.invoke("tasks:reorder", taskIds),
  renameTask: (taskId: string, title: string): Promise<TaskRecord> =>
    ipcRenderer.invoke("tasks:rename", taskId, title),
  archiveTask: (taskId: string, archived: boolean): Promise<TaskRecord> =>
    ipcRenderer.invoke("tasks:archive", taskId, archived),
  deleteTask: (taskId: string): Promise<{ deleted: string }> =>
    ipcRenderer.invoke("tasks:delete", taskId),
  codexStart: (taskId: string, projectPath: string, prompt: string): Promise<string> =>
    ipcRenderer.invoke("codex:start", taskId, projectPath, prompt),
  codexSend: (taskId: string, prompt: string): Promise<void> =>
    ipcRenderer.invoke("codex:send", taskId, prompt),
  codexInterrupt: (taskId: string): Promise<void> =>
    ipcRenderer.invoke("codex:interrupt", taskId),
  codexRespondPermission: (taskId: string, requestId: number, optionId: string | null): Promise<void> =>
    ipcRenderer.invoke("codex:permission", taskId, requestId, optionId),
  onCodexEvent: (listener: CodexEventListener): (() => void) => {
    const handle = (_event: Electron.IpcRendererEvent, taskId: string, payload: Record<string, unknown>) =>
      listener(taskId, payload);
    ipcRenderer.on("codex:event", handle);
    return () => ipcRenderer.removeListener("codex:event", handle);
  },
  runClaude: (taskId: string, projectPath: string, prompt: string): Promise<{ sessionId: string; answer: string; sessionReset?: boolean; usage?: { model: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens?: number; maxContextTokens?: number; costUsd: number } | null }> =>
    ipcRenderer.invoke("claude:run", taskId, projectPath, prompt),
  claudeInterrupt: (taskId: string): Promise<void> =>
    ipcRenderer.invoke("claude:interrupt", taskId),
  onClaudeEvent: (listener: AgentEventListener): (() => void) => {
    const handle = (_event: Electron.IpcRendererEvent, taskId: string, payload: Record<string, unknown>) =>
      listener(taskId, payload);
    ipcRenderer.on("claude:event", handle);
    return () => ipcRenderer.removeListener("claude:event", handle);
  },
  runDsh: (taskId: string, projectPath: string, prompt: string): Promise<{ sessionId: string; answer: string; stopReason: string }> =>
    ipcRenderer.invoke("dsh:run", taskId, projectPath, prompt),
  dshInterrupt: (taskId: string): Promise<void> =>
    ipcRenderer.invoke("dsh:interrupt", taskId),
  dshRespondPermission: (taskId: string, requestId: number, optionId: string | null): Promise<void> =>
    ipcRenderer.invoke("dsh:permission", taskId, requestId, optionId),
  onDshEvent: (listener: AgentEventListener): (() => void) => {
    const handle = (_event: Electron.IpcRendererEvent, taskId: string, payload: Record<string, unknown>) =>
      listener(taskId, payload);
    ipcRenderer.on("dsh:event", handle);
    return () => ipcRenderer.removeListener("dsh:event", handle);
  },
  getPiCommands: (projectPath: string): Promise<Array<{ name: string; description?: string }>> =>
    ipcRenderer.invoke("pi:commands", projectPath),
  runPi: (taskId: string, projectPath: string, prompt: string): Promise<{ sessionFile: string; answer: string; aborted: boolean }> =>
    ipcRenderer.invoke("pi:run", taskId, projectPath, prompt),
  piInterrupt: (taskId: string): Promise<void> =>
    ipcRenderer.invoke("pi:interrupt", taskId),
  piRespondUi: (taskId: string, requestId: string, optionId: string | null, text?: string): Promise<void> =>
    ipcRenderer.invoke("pi:ui-response", taskId, requestId, optionId, text),
  onPiEvent: (listener: AgentEventListener): (() => void) => {
    const handle = (_event: Electron.IpcRendererEvent, taskId: string, payload: Record<string, unknown>) =>
      listener(taskId, payload);
    ipcRenderer.on("pi:event", handle);
    return () => ipcRenderer.removeListener("pi:event", handle);
  },
  getLayout: (): Promise<WorkspaceLayout | null> =>
    ipcRenderer.invoke("layout:get"),
  saveLayout: (layout: WorkspaceLayout): Promise<void> =>
    ipcRenderer.invoke("layout:save", layout),
  startTerminal: (projectPath: string, terminalId: string): Promise<void> =>
    ipcRenderer.invoke("terminal:start", projectPath, terminalId),
  writeTerminal: (terminalId: string, data: string): void =>
    ipcRenderer.send("terminal:write", terminalId, data),
  resizeTerminal: (terminalId: string, cols: number, rows: number): void =>
    ipcRenderer.send("terminal:resize", terminalId, cols, rows),
  closeTerminal: (terminalId: string): void =>
    ipcRenderer.send("terminal:close", terminalId),
  onTerminalData: (listener: TerminalDataListener): (() => void) => {
    const handle = (_event: Electron.IpcRendererEvent, terminalId: string, data: string) =>
      listener(terminalId, data);
    ipcRenderer.on("terminal:data", handle);
    return () => ipcRenderer.removeListener("terminal:data", handle);
  },
  onTerminalExit: (listener: TerminalExitListener): (() => void) => {
    const handle = (_event: Electron.IpcRendererEvent, terminalId: string, exitCode: number) =>
      listener(terminalId, exitCode);
    ipcRenderer.on("terminal:exit", handle);
    return () => ipcRenderer.removeListener("terminal:exit", handle);
  },
});

export interface GitStatus {
  isRepo: boolean;
  branch: string | null;
  ahead: number;
  behind: number;
  upstream: string | null;
  changedFiles: number;
  error: string | null;
}

export interface DiffStat {
  additions: number;
  deletions: number;
  error: string | null;
}

// One changed file as unified diff: the raw patch text plus its parsed hunks,
// so the renderer can lay out rows without re-parsing in JS.
export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: Array<{ kind: "add" | "del" | "ctx" | "meta"; text: string; oldNo: number | null; newNo: number | null }>;
}

export interface DiffFile {
  path: string;
  oldPath: string | null;
  status: "added" | "deleted" | "modified" | "renamed";
  binary: boolean;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface AgentStatus {
  id: "codex" | "claude" | "dsh" | "pi";
  name: string;
  available: boolean;
  version: string | null;
}

export interface TaskRecord {
  id: string;
  title: string;
  projectPath: string;
  archived?: boolean;
  pinned?: boolean;
  running?: { agent: string; startedAt: string };
  threadId?: string;
  claudeSessionId?: string;
  dshSessionId?: string;
  piSessionFile?: string;
  messages: Array<{
    role: "user" | "assistant";
    text: string;
    agent: string;
    createdAt: string;
    tools?: Array<{ id: string; name: string; status: string; detail?: string; exitCode?: number }>;
    sessionReset?: boolean;
    usage?: { model: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens?: number; maxContextTokens?: number; costUsd: number };
  }>;
}

export interface TangoApi {
  getAppInfo(): Promise<AppInfo>;
  getWorkspace(): Promise<string | null>;
  openWorkspace(): Promise<string | null>;
  setWorkspace(projectPath: string): Promise<string>;
  detectAgents(): Promise<AgentStatus[]>;
  gitStatus(projectPath: string): Promise<GitStatus>;
  gitDiffStat(projectPath: string, scope: "working" | "staged"): Promise<DiffStat>;
  gitDiff(projectPath: string, scope: "working" | "staged"): Promise<DiffFile[]>;
  detectMagpie(): Promise<{ available: boolean; version: string | null }>;
  getSettings(): Promise<AppSettings>;
  runAppAction(action: string): Promise<void>;
  onAppCommand(listener: (command: "open-settings" | "new-task" | "open-project" | "show-shortcuts") => void): () => void;
  saveSettings(next: Partial<AppSettings>): Promise<AppSettings>;
  revealDataFolder(): Promise<void>;
  saveClip(text: string): Promise<{ path: string; bytes: number }>;
  getPathForFile(file: File): string;
  saveAttachment(name: string, bytes: Uint8Array): Promise<{ path: string; bytes: number; name: string }>;
  openProjectFile(projectPath: string, relativePath: string): Promise<{ opened: string }>;
  projectFileExists(projectPath: string, relativePath: string): Promise<{ exists: boolean }>;
  listTasks(): Promise<TaskRecord[]>;
  createTask(title: string, projectPath: string): Promise<TaskRecord>;
  duplicateTask(taskId: string): Promise<TaskRecord>;
  pinTask(taskId: string, pinned: boolean): Promise<TaskRecord>;
  resetTaskSession(taskId: string): Promise<TaskRecord>;
  clearTaskRunning(taskId: string): Promise<TaskRecord | null>;
  reorderTasks(taskIds: string[]): Promise<TaskRecord[]>;
  renameTask(taskId: string, title: string): Promise<TaskRecord>;
  archiveTask(taskId: string, archived: boolean): Promise<TaskRecord>;
  deleteTask(taskId: string): Promise<{ deleted: string }>;
  codexStart(taskId: string, projectPath: string, prompt: string): Promise<string>;
  codexSend(taskId: string, prompt: string): Promise<void>;
  codexInterrupt(taskId: string): Promise<void>;
  codexRespondPermission(taskId: string, requestId: number, optionId: string | null): Promise<void>;
  onCodexEvent(listener: (taskId: string, event: Record<string, unknown>) => void): () => void;
  runClaude(taskId: string, projectPath: string, prompt: string): Promise<{ sessionId: string; answer: string; sessionReset?: boolean; usage?: { model: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens?: number; maxContextTokens?: number; costUsd: number } | null }>;
  claudeInterrupt(taskId: string): Promise<void>;
  onClaudeEvent(listener: (taskId: string, event: Record<string, unknown>) => void): () => void;
  runDsh(taskId: string, projectPath: string, prompt: string): Promise<{ sessionId: string; answer: string; stopReason: string }>;
  dshInterrupt(taskId: string): Promise<void>;
  dshRespondPermission(taskId: string, requestId: number, optionId: string | null): Promise<void>;
  onDshEvent(listener: (taskId: string, event: Record<string, unknown>) => void): () => void;
  getPiCommands(projectPath: string): Promise<Array<{ name: string; description?: string }>>;
  runPi(taskId: string, projectPath: string, prompt: string): Promise<{ sessionFile: string; answer: string; aborted: boolean }>;
  piInterrupt(taskId: string): Promise<void>;
  piRespondUi(taskId: string, requestId: string, optionId: string | null, text?: string): Promise<void>;
  onPiEvent(listener: (taskId: string, event: Record<string, unknown>) => void): () => void;
  getLayout(): Promise<WorkspaceLayout | null>;
  saveLayout(layout: WorkspaceLayout): Promise<void>;
  startTerminal(projectPath: string, terminalId: string): Promise<void>;
  writeTerminal(terminalId: string, data: string): void;
  resizeTerminal(terminalId: string, cols: number, rows: number): void;
  closeTerminal(terminalId: string): void;
  onTerminalData(listener: (terminalId: string, data: string) => void): () => void;
  onTerminalExit(listener: (terminalId: string, exitCode: number) => void): () => void;
}
