import { contextBridge, ipcRenderer } from "electron";

type TerminalDataListener = (terminalId: string, data: string) => void;
type TerminalExitListener = (terminalId: string, exitCode: number) => void;
type CodexEventListener = (taskId: string, event: Record<string, unknown>) => void;
type AgentEventListener = (taskId: string, event: Record<string, unknown>) => void;
export type AppSettings = {
  theme: "light" | "dark";
  accent: string;
  chatWidth: "comfortable" | "wide";
  defaultAgent: "codex" | "claude" | "dsh" | "pi";
  terminalShell: "powershell" | "gitbash" | "cmd";
  codexApprovalPolicy: "on-request" | "on-failure" | "never";
  codexSandbox: "read-only" | "workspace-write" | "danger-full-access";
  sidebarCollapsed: boolean;
};

export type WorkspaceLayout = {
  root: LayoutNode;
  activePaneId: string;
};
export type LayoutNode = { type: "pane"; id: string } | {
  type: "split";
  id: string;
  direction: "horizontal" | "vertical";
  ratio: number;
  first: LayoutNode;
  second: LayoutNode;
};

contextBridge.exposeInMainWorld("tango", {
  getWorkspace: (): Promise<string | null> => ipcRenderer.invoke("workspace:get"),
  openWorkspace: (): Promise<string | null> => ipcRenderer.invoke("workspace:open"),
  detectAgents: (): Promise<AgentStatus[]> => ipcRenderer.invoke("agents:detect"),
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
  listTasks: (): Promise<TaskRecord[]> => ipcRenderer.invoke("tasks:list"),
  createTask: (title: string, projectPath: string): Promise<TaskRecord> =>
    ipcRenderer.invoke("tasks:create", title, projectPath),
  pinTask: (taskId: string, pinned: boolean): Promise<TaskRecord> =>
    ipcRenderer.invoke("tasks:pin", taskId, pinned),
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
  runClaude: (taskId: string, projectPath: string, prompt: string): Promise<{ sessionId: string; answer: string }> =>
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
  messages: Array<{ role: "user" | "assistant"; text: string; agent: string; createdAt: string }>;
}

export interface TangoApi {
  getWorkspace(): Promise<string | null>;
  openWorkspace(): Promise<string | null>;
  detectAgents(): Promise<AgentStatus[]>;
  detectMagpie(): Promise<{ available: boolean; version: string | null }>;
  getSettings(): Promise<AppSettings>;
  runAppAction(action: string): Promise<void>;
  onAppCommand(listener: (command: "open-settings" | "new-task" | "open-project" | "show-shortcuts") => void): () => void;
  saveSettings(next: Partial<AppSettings>): Promise<AppSettings>;
  revealDataFolder(): Promise<void>;
  listTasks(): Promise<TaskRecord[]>;
  createTask(title: string, projectPath: string): Promise<TaskRecord>;
  pinTask(taskId: string, pinned: boolean): Promise<TaskRecord>;
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
  runClaude(taskId: string, projectPath: string, prompt: string): Promise<{ sessionId: string; answer: string }>;
  claudeInterrupt(taskId: string): Promise<void>;
  onClaudeEvent(listener: (taskId: string, event: Record<string, unknown>) => void): () => void;
  runDsh(taskId: string, projectPath: string, prompt: string): Promise<{ sessionId: string; answer: string; stopReason: string }>;
  dshInterrupt(taskId: string): Promise<void>;
  dshRespondPermission(taskId: string, requestId: number, optionId: string | null): Promise<void>;
  onDshEvent(listener: (taskId: string, event: Record<string, unknown>) => void): () => void;
  getPiCommands(projectPath: string): Promise<Array<{ name: string; description?: string }>>;
  runPi(taskId: string, projectPath: string, prompt: string): Promise<{ sessionFile: string; answer: string; aborted: boolean }>;
  piInterrupt(taskId: string): Promise<void>;
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
