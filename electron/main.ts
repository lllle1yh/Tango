import { app, BrowserWindow, dialog, ipcMain, Menu, type IpcMainEvent, type IpcMainInvokeEvent } from "electron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn, type IPty } from "@homebridge/node-pty-prebuilt-multiarch";

const execFileAsync = promisify(execFile);
const workspaceFile = () => path.join(app.getPath("userData"), "workspace.json");
let mainWindow: BrowserWindow | null = null;
const terminals = new Map<string, IPty>();

const agents = [
  { id: "codex", name: "Codex", command: "codex", args: ["--version"] },
  { id: "claude", name: "Claude Code", command: "claude", args: ["--version"] },
  { id: "dsh", name: "DSH", command: "dsh", args: ["--version"] },
  { id: "pi", name: "Pi", command: "pi", args: ["--version"] },
] as const;

async function inspectAgent(agent: (typeof agents)[number]) {
  try {
    const executable = process.platform === "win32" ? "cmd.exe" : agent.command;
    const args = process.platform === "win32"
      ? ["/d", "/s", "/c", agent.command + " " + agent.args.join(" ")]
      : agent.args;
    const { stdout } = await execFileAsync(executable, args, {
      timeout: 3000,
      windowsHide: true,
    });
    return {
      id: agent.id,
      name: agent.name,
      available: true,
      version: stdout.trim().split(/\r?\n/)[0] || "CLI detected",
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    const stdout = (error as { stdout?: string }).stdout?.trim();
    if (code !== "ENOENT" && stdout) {
      return { id: agent.id, name: agent.name, available: true, version: stdout.split(/\r?\n/)[0] };
    }
    return { id: agent.id, name: agent.name, available: false, version: null };
  }
}

async function readLastWorkspace(): Promise<string | null> {
  try {
    const contents = await readFile(workspaceFile(), "utf8");
    const state = JSON.parse(contents) as { projectPath?: unknown };
    return typeof state.projectPath === "string" ? state.projectPath : null;
  } catch {
    return null;
  }
}

function registerIpc() {
  ipcMain.handle("workspace:get", (event: IpcMainInvokeEvent) => {
    assertTrustedSender(event);
    return readLastWorkspace();
  });
  ipcMain.handle("workspace:open", async (event: IpcMainInvokeEvent) => {
    assertTrustedSender(event);
    const result = await dialog.showOpenDialog({
      title: "Open project folder",
      properties: ["openDirectory", "createDirectory"],
    });
    const projectPath = result.filePaths[0];
    if (result.canceled || !projectPath) return null;

    await writeFile(workspaceFile(), JSON.stringify({ projectPath }, null, 2), "utf8");
    return projectPath;
  });
  ipcMain.handle("agents:detect", (event: IpcMainInvokeEvent) => {
    assertTrustedSender(event);
    return Promise.all(agents.map(inspectAgent));
  });
  ipcMain.handle("terminal:start", async (event: IpcMainInvokeEvent, requestedPath: string, terminalId: string) => {
    assertTrustedSender(event);
    if (typeof terminalId !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(terminalId)) {
      throw new Error("Invalid terminal identifier");
    }
    if (terminals.has(terminalId)) throw new Error("Terminal already exists");
    const savedPath = await readLastWorkspace();
    if (!savedPath) throw new Error("Open a project folder before starting a terminal");

    const root = await realpath(savedPath);
    const requested = await realpath(requestedPath);
    const relative = path.relative(root, requested);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Terminal directory must be inside the selected project");
    }
    if (!(await stat(requested)).isDirectory()) throw new Error("Terminal path is not a directory");

    const shell = path.join(
      process.env.SystemRoot || "C:\\Windows",
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    );
    const terminal = spawn(shell, [], {
      name: "xterm-256color",
      cols: 100,
      rows: 30,
      cwd: requested,
      env: { ...process.env, TERM: "xterm-256color" } as Record<string, string>,
      useConpty: true,
      conptyInheritCursor: true,
    });
    terminals.set(terminalId, terminal);
    terminal.onData((data) => {
      if (!mainWindow?.isDestroyed()) mainWindow?.webContents.send("terminal:data", terminalId, data);
    });
    terminal.onExit(({ exitCode }) => {
      terminals.delete(terminalId);
      if (!mainWindow?.isDestroyed()) mainWindow?.webContents.send("terminal:exit", terminalId, exitCode);
    });
  });
  ipcMain.on("terminal:write", (event, terminalId: string, data: string) => {
    assertTrustedSender(event);
    if (typeof data === "string" && data.length <= 32768) terminals.get(terminalId)?.write(data);
  });
  ipcMain.on("terminal:resize", (event, terminalId: string, cols: number, rows: number) => {
    assertTrustedSender(event);
    if (Number.isInteger(cols) && Number.isInteger(rows) && cols >= 2 && rows >= 1 && cols <= 500 && rows <= 300) {
      terminals.get(terminalId)?.resize(cols, rows);
    }
  });
  ipcMain.on("terminal:close", (event, terminalId: string) => {
    assertTrustedSender(event);
    terminals.get(terminalId)?.kill();
  });
}

function assertTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent) {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) {
    throw new Error("Untrusted IPC sender");
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1420,
    height: 920,
    minWidth: 980,
    minHeight: 640,
    icon: path.join(app.getAppPath(), "assets", "tango-icon.png"),
    backgroundColor: "#f4f0e7",
    title: "Tango",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (app.isPackaged) {
    void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    void mainWindow.loadURL("http://127.0.0.1:5173");
  }
  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  for (const terminal of terminals.values()) terminal.kill();
  terminals.clear();
  if (process.platform !== "darwin") app.quit();
});
