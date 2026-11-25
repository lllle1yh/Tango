import { contextBridge, ipcRenderer } from "electron";

type TerminalDataListener = (terminalId: string, data: string) => void;
type TerminalExitListener = (terminalId: string, exitCode: number) => void;
type CodexEventListener = (taskId: string, event: Record<string, unknown>) => void;
type AgentEventListener = (taskId: string, event: Record<string, unknown>) => void;
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
  listTasks: (): Promise<TaskRecord[]> => ipcRenderer.invoke("tasks:list"),
  createTask: (title: string, projectPath: string): Promise<TaskRecord> =>
    ipcRenderer.invoke("tasks:create", title, projectPath),
  codexStart: (taskId: string, projectPath: string, prompt: string): Promise<string> =>
    ipcRenderer.invoke("codex:start", taskId, projectPath, prompt),
  codexSend: (taskId: string, prompt: string): Promise<void> =>
    ipcRenderer.invoke("codex:send", taskId, prompt),
  codexInterrupt: (taskId: string): Promise<void> =>
    ipcRenderer.invoke("codex:interrupt", taskId),
  onCodexEvent: (listener: CodexEventListener): (() => void) => {
    const handle = (_event: Electron.IpcRendererEvent, taskId: string, payload: Record<string, unknown>) =>
      listener(taskId, payload);
    ipcRenderer.on("codex:event", handle);
    return () => ipcRenderer.removeListener("codex:event", handle);
  },
  runClaude: (taskId: string, projectPath: string, prompt: string): Promise<{ sessionId: string; answer: string }> =>
    ipcRenderer.invoke("claude:run", taskId, projectPath, prompt),
  onClaudeEvent: (listener: AgentEventListener): (() => void) => {
    const handle = (_event: Electron.IpcRendererEvent, taskId: string, payload: Record<string, unknown>) =>
      listener(taskId, payload);
    ipcRenderer.on("claude:event", handle);
    return () => ipcRenderer.removeListener("claude:event", handle);
  },
  runDsh: (taskId: string, projectPath: string, prompt: string): Promise<{ sessionId: string; answer: string }> =>
    ipcRenderer.invoke("dsh:run", taskId, projectPath, prompt),
  onDshEvent: (listener: AgentEventListener): (() => void) => {
    const handle = (_event: Electron.IpcRendererEvent, taskId: string, payload: Record<string, unknown>) =>
      listener(taskId, payload);
    ipcRenderer.on("dsh:event", handle);
    return () => ipcRenderer.removeListener("dsh:event", handle);
  },
  runPi: (taskId: string, projectPath: string, prompt: string): Promise<{ sessionFile: string; answer: string }> =>
    ipcRenderer.invoke("pi:run", taskId, projectPath, prompt),
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
  listTasks(): Promise<TaskRecord[]>;
  createTask(title: string, projectPath: string): Promise<TaskRecord>;
  codexStart(taskId: string, projectPath: string, prompt: string): Promise<string>;
  codexSend(taskId: string, prompt: string): Promise<void>;
  codexInterrupt(taskId: string): Promise<void>;
  onCodexEvent(listener: (taskId: string, event: Record<string, unknown>) => void): () => void;
  runClaude(taskId: string, projectPath: string, prompt: string): Promise<{ sessionId: string; answer: string }>;
  onClaudeEvent(listener: (taskId: string, event: Record<string, unknown>) => void): () => void;
  runDsh(taskId: string, projectPath: string, prompt: string): Promise<{ sessionId: string; answer: string }>;
  onDshEvent(listener: (taskId: string, event: Record<string, unknown>) => void): () => void;
  runPi(taskId: string, projectPath: string, prompt: string): Promise<{ sessionFile: string; answer: string }>;
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
