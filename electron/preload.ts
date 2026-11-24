import { contextBridge, ipcRenderer } from "electron";

type TerminalDataListener = (terminalId: string, data: string) => void;
type TerminalExitListener = (terminalId: string, exitCode: number) => void;

contextBridge.exposeInMainWorld("tango", {
  getWorkspace: (): Promise<string | null> => ipcRenderer.invoke("workspace:get"),
  openWorkspace: (): Promise<string | null> => ipcRenderer.invoke("workspace:open"),
  detectAgents: (): Promise<AgentStatus[]> => ipcRenderer.invoke("agents:detect"),
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

export interface TangoApi {
  getWorkspace(): Promise<string | null>;
  openWorkspace(): Promise<string | null>;
  detectAgents(): Promise<AgentStatus[]>;
  startTerminal(projectPath: string, terminalId: string): Promise<void>;
  writeTerminal(terminalId: string, data: string): void;
  resizeTerminal(terminalId: string, cols: number, rows: number): void;
  closeTerminal(terminalId: string): void;
  onTerminalData(listener: (terminalId: string, data: string) => void): () => void;
  onTerminalExit(listener: (terminalId: string, exitCode: number) => void): () => void;
}
