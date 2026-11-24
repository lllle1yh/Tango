import { app, BrowserWindow, dialog, ipcMain, Menu, type IpcMainEvent, type IpcMainInvokeEvent } from "electron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, realpath, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn, type IPty } from "@homebridge/node-pty-prebuilt-multiarch";

const execFileAsync = promisify(execFile);
const workspaceFile = () => path.join(app.getPath("userData"), "workspace.json");
let mainWindow: BrowserWindow | null = null;
const terminals = new Map<string, IPty>();
const codexProcesses = new Map<string, ReturnType<typeof createCodexClient>>();
const claudeProcesses = new Map<string, ReturnType<typeof createClaudeClient>>();

type TaskRecord = {
  id: string;
  title: string;
  projectPath: string;
  threadId?: string;
  claudeSessionId?: string;
  messages: Array<{ role: "user" | "assistant"; text: string; agent: string; createdAt: string }>;
};

function tasksFile() {
  return path.join(app.getPath("userData"), "tasks.json");
}

async function readTasks(): Promise<TaskRecord[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(tasksFile(), "utf8"));
    return Array.isArray(parsed) ? parsed as TaskRecord[] : [];
  } catch {
    return [];
  }
}

async function saveTasks(tasks: TaskRecord[]) {
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(tasksFile(), JSON.stringify(tasks, null, 2), "utf8");
}

function createCodexClient(taskId: string) {
  const child = require("node:child_process").spawn("codex", ["app-server"], {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  }) as import("node:child_process").ChildProcessWithoutNullStreams;
  let nextId = 1;
  const pending = new Map<number, { resolve(value: any): void; reject(error: Error): void }>();
  let buffer = "";
  let threadId: string | undefined;
  let turnId: string | undefined;

  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line) continue;
      let message: any;
      try { message = JSON.parse(line); } catch { continue; }
      if (typeof message.id === "number" && pending.has(message.id)) {
        const waiter = pending.get(message.id)!;
        pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.error.message ?? "Codex request failed"));
        else waiter.resolve(message.result);
      } else if (typeof message.method === "string") {
        if (message.method === "item/agentMessage/delta") {
          sendCodexEvent(taskId, { type: "delta", text: message.params?.delta ?? "" });
        } else if (message.method === "item/started" || message.method === "item/completed") {
          sendCodexEvent(taskId, { type: message.method, item: message.params?.item });
        } else if (message.method === "turn/completed") {
          const turn = message.params?.turn;
          const answer = Array.isArray(turn?.items)
            ? turn.items.filter((item: any) => item.type === "agentMessage").map((item: any) => item.text ?? "").join("")
            : "";
          if (answer) {
            void readTasks().then(async (tasks) => {
              const task = tasks.find((item) => item.id === taskId);
              if (!task) return;
              task.messages.push({ role: "assistant", text: answer, agent: "codex", createdAt: new Date().toISOString() });
              await saveTasks(tasks);
            });
          }
          sendCodexEvent(taskId, { type: "turn/completed", turn });
          turnId = undefined;
        } else if (message.method === "serverRequest/resolved") {
          sendCodexEvent(taskId, { type: message.method, params: message.params });
        } else {
          sendCodexEvent(taskId, { type: message.method, params: message.params });
        }
      }
    }
  });
  child.stderr.on("data", () => {});
  child.on("exit", (code) => {
    codexProcesses.delete(taskId);
    sendCodexEvent(taskId, { type: "process/exit", code });
    for (const waiter of pending.values()) waiter.reject(new Error("Codex app server exited"));
    pending.clear();
  });

  function request(method: string, params: unknown) {
    const id = nextId++;
    return new Promise<any>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      child.stdin.write(JSON.stringify({ id, method, params }) + "\n", (error) => {
        if (error) {
          pending.delete(id);
          reject(error);
        }
      });
    });
  }

  async function initialize() {
    await request("initialize", {
      clientInfo: { name: "tango", version: app.getVersion() },
      capabilities: { experimentalApi: true },
    });
    child.stdin.write(JSON.stringify({ method: "initialized", params: {} }) + "\n");
  }

  async function start(projectPath: string, prompt: string) {
    if (!threadId) {
      const thread = await request("thread/start", { cwd: projectPath, approvalPolicy: "on-request", sandbox: "workspace-write" });
      threadId = thread.thread.id;
    }
    const turn = await request("turn/start", { threadId, input: [{ type: "text", text: prompt }] });
    turnId = turn.turn.id;
    return { threadId };
  }

  async function send(prompt: string) {
    if (!threadId) throw new Error("Codex thread has not started");
    const turn = await request("turn/start", { threadId, input: [{ type: "text", text: prompt }] });
    turnId = turn.turn.id;
  }

  async function interrupt() {
    if (threadId && turnId) await request("turn/interrupt", { threadId, turnId });
  }

  async function resume(savedThreadId: string) {
    const result = await request("thread/resume", { threadId: savedThreadId });
    threadId = result.thread.id;
  }

  return { initialize, start, send, interrupt, resume, get threadId() { return threadId; }, dispose: () => child.kill() };
}

function sendCodexEvent(taskId: string, payload: Record<string, unknown>) {
  if (!mainWindow?.isDestroyed()) mainWindow?.webContents.send("codex:event", taskId, payload);
}

function createClaudeClient(taskId: string, projectPath: string, resumeId?: string) {
  const args = ["-p", "--verbose", "--input-format", "stream-json", "--output-format", "stream-json", "--include-partial-messages"];
  if (resumeId) args.push("--resume", resumeId);
  const child = require("node:child_process").spawn(
    process.platform === "win32" ? "cmd.exe" : "claude",
    process.platform === "win32" ? ["/d", "/s", "/c", "claude " + args.join(" ")] : args,
    { cwd: projectPath, stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
  ) as import("node:child_process").ChildProcessWithoutNullStreams;
  let buffer = "";
  const resultWaiters: Array<{ resolve(text: string): void; reject(error: Error): void }> = [];
  let sessionId = resumeId ?? "";
  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line) continue;
      let event: any;
      try { event = JSON.parse(line); } catch { continue; }
      if (event.session_id) sessionId = event.session_id;
      if (event.type === "stream_event") {
        const delta = event.event?.delta?.text;
        if (typeof delta === "string") sendClaudeEvent(taskId, { type: "delta", text: delta });
      }
      if (event.type === "result") {
        if (event.is_error) resultWaiters.shift()?.reject(new Error(event.result ?? "Claude Code turn failed"));
        else resultWaiters.shift()?.resolve(String(event.result ?? ""));
        sendClaudeEvent(taskId, { type: "turn/completed", sessionId, text: event.result ?? "" });
      }
      if (event.type === "system" && event.subtype === "init") {
        sessionId = event.session_id ?? sessionId;
        sendClaudeEvent(taskId, { type: "session/ready", sessionId });
      }
    }
  });
  child.stderr.on("data", (data: Buffer) => sendClaudeEvent(taskId, { type: "stderr", text: data.toString().slice(-1000) }));
  child.on("exit", (code) => {
    claudeProcesses.delete(taskId);
    sendClaudeEvent(taskId, { type: "process/exit", code });
    for (const waiter of resultWaiters.splice(0)) waiter.reject(new Error("Claude Code process exited"));
  });
  return {
    run(prompt: string) {
      return new Promise<string>((resolve, reject) => {
        resultWaiters.push({ resolve, reject });
        child.stdin.write(JSON.stringify({ type: "user", message: { role: "user", content: prompt } }) + "\n");
      });
    },
    get sessionId() { return sessionId; },
    dispose() { child.kill(); },
  };
}

function sendClaudeEvent(taskId: string, payload: Record<string, unknown>) {
  if (!mainWindow?.isDestroyed()) mainWindow?.webContents.send("claude:event", taskId, payload);
}

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
  ipcMain.handle("tasks:list", async (event: IpcMainInvokeEvent) => {
    assertTrustedSender(event);
    return readTasks();
  });
  ipcMain.handle("tasks:create", async (event: IpcMainInvokeEvent, title: string, projectPath: string) => {
    assertTrustedSender(event);
    if (typeof title !== "string" || !title.trim() || typeof projectPath !== "string") throw new Error("Task title and project path are required");
    const task: TaskRecord = { id: randomUUID(), title: title.trim(), projectPath: await realpath(projectPath), messages: [] };
    await saveTasks([task, ...(await readTasks())]);
    return task;
  });
  ipcMain.handle("codex:start", async (event: IpcMainInvokeEvent, taskId: string, projectPath: string, prompt: string) => {
    assertTrustedSender(event);
    const tasks = await readTasks();
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.projectPath !== await realpath(projectPath)) throw new Error("Task does not belong to this project");
    let client = codexProcesses.get(taskId);
    if (!client) {
      client = createCodexClient(taskId);
      codexProcesses.set(taskId, client);
      try {
        await client.initialize();
        if (task.threadId) await client.resume(task.threadId);
      } catch (error) {
        client.dispose();
        throw error;
      }
    }
    task.messages.push({ role: "user", text: prompt, agent: "codex", createdAt: new Date().toISOString() });
    await saveTasks(tasks);
    const result = await client.start(task.projectPath, prompt);
    task.threadId = result.threadId;
    await saveTasks(tasks);
    return result.threadId;
  });
  ipcMain.handle("codex:send", async (event: IpcMainInvokeEvent, taskId: string, prompt: string) => {
    assertTrustedSender(event);
    const tasks = await readTasks();
    const task = tasks.find((item) => item.id === taskId);
    const client = codexProcesses.get(taskId);
    if (!task || !client) throw new Error("Codex task session is not connected");
    task.messages.push({ role: "user", text: prompt, agent: "codex", createdAt: new Date().toISOString() });
    await saveTasks(tasks);
    await client.send(prompt);
  });
  ipcMain.handle("codex:interrupt", async (event: IpcMainInvokeEvent, taskId: string) => {
    assertTrustedSender(event);
    await codexProcesses.get(taskId)?.interrupt();
  });
  ipcMain.handle("claude:run", async (event: IpcMainInvokeEvent, taskId: string, projectPath: string, prompt: string) => {
    assertTrustedSender(event);
    const tasks = await readTasks();
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.projectPath !== await realpath(projectPath)) throw new Error("Task does not belong to this project");
    let client = claudeProcesses.get(taskId);
    if (!client) {
      client = createClaudeClient(taskId, task.projectPath, task.claudeSessionId);
      claudeProcesses.set(taskId, client);
    }
    task.messages.push({ role: "user", text: prompt, agent: "claude", createdAt: new Date().toISOString() });
    await saveTasks(tasks);
    const answer = await client.run(prompt);
    task.claudeSessionId = client.sessionId;
    task.messages.push({ role: "assistant", text: answer, agent: "claude", createdAt: new Date().toISOString() });
    await saveTasks(tasks);
    return { sessionId: client.sessionId, answer };
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
  if (process.argv.includes("--pty-smoke")) {
    runPtySmoke().then(() => {
      console.log("Electron ConPTY smoke test passed");
      app.quit();
    }).catch((error: unknown) => {
      console.error(error);
      app.exit(1);
    });
    return;
  }
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

async function runPtySmoke() {
  const shell = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const terminal = spawn(shell, ["-NoLogo", "-NoProfile", "-Command", "$value = Read-Host 'SMOKE'; Write-Output ('TANGO_ECHO:' + $value)"], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: process.cwd(),
    env: { ...process.env, TERM: "xterm-256color" } as Record<string, string>,
    useConpty: true,
    conptyInheritCursor: true,
  });
  let output = "";
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      terminal.kill();
      reject(new Error("PTY timed out. Output: " + output));
    }, 8000);
    const inputTimeout = setTimeout(() => terminal.write("TANGO_INPUT_OK\r"), 1800);
    terminal.onData((data) => {
      output += data;
      if (data.includes("\u001b[6n")) terminal.write("\u001b[1;1R");
      if (output.includes("SMOKE:") && !output.includes("TANGO_INPUT_OK")) terminal.write("TANGO_INPUT_OK\r");
      if (output.includes("TANGO_ECHO:TANGO_INPUT_OK")) {
        clearTimeout(inputTimeout);
        clearTimeout(timeout);
        terminal.kill();
        resolve();
      }
    });
    terminal.onExit(({ exitCode }) => {
      if (!output.includes("TANGO_ECHO:TANGO_INPUT_OK")) {
        clearTimeout(timeout);
        reject(new Error("PTY exited with code " + exitCode + ". Output: " + output));
      }
    });
  });
}

app.on("window-all-closed", () => {
  for (const client of codexProcesses.values()) client.dispose();
  codexProcesses.clear();
  for (const client of claudeProcesses.values()) client.dispose();
  claudeProcesses.clear();
  for (const terminal of terminals.values()) terminal.kill();
  terminals.clear();
  if (process.platform !== "darwin") app.quit();
});
