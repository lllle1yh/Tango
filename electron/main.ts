import { app, BrowserWindow, dialog, ipcMain, Menu, screen, shell, type IpcMainEvent, type IpcMainInvokeEvent } from "electron";
import type { WorkspaceLayout, LayoutNode } from "./preload";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, realpath, rename, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn, type IPty } from "@homebridge/node-pty-prebuilt-multiarch";

const execFileAsync = promisify(execFile);

// Portable data directory. The default is Electron's userData folder; a dev or
// restricted environment can point TANGO_DATA_DIR somewhere writable instead.
if (process.env.TANGO_DATA_DIR) {
  app.setPath("userData", path.resolve(process.env.TANGO_DATA_DIR));
}
const workspaceFile = () => path.join(app.getPath("userData"), "workspace.json");
let mainWindow: BrowserWindow | null = null;
// 当前工作区的权威来源是内存，而不是 workspace.json。写盘可能失败（权限、只读安装），
// 但终端和 Agent 必须继续指向用户刚选中的目录。
let currentProjectPath: string | null = null;
const terminals = new Map<string, { process: IPty; cwd: string; closeTimer?: NodeJS.Timeout }>();
const codexProcesses = new Map<string, ReturnType<typeof createCodexClient>>();
const claudeProcesses = new Map<string, ReturnType<typeof createClaudeClient>>();
const dshProcesses = new Map<string, ReturnType<typeof createDshClient>>();
const piProcesses = new Map<string, ReturnType<typeof createPiClient>>();

type TaskRecord = {
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
    // Which tools this turn ran, kept with its reply so reopening the task still shows them.
    tools?: Array<{ id: string; name: string; status: string; detail?: string }>;
  }>;
};

type AppSettings = {
  theme: "light" | "dark";
  accent: string;
  chatWidth: "comfortable" | "wide";
  defaultAgent: "codex" | "claude" | "dsh" | "pi";
  terminalShell: "powershell" | "gitbash" | "cmd";
  codexApprovalPolicy: "on-request" | "on-failure" | "never";
  codexSandbox: "read-only" | "workspace-write" | "danger-full-access";
  sidebarCollapsed: boolean;
  claudePermissionMode: "default" | "acceptEdits" | "auto" | "bypassPermissions" | "manual" | "dontAsk" | "plan";
};

const defaultSettings: AppSettings = {
  theme: "light",
  accent: "#4a57d9",
  chatWidth: "comfortable",
  defaultAgent: "codex",
  terminalShell: "powershell",
  codexApprovalPolicy: "on-request",
  codexSandbox: "workspace-write",
  sidebarCollapsed: false,
  claudePermissionMode: "default",
};

let cachedSettings: AppSettings | null = null;

function settingsFile() {
  return path.join(app.getPath("userData"), "settings.json");
}

async function readSettings(): Promise<AppSettings> {
  if (cachedSettings) return cachedSettings;
  try {
    const parsed = JSON.parse(await readFile(settingsFile(), "utf8")) as Partial<AppSettings>;
    cachedSettings = sanitizeSettings(parsed);
  } catch {
    cachedSettings = { ...defaultSettings };
  }
  return cachedSettings;
}

function sanitizeSettings(input: Partial<AppSettings>): AppSettings {
  const merged = { ...defaultSettings, ...input };
  return {
    theme: merged.theme === "dark" ? "dark" : "light",
    accent: /^#[0-9a-fA-F]{6}$/.test(merged.accent) ? merged.accent : defaultSettings.accent,
    chatWidth: merged.chatWidth === "wide" ? "wide" : "comfortable",
    defaultAgent: (["codex", "claude", "dsh", "pi"] as const).includes(merged.defaultAgent as never)
      ? merged.defaultAgent
      : defaultSettings.defaultAgent,
    terminalShell: (["powershell", "gitbash", "cmd"] as const).includes(merged.terminalShell as never)
      ? merged.terminalShell
      : defaultSettings.terminalShell,
    codexApprovalPolicy: (["on-request", "on-failure", "never"] as const).includes(merged.codexApprovalPolicy as never)
      ? merged.codexApprovalPolicy
      : defaultSettings.codexApprovalPolicy,
    codexSandbox: (["read-only", "workspace-write", "danger-full-access"] as const).includes(merged.codexSandbox as never)
      ? merged.codexSandbox
      : defaultSettings.codexSandbox,
    sidebarCollapsed: merged.sidebarCollapsed === true,
    claudePermissionMode: (["default", "acceptEdits", "auto", "bypassPermissions", "manual", "dontAsk", "plan"] as const)
      .includes(merged.claudePermissionMode as never)
      ? merged.claudePermissionMode
      : defaultSettings.claudePermissionMode,
  };
}

// 先写临时文件再 rename，避免覆盖到一半的 JSON 在崩溃后留下坏文件。
async function writeJsonAtomic(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), "utf8");
  await rename(temporary, file);
}

function tasksFile() {
  return path.join(app.getPath("userData"), "tasks.json");
}
function layoutFile() {
  return path.join(app.getPath("userData"), "layout.json");
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
  await writeJsonAtomic(tasksFile(), tasks);
}

// Tools the running turn has used so far. The renderer sees every tool event live; the
// main process keeps the same list so the finished reply can carry its tools to disk.
type TurnTool = { id: string; name: string; status: string; detail?: string };
const turnTools = new Map<string, TurnTool[]>();

function noteTurnTool(taskId: string, tool: { id?: unknown; name?: unknown; status?: unknown; detail?: unknown }) {
  const list = turnTools.get(taskId);
  if (!list) return; // No turn is recording for this task.
  const id = String(tool.id ?? tool.name ?? "tool");
  const name = tool.name !== undefined && tool.name !== null ? String(tool.name) : undefined;
  const detail = typeof tool.detail === "string" && tool.detail ? tool.detail.slice(0, 400) : undefined;
  const status = tool.status === "running" ? "running" : tool.status === "error" ? "error" : "done";
  const index = list.findIndex((item) => item.id === id);
  if (index >= 0) {
    const current = list[index];
    list[index] = { ...current, name: name ?? current.name, status, detail: detail ?? current.detail };
  } else {
    list.push({ id, name: name ?? "tool", status, detail });
    if (list.length > 40) list.shift();
  }
}

// A turn that failed still gets one line in the transcript, so the prompt is not left
// without an answer when the app is reopened or the task is viewed later.
async function recordFailedTurn(taskId: string, agent: string, prompt: string, error: unknown) {
  const message = error instanceof Error && error.message ? error.message : String(error ?? "Unknown error");
  const tools = takeTurnTools(taskId);
  const tasks = await readTasks();
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;
  const last = task.messages[task.messages.length - 1];
  if (!(last?.role === "user" && last.text === prompt && last.agent === agent)) return;
  task.messages.push({
    role: "assistant", text: `The turn could not run: ${message.slice(0, 600)}`, agent, createdAt: new Date().toISOString(),
    ...(tools ? { tools } : {}),
  });
  await saveTasks(tasks);
}

// Hands the finished turn's tools to the reply it produced and forgets the list.
function takeTurnTools(taskId: string): TurnTool[] | undefined {
  const tools = turnTools.get(taskId);
  turnTools.delete(taskId);
  return tools && tools.length > 0 ? tools : undefined;
}

const CODEX_APPROVAL_METHODS = new Set([
  "item/commandExecution/requestApproval",
  "item/fileChange/requestApproval",
  "applyPatchApproval",
  "execCommandApproval",
  "item/permissions/requestApproval",
]);

// 审批请求参数 → { 标题, 详情 }. 只读取协议里声明的字段，字段缺失时退回通用文案。
function describeCodexApproval(method: string, params: any): { title: string; detail: string } {
  if (method === "item/permissions/requestApproval") {
    const profile = params?.permissions ?? {};
    const parts: string[] = [];
    const entries = [
      ...(Array.isArray(profile.fileSystem?.entries) ? profile.fileSystem.entries : []),
      ...(Array.isArray(profile.fileSystem?.read) ? profile.fileSystem.read.map((path: any) => ({ access: "read", path: { type: "path", path } })) : []),
      ...(Array.isArray(profile.fileSystem?.write) ? profile.fileSystem.write.map((path: any) => ({ access: "write", path: { type: "path", path } })) : []),
    ];
    for (const entry of entries.slice(0, 6)) {
      const path = entry?.path ?? {};
      const label = path.type === "path" ? path.path
        : path.type === "glob_pattern" ? path.pattern
        : path.type === "special" ? (path.value?.subpath ? String(path.value.kind) + "/" + path.value.subpath : String(path.value?.kind ?? "special"))
        : path.field === "cwd" ? "the working directory"
        : "a path";
      parts.push(`${entry?.access ?? "access"}: ${label}`);
    }
    if (profile.network?.enabled) parts.push("network access");
    const reason = typeof params?.reason === "string" ? params.reason : "";
    return { title: "Grant extra permissions", detail: [reason, ...parts].filter(Boolean).join(String.fromCharCode(10)) };
  }
  const legacy = method === "applyPatchApproval" || method === "execCommandApproval";
  const command = Array.isArray(params?.command) ? params.command.join(" ") : params?.command;
  const files = params?.fileChanges && typeof params.fileChanges === "object"
    ? Object.keys(params.fileChanges).slice(0, 6).join(", ")
    : undefined;
  const title = method === "item/fileChange/requestApproval" || legacy ? "Apply file changes" : "Run a command";
  return { title, detail: command || files || params?.reason || params?.cwd || "" };
}

// 审批响应体. 新式请求回 { decision }; 权限请求回 GrantedPermissionProfile + scope.
// 同意权限请求时原样回传请求的参数，拒绝时回空档案。
function codexApprovalResult(method: string, optionId: string | null, requested: unknown) {
  if (method === "item/permissions/requestApproval") {
    const granted = optionId === "accept" || optionId === "acceptForSession";
    return {
      permissions: granted && requested && typeof requested === "object"
        ? requested
        : { fileSystem: null, network: null },
      scope: optionId === "acceptForSession" ? "session" : "turn",
    };
  }
  const legacy = method === "applyPatchApproval" || method === "execCommandApproval";
  return { decision: optionId ?? (legacy ? "abort" : "decline") };
}

function createCodexClient(taskId: string, projectPath: string) {
  // Windows 上全局 npm 安装的 codex 是 .cmd 包装，直接 spawn("codex") 会 ENOENT。
  const spawnChild = require("node:child_process").spawn;
  const child = (process.platform === "win32"
    ? spawnChild("cmd.exe", ["/d", "/s", "/c", "codex app-server"], { cwd: projectPath, stdio: ["pipe", "pipe", "pipe"], windowsHide: true })
    : spawnChild("codex", ["app-server"], { cwd: projectPath, stdio: ["pipe", "pipe", "pipe"], windowsHide: true })
  ) as import("node:child_process").ChildProcessWithoutNullStreams;
  // 没有 error 监听时 Node 会抛未捕获异常，直接带崩主进程。
  child.on("error", (error) => {
    sendCodexEvent(taskId, { type: "process/error", message: error.message });
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  });
  let nextId = 1;
  const pending = new Map<number, { resolve(value: any): void; reject(error: Error): void }>();
  let buffer = "";
  let threadId: string | undefined;
  let turnId: string | undefined;
  const serverRequests = new Map<number, { method: string; params: any }>();

  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line) continue;
      let message: any;
      try { message = JSON.parse(line); } catch { continue; }
      if (typeof message.method === "string" && !pending.has(message.id) && message.id !== undefined
        && CODEX_APPROVAL_METHODS.has(message.method)) {
        const params = message.params ?? {};
        serverRequests.set(message.id, { method: message.method, params });
        const legacy = message.method === "applyPatchApproval" || message.method === "execCommandApproval";
        const { title, detail } = describeCodexApproval(message.method, params);
        sendCodexEvent(taskId, {
          type: "permission/request",
          requestId: message.id,
          method: message.method,
          title,
          detail,
          options: legacy
            ? [
                { optionId: "approved", label: "Allow", kind: "allow_once" },
                { optionId: "approved_for_session", label: "Always allow", kind: "allow_always" },
                { optionId: "abort", label: "Decline", kind: "reject_once" },
              ]
            : [
                { optionId: "accept", label: "Allow", kind: "allow_once" },
                { optionId: "acceptForSession", label: "Always allow", kind: "allow_always" },
                { optionId: "decline", label: "Decline", kind: "reject_once" },
              ],
        });
      } else if (typeof message.id === "number" && pending.has(message.id)) {
        const waiter = pending.get(message.id)!;
        pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.error.message ?? "Codex request failed"));
        else waiter.resolve(message.result);
      } else if (typeof message.method === "string") {
        if (message.method === "item/agentMessage/delta") {
          sendCodexEvent(taskId, { type: "delta", text: message.params?.delta ?? "" });
        } else if (message.method === "item/started" || message.method === "item/completed") {
          const item = message.params?.item;
          if (item && item.type !== "agentMessage" && item.type !== "reasoning") {
            // Codex reports progress through item status (inProgress/completed/failed/declined).
            const status = item.status === "inProgress" ? "running"
              : item.status === "failed" || item.status === "declined" ? "error" : "done";
            sendCodexEvent(taskId, {
              type: "tool",
              id: item.id,
              name: item.command ?? item.tool ?? item.type,
              status: message.method === "item/started" && item.status === undefined ? "running" : status,
            });
          }
          sendCodexEvent(taskId, { type: message.method, item });
        } else if (message.method === "turn/completed") {
          const turn = message.params?.turn;
          const answer = Array.isArray(turn?.items)
            ? turn.items.filter((item: any) => item.type === "agentMessage").map((item: any) => item.text ?? "").join("")
            : "";
          const tools = takeTurnTools(taskId);
          if (answer) {
            void readTasks().then(async (tasks) => {
              const task = tasks.find((item) => item.id === taskId);
              if (!task) return;
              task.messages.push({
                role: "assistant", text: answer, agent: "codex", createdAt: new Date().toISOString(),
                ...(tools ? { tools } : {}),
              });
              await saveTasks(tasks);
            });
          }
          sendCodexEvent(taskId, { type: "turn/completed", turn });
          turnId = undefined;
          void clearRunning(taskId);
        } else if (message.method === "serverRequest/resolved") {
          sendCodexEvent(taskId, { type: message.method, params: message.params });
          if (message.params?.requestId !== undefined) serverRequests.delete(message.params.requestId);
        } else {
          sendCodexEvent(taskId, { type: message.method, params: message.params });
        }
      }
    }
  });
  child.stderr.on("data", () => {});
  child.on("exit", (code) => {
    codexProcesses.delete(taskId);
    void clearRunning(taskId);
    sendCodexEvent(taskId, { type: "process/exit", code });
    for (const waiter of pending.values()) waiter.reject(new Error("Codex app server exited"));
    pending.clear();
    serverRequests.clear();
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
      const settings = await readSettings();
      const thread = await request("thread/start", { cwd: projectPath, approvalPolicy: settings.codexApprovalPolicy, sandbox: settings.codexSandbox });
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

  function respondPermission(requestId: number, optionId: string | null) {
    const request = serverRequests.get(requestId);
    if (!request) return false;
    serverRequests.delete(requestId);
    const result = codexApprovalResult(request.method, optionId, request.params?.permissions);
    child.stdin.write(JSON.stringify({ id: requestId, result }) + String.fromCharCode(10));
    return true;
  }

  return {
    initialize,
    start,
    send,
    interrupt,
    resume,
    respondPermission,
    get threadId() { return threadId; },
    dispose: () => { void terminateChild(child); },
  };
}

function sendCodexEvent(taskId: string, payload: Record<string, unknown>) {
  if (payload.type === "tool") noteTurnTool(taskId, payload);
  if (!mainWindow?.isDestroyed()) mainWindow?.webContents.send("codex:event", taskId, payload);
}

function createClaudeClient(taskId: string, projectPath: string, resumeId: string | undefined, permissionMode: string) {
  const args = ["-p", "--verbose", "--input-format", "stream-json", "--output-format", "stream-json", "--include-partial-messages"];
  if (resumeId) args.push("--resume", resumeId);
  if (permissionMode && permissionMode !== "default") args.push("--permission-mode", permissionMode);
  const child = require("node:child_process").spawn(
    process.platform === "win32" ? "cmd.exe" : "claude",
    process.platform === "win32" ? ["/d", "/s", "/c", "claude " + args.join(" ")] : args,
    { cwd: projectPath, stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
  ) as import("node:child_process").ChildProcessWithoutNullStreams;
  let buffer = "";
  const resultWaiters: Array<{ resolve(text: string): void; reject(error: Error): void }> = [];
  let sessionId = resumeId ?? "";
  let cancelled = false;
  let lastClaudeTool: { id: string; name: string } | null = null;
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
        const block = event.event?.content_block;
        if (event.event?.type === "content_block_start" && block?.type === "tool_use") {
          lastClaudeTool = { id: block.id, name: block.name };
          sendClaudeEvent(taskId, { type: "tool", id: block.id, name: block.name, status: "running" });
        }
        if (event.event?.type === "content_block_stop" && lastClaudeTool) {
          sendClaudeEvent(taskId, { type: "tool", id: lastClaudeTool.id, name: lastClaudeTool.name, status: "done" });
          lastClaudeTool = null;
        }
      }
      if (event.type === "result") {
        const text = cancelled ? "" : String(event.result ?? "");
        if (!cancelled && event.is_error) resultWaiters.shift()?.reject(new Error(event.result ?? "Claude Code turn failed"));
        else resultWaiters.shift()?.resolve(text);
        cancelled = false;
        sendClaudeEvent(taskId, { type: "turn/completed", sessionId, text });
      }
      if (event.type === "system" && event.subtype === "init") {
        sessionId = event.session_id ?? sessionId;
        sendClaudeEvent(taskId, { type: "session/ready", sessionId });
      }
    }
  });
  child.stderr.on("data", (data: Buffer) => sendClaudeEvent(taskId, { type: "stderr", text: data.toString().slice(-1000) }));
  child.on("error", (error) => {
    sendClaudeEvent(taskId, { type: "process/error", message: error.message });
    for (const waiter of resultWaiters.splice(0)) waiter.reject(error);
  });
  child.on("exit", (code) => {
    claudeProcesses.delete(taskId);
    sendClaudeEvent(taskId, { type: "process/exit", code });
    // On a user cancel the turn ends with the process exit, not with a `result` event.
    for (const waiter of resultWaiters.splice(0)) {
      if (cancelled) waiter.resolve("");
      else waiter.reject(new Error("Claude Code process exited"));
    }
    cancelled = false;
  });
  function run(prompt: string) {
    return new Promise<string>((resolve, reject) => {
      resultWaiters.push({ resolve, reject });
      child.stdin.write(JSON.stringify({ type: "user", message: { role: "user", content: prompt } }) + "\n");
    });
  }
  // Claude Code stream-json has no in-band interrupt. Terminating the CLI is the
  // documented way to stop a turn; the next turn starts a fresh process resuming
  // `sessionId`.
  async function interrupt() {
    cancelled = true;
    await terminateChild(child);
  }
  return {
    run,
    interrupt,
    get sessionId() { return sessionId; },
    dispose() { void terminateChild(child); },
  };
}

function sendClaudeEvent(taskId: string, payload: Record<string, unknown>) {
  if (payload.type === "tool") noteTurnTool(taskId, payload);
  if (!mainWindow?.isDestroyed()) mainWindow?.webContents.send("claude:event", taskId, payload);
}

function createDshClient(taskId: string, projectPath: string) {
  const child = require("node:child_process").spawn("cmd.exe", ["/d", "/s", "/c", "dsh --profile acp"], {
    cwd: projectPath, stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
  }) as import("node:child_process").ChildProcessWithoutNullStreams;
  let nextId = 1;
  let buffer = "";
  let sessionId = "";
  let answer = "";
  let disposed = false;
  const pending = new Map<number, { resolve(value: any): void; reject(error: Error): void }>();
  const pendingPermissions = new Map<number, { options: Array<{ optionId: string; name: string; kind: string }> }>();
  let lastStopReason: string | undefined;

  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line) continue;
      let message: any;
      try { message = JSON.parse(line); } catch { continue; }
      if (typeof message.method === "string") {
        if (message.method === "session/update") {
          const update = message.params?.update;
          if (update?.sessionUpdate === "agent_message_chunk" && typeof update.content?.text === "string") {
            answer += update.content.text;
            sendDshEvent(taskId, { type: "delta", text: update.content.text });
          }
          sendDshEvent(taskId, { type: "session/update", update });
        } else if (message.method === "session/request_permission") {
          const options: Array<{ optionId: string; name: string; kind: string }> = Array.isArray(message.params?.options) ? message.params.options : [];
          sendDshEvent(taskId, { type: "permission/request", requestId: message.id, params: message.params });
          if (typeof message.id === "number" && options.length) pendingPermissions.set(message.id, { options });
          else if (typeof message.id === "number") {
            child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { outcome: { outcome: "cancelled" } } }) + "\n");
          }
        } else {
          sendDshEvent(taskId, { type: message.method, params: message.params });
        }
        continue;
      }
      if (typeof message.id === "number" && pending.has(message.id)) {
        const waiter = pending.get(message.id)!;
        pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.error.message ?? "DSH request failed"));
        else waiter.resolve(message.result);
      }
    }
  });
  let stderrTail = "";
  child.stderr.on("data", (chunk: Buffer) => {
    stderrTail = (stderrTail + chunk.toString()).slice(-4000);
    sendDshEvent(taskId, { type: "stderr", text: chunk.toString().slice(-1000) });
  });
  child.on("error", (error) => {
    sendDshEvent(taskId, { type: "process/error", message: error.message });
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  });
  child.on("exit", (code) => {
    // An exit after dispose() is the app stopping the agent, not the agent failing.
    const stopped = disposed;
    disposed = true;
    dshProcesses.delete(taskId);
    const detail = stderrTail.trim() ? `
${stderrTail.trim().slice(-1600)}` : "";
    for (const waiter of pending.values()) waiter.reject(new Error("DSH ACP exited with code " + code + detail));
    pending.clear();
    pendingPermissions.clear();
    if (!stopped) sendDshEvent(taskId, { type: "process/exit", code });
  });

  function request(method: string, params: unknown) {
    const id = nextId++;
    return new Promise<any>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n", (error) => {
        if (error) { pending.delete(id); reject(error); }
      });
    });
  }

  async function initialize() {
    await request("initialize", {
      protocolVersion: 1,
      clientInfo: { name: "tango", version: app.getVersion() },
      clientCapabilities: {},
    });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  }

  async function run(prompt: string, savedSessionId?: string) {
    answer = "";
    lastStopReason = undefined;
    if (!sessionId) {
      const params = { cwd: projectPath, mcpServers: [] as unknown[] };
      const session = savedSessionId
        ? await request("session/resume", { ...params, sessionId: savedSessionId })
            .catch(() => request("session/new", params))
        : await request("session/new", params);
      sessionId = session?.sessionId ?? "";
      if (!sessionId) throw new Error("DSH did not open a session");
    }
    const result = await request("session/prompt", { sessionId, prompt: [{ type: "text", text: prompt }] });
    lastStopReason = result?.stopReason ?? "end_turn";
    return { sessionId, answer, stopReason: lastStopReason };
  }

  function interrupt() {
    if (!sessionId) return;
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "session/cancel", params: { sessionId } }) + "\n");
  }

  function respondPermission(requestId: number, optionId: string | null) {
    const request = pendingPermissions.get(requestId);
    if (!request) return false;
    pendingPermissions.delete(requestId);
    const allowed = optionId !== null && request.options.some((option) => option.optionId === optionId);
    child.stdin.write(JSON.stringify({
      jsonrpc: "2.0",
      id: requestId,
      result: allowed ? { outcome: { outcome: "selected", optionId } } : { outcome: { outcome: "cancelled" } },
    }) + "\n");
    return true;
  }

  return {
    initialize,
    run,
    interrupt,
    respondPermission,
    get sessionId() { return sessionId; },
    get lastStopReason() { return lastStopReason; },
    dispose() { disposed = true; dshProcesses.delete(taskId); void terminateChild(child); },
  };
}

function sendDshEvent(taskId: string, payload: Record<string, unknown>) {
  if (payload.type === "tool") noteTurnTool(taskId, payload);
  if (!mainWindow?.isDestroyed()) mainWindow?.webContents.send("dsh:event", taskId, payload);
}

function createPiClient(taskId: string, projectPath: string, sessionFile?: string) {
  const args = ["--mode", "rpc"];
  const child = require("node:child_process").spawn("cmd.exe", ["/d", "/s", "/c", "pi " + args.join(" ")], {
    cwd: projectPath, stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
  }) as import("node:child_process").ChildProcessWithoutNullStreams;
  let buffer = "";
  let answer = "";
  let sessionPath = sessionFile ?? "";
  let restored = false;
  const pending = new Map<string, { resolve(value: any): void; reject(error: Error): void }>();
  const pendingUi = new Map<string, { method: string; options?: string[] }>();
  let settled: (() => void) | undefined;
  let aborted = false;
  let lastAborted = false;
  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line) continue;
      let message: any; try { message = JSON.parse(line); } catch { continue; }
      if (message.type === "response" && typeof message.id === "string" && pending.has(message.id)) {
        const waiter = pending.get(message.id)!; pending.delete(message.id);
        message.success ? waiter.resolve(message.data) : waiter.reject(new Error(message.error ?? "Pi RPC command failed"));
        if (message.command === "get_state" && message.success && message.data?.sessionFile) {
          sessionPath = message.data.sessionFile;
          sendPiEvent(taskId, { type: "session/state", sessionFile: sessionPath });
        }
      } else if (message.type === "message_update") {
        const update = message.assistantMessageEvent;
        if (update?.type === "text_delta") {
          answer += update.delta ?? "";
          sendPiEvent(taskId, { type: "delta", text: update.delta ?? "" });
        } else if (update?.type === "error") {
          sendPiEvent(taskId, { type: "agent_error", reason: update.reason ?? "error" });
        } else sendPiEvent(taskId, { type: "message_update", event: update });
      } else if (message.type === "agent_end") {
        sendPiEvent(taskId, { type: "agent_end", aborted });
        aborted = false;
        settled?.();
        settled = undefined;
      } else if (message.type === "tool_execution_start") {
        sendPiEvent(taskId, { type: "tool", id: message.toolCallId, name: message.toolName, status: "running" });
      } else if (message.type === "tool_execution_end") {
        sendPiEvent(taskId, { type: "tool", id: message.toolCallId, name: message.toolName, status: message.isError ? "error" : "done" });
      } else if (message.type === "extension_ui_request") {
        const method = String(message.method ?? "");
        if (["select", "confirm", "input", "editor"].includes(method) && typeof message.id === "string") {
          pendingUi.set(message.id, { method, options: Array.isArray(message.options) ? message.options.map(String) : undefined });
          const options = method === "select"
            ? (message.options ?? []).map((option: unknown, index: number) => ({ optionId: String(index), label: String(option) }))
            : method === "confirm"
              ? [{ optionId: "yes", label: "Allow" }, { optionId: "no", label: "Decline" }]
              : [];
          sendPiEvent(taskId, {
            type: "permission/request",
            requestId: message.id,
            title: String(message.title ?? message.message ?? "Pi is asking for input."),
            detail: typeof message.message === "string" ? message.message : undefined,
            input: method === "input" || method === "editor"
              ? { placeholder: message.placeholder ?? "", prefill: message.prefill ?? "" }
              : undefined,
            options,
          });
        } else {
          sendPiEvent(taskId, { type: "extension_ui_request", request: message });
        }
      }
    }
  });
  child.stderr.on("data", (data: Buffer) => sendPiEvent(taskId, { type: "stderr", text: data.toString().slice(-1000) }));
  child.on("error", (error) => {
    sendPiEvent(taskId, { type: "process/error", message: error.message });
    pendingUi.clear();
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
    settled?.();
    settled = undefined;
  });
  child.on("exit", (code) => {
    piProcesses.delete(taskId);
    for (const waiter of pending.values()) waiter.reject(new Error("Pi process exited with code " + code));
    pending.clear();
    pendingUi.clear();
    sendPiEvent(taskId, { type: "process/exit", code });
    settled?.();
    settled = undefined;
  });
  function command(name: string, params: Record<string, unknown> = {}) {
    return new Promise<any>((resolve, reject) => {
      const id = randomUUID();
      pending.set(id, { resolve, reject });
      child.stdin.write(JSON.stringify({ type: name, id, ...params }) + "\n");
    });
  }
  async function restore() {
    if (!sessionPath || restored) return;
    const result = await command("switch_session", { sessionPath });
    if (result?.cancelled) throw new Error("Pi refused to resume the saved session");
    restored = true;
  }
  async function run(prompt: string) {
    answer = "";
    aborted = false;
    await restore();
    const idle = new Promise<void>((resolve) => { settled = resolve; });
    // `agent_end` is emitted when the agent goes idle after the prompt, including tool turns.
    if (sessionPath) sendPiEvent(taskId, { type: "session/state", sessionFile: sessionPath });
    await command("prompt", { message: prompt });
    await idle;
    lastAborted = aborted;
    const state = await command("get_state");
    sessionPath = state?.sessionFile ?? sessionPath;
    return { sessionFile: sessionPath, answer, aborted: lastAborted };
  }
  async function interrupt() {
    aborted = true;
    await command("abort");
  }
  function respondUi(requestId: string, optionId: string | null, text?: string) {
    const request = pendingUi.get(requestId);
    if (!request) return false;
    pendingUi.delete(requestId);
    let payload: Record<string, unknown>;
    const typed = typeof text === "string" ? text : null;
    if (!optionId && typed === null) payload = { cancelled: true };
    else if (request.method === "select") payload = { value: request.options?.[Number(optionId)] ?? optionId ?? "" };
    else if (request.method === "confirm") payload = { confirmed: optionId === "yes" };
    else payload = { value: typed ?? optionId ?? "" };
    child.stdin.write(JSON.stringify({ type: "extension_ui_response", id: requestId, ...payload }) + String.fromCharCode(10));
    return true;
  }

  return { restore, run, interrupt, respondUi, get sessionFile() { return sessionPath; }, dispose() { void terminateChild(child); } };
}

function sendPiEvent(taskId: string, payload: Record<string, unknown>) {
  if (payload.type === "tool") noteTurnTool(taskId, payload);
  if (!mainWindow?.isDestroyed()) mainWindow?.webContents.send("pi:event", taskId, payload);
}

// Windows 上 Claude / DSH / Pi 是通过 cmd.exe 启动的，kill 外壳会留下真正的 Agent 进程。
// 用 taskkill /T 结束整棵进程树，失败时退回 child.kill()。
// Close stdin first so stdio protocols (ACP, stream-json, RPC) finish their own state
// and exit. Terminating the process outright can cut them off mid-write.
async function terminateChild(child: import("node:child_process").ChildProcess) {
  if (child.exitCode !== null) return;
  try { child.stdin?.end(); } catch { /* already closed */ }
  const leftPipe = child.stdin && !child.stdin.destroyed && child.stdin.writable;
  if (leftPipe) await new Promise((resolve) => {
    const deadline = setTimeout(() => { resolve(undefined); child.stdin?.destroy(); }, 1500);
    child.once("exit", () => { clearTimeout(deadline); resolve(undefined); });
  });
  if (child.exitCode !== null) return;
  if (process.platform === "win32" && child.pid) {
    try {
      await execFileAsync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true });
      return;
    } catch {
      // 进程可能已经退出，继续走 kill 兜底
    }
  }
  child.kill();
}

// One turn per task: a second agent must not start while the first is working.
const activeRuns = new Map<string, string>();

function assertTaskIdle(taskId: string) {
  const agent = activeRuns.get(taskId);
  if (agent) throw new Error(`Another agent (${agent}) is still working in this task`);
}

async function markRunning(taskId: string, agent: string) {
  assertTaskIdle(taskId);
  activeRuns.set(taskId, agent);
  turnTools.set(taskId, []);
  const tasks = await readTasks();
  const task = tasks.find((item) => item.id === taskId);
  if (task) {
    task.running = { agent, startedAt: new Date().toISOString() };
    await saveTasks(tasks);
  }
}

async function clearRunning(taskId: string) {
  activeRuns.delete(taskId);
  const tasks = await readTasks();
  const task = tasks.find((item) => item.id === taskId);
  if (task?.running) {
    delete task.running;
    await saveTasks(tasks);
  }
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

// Pi exposes the agent's own slash commands (skills, templates) over RPC.
// Ask a short-lived process so Tango never guesses what the agent supports.
async function readPiCommands(projectPath: string): Promise<Array<{ name: string; description?: string }>> {
  const child = require("node:child_process").spawn("cmd.exe", ["/d", "/s", "/c", "pi --mode rpc"], {
    cwd: projectPath, stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
  }) as import("node:child_process").ChildProcessWithoutNullStreams;
  return await new Promise((resolve) => {
    let buffer = "";
    let settled = false;
    const finish = (commands: Array<{ name: string; description?: string }>) => {
      if (settled) return;
      settled = true;
      void terminateChild(child);
      resolve(commands);
    };
    const timer = setTimeout(() => finish([]), 8000);
    child.on("error", () => { clearTimeout(timer); finish([]); });
    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split(String.fromCharCode(10));
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line) continue;
        let message: any;
        try { message = JSON.parse(line); } catch { continue; }
        if (message.type === "response" && message.command === "get_commands") {
          clearTimeout(timer);
          const raw = Array.isArray(message.data?.commands) ? message.data.commands : [];
          finish(raw.map((command: any) => ({
            name: String(command.name ?? ""),
            description: typeof command.description === "string" ? command.description : undefined,
          })).filter((command: { name: string }) => command.name));
          return;
        }
      }
    });
    child.stdin.write(JSON.stringify({ type: "get_commands", id: "tango-commands" }) + String.fromCharCode(10));
  });
}

// Magpie 是本地模型路由网关；Tango 不复制它的配置，只报告它是否安装。
async function inspectMagpie() {
  try {
    const result = await execFileAsync(
      process.platform === "win32" ? "cmd.exe" : "magpie",
      process.platform === "win32" ? ["/d", "/s", "/c", "magpie --version"] : ["--version"],
      { timeout: 3000, windowsHide: true },
    );
    return { available: true, version: firstLine(result.stdout) };
  } catch (error) {
    const stdout = firstLine((error as { stdout?: string }).stdout);
    return stdout ? { available: true, version: stdout } : { available: false, version: null };
  }
}

function firstLine(text: string | undefined): string | null {
  const raw = (text ?? "").split(String.fromCharCode(10))[0] ?? "";
  const line = raw.endsWith(String.fromCharCode(13)) ? raw.slice(0, -1) : raw;
  return line.trim() || null;
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
  ipcMain.handle("workspace:get", async (event: IpcMainInvokeEvent) => {
    assertTrustedSender(event);
    if (!currentProjectPath) currentProjectPath = await readLastWorkspace();
    return currentProjectPath;
  });
  // Switching to a folder you have already used needs no dialog; the picker is for new ones.
  ipcMain.handle("workspace:set", async (event: IpcMainInvokeEvent, projectPath: string) => {
    assertTrustedSender(event);
    if (typeof projectPath !== "string" || !projectPath) throw new Error("Project path is required");
    const resolved = await realpath(projectPath);
    const tasks = await readTasks();
    if (!tasks.some((task) => task.projectPath === resolved)) throw new Error("No tasks in that project");
    const info = await stat(resolved);
    if (!info.isDirectory()) throw new Error("Project path is not a folder");
    currentProjectPath = resolved;
    try {
      await writeJsonAtomic(workspaceFile(), { projectPath: resolved });
    } catch (error) {
      console.warn("Could not persist the selected project:", error);
    }
    return resolved;
  });
  ipcMain.handle("workspace:open", async (event: IpcMainInvokeEvent) => {
    assertTrustedSender(event);
    const options: Electron.OpenDialogOptions = {
      title: "Open project folder",
      properties: ["openDirectory", "createDirectory"],
    };
    // 绑定到主窗口，否则对话框可能出现在窗口后面，看起来像“点了没反应”。
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);
    const projectPath = result.filePaths[0];
    if (result.canceled || !projectPath) return null;

    currentProjectPath = projectPath;
    // 记住路径是增强项。写盘失败时仍然切换项目，只记录一次警告，
    // 否则用户会看到「change project 报错」并以为功能坏了。
    try {
      await writeJsonAtomic(workspaceFile(), { projectPath });
    } catch (error) {
      console.warn("Could not persist the selected project:", error);
    }
    return projectPath;
  });
  ipcMain.handle("agents:detect", (event: IpcMainInvokeEvent) => {
    assertTrustedSender(event);
    return Promise.all(agents.map(inspectAgent));
  });
  ipcMain.handle("tools:magpie", (event: IpcMainInvokeEvent) => {
    assertTrustedSender(event);
    return inspectMagpie();
  });
  ipcMain.handle("app:action", async (event: IpcMainInvokeEvent, action: string) => {
    assertTrustedSender(event);
    if (typeof action !== "string") throw new Error("Invalid action");
    if (action === "quit") { app.quit(); return; }
    if (action === "about") {
      if (!mainWindow) return;
      await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "About Tango",
        message: `Tango ${app.getVersion()}`,
        detail: "A local workspace for existing coding agents. Each agent keeps its own session, login and model.",
        buttons: ["OK"],
      });
      return;
    }
    const contents = mainWindow?.webContents;
    if (!contents) return;
    const edit: Record<string, () => void> = {
      "edit:undo": () => contents.undo(),
      "edit:redo": () => contents.redo(),
      "edit:cut": () => contents.cut(),
      "edit:copy": () => contents.copy(),
      "edit:paste": () => contents.paste(),
      "edit:selectAll": () => contents.selectAll(),
      "view:reload": () => contents.reload(),
      "view:devtools": () => contents.toggleDevTools(),
      "view:zoomIn": () => contents.setZoomLevel(contents.getZoomLevel() + 0.5),
      "view:zoomOut": () => contents.setZoomLevel(contents.getZoomLevel() - 0.5),
      "view:resetZoom": () => contents.setZoomLevel(0),
      "view:fullscreen": () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()),
    };
    const run = edit[action];
    if (!run) throw new Error("Unknown action: " + action);
    run();
  });
  ipcMain.handle("pi:commands", async (event: IpcMainInvokeEvent, projectPath: string) => {
    assertTrustedSender(event);
    if (typeof projectPath !== "string") throw new Error("Invalid project path");
    return readPiCommands(projectPath);
  });
  ipcMain.handle("settings:get", async (event: IpcMainInvokeEvent) => {
    assertTrustedSender(event);
    return readSettings();
  });
  ipcMain.handle("settings:reveal", async (event: IpcMainInvokeEvent) => {
    assertTrustedSender(event);
    const error = await shell.openPath(app.getPath("userData"));
    if (error) throw new Error(error);
  });
  ipcMain.handle("settings:save", async (event: IpcMainInvokeEvent, next: Partial<AppSettings>) => {
    assertTrustedSender(event);
    if (!next || typeof next !== "object") throw new Error("Invalid settings");
    const settings = sanitizeSettings({ ...(await readSettings()), ...next });
    cachedSettings = settings;
    // The native window-control overlay sits above the web page; keep it in step with the theme.
    if (mainWindow && process.platform === "win32") {
      mainWindow.setTitleBarOverlay({
        color: settings.theme === "dark" ? "#0a0a0a" : "#fafafa",
        symbolColor: settings.theme === "dark" ? "#f4f4f5" : "#18181b",
        height: 44,
      });
    }
    try {
      await writeJsonAtomic(settingsFile(), settings);
    } catch (error) {
      console.warn("Could not persist settings:", error);
    }
    return settings;
  });
  ipcMain.handle("tasks:list", async (event: IpcMainInvokeEvent) => {
    assertTrustedSender(event);
    return readTasks();
  });
  ipcMain.handle("layout:get", async (event: IpcMainInvokeEvent) => {
    assertTrustedSender(event);
    try { return JSON.parse(await readFile(layoutFile(), "utf8")); } catch { return null; }
  });
  ipcMain.handle("layout:save", async (event: IpcMainInvokeEvent, layout: WorkspaceLayout) => {
    assertTrustedSender(event);
    const paneIds: string[] = [];
    const validate = (node: LayoutNode, depth: number): boolean => {
      if (!node || depth > 12 || typeof node.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(node.id)) return false;
      if (node.type === "pane") {
        paneIds.push(node.id);
        return paneIds.length <= 32;
      }
      return node.type === "split" && (node.direction === "horizontal" || node.direction === "vertical") &&
        Number.isFinite(node.ratio) && node.ratio >= 0.15 && node.ratio <= 0.85 &&
        validate(node.first, depth + 1) && validate(node.second, depth + 1);
    };
    if (!layout || !validate(layout.root, 0) || new Set(paneIds).size !== paneIds.length ||
      !paneIds.includes(layout.activePaneId)) {
      throw new Error("Invalid terminal layout");
    }
    // 布局是增强项；保存失败不应该让每个布局变更都在 UI 里报错。
    try {
      await writeJsonAtomic(layoutFile(), layout);
    } catch (error) {
      console.warn("Could not persist the terminal layout:", error);
    }
  });
  ipcMain.handle("tasks:create", async (event: IpcMainInvokeEvent, title: string, projectPath: string) => {
    assertTrustedSender(event);
    if (typeof title !== "string" || !title.trim() || typeof projectPath !== "string") throw new Error("Task title and project path are required");
    const task: TaskRecord = { id: randomUUID(), title: title.trim(), projectPath: await realpath(projectPath), messages: [] };
    await saveTasks([task, ...(await readTasks())]);
    return task;
  });
  ipcMain.handle("tasks:pin", async (event: IpcMainInvokeEvent, taskId: string, pinned: boolean) => {
    assertTrustedSender(event);
    const tasks = await readTasks();
    const task = tasks.find((item) => item.id === taskId);
    if (!task) throw new Error("Task not found");
    if (pinned) task.pinned = true;
    else delete task.pinned;
    await saveTasks(tasks);
    return task;
  });
  ipcMain.handle("tasks:clear-running", async (event: IpcMainInvokeEvent, taskId: string) => {
    assertTrustedSender(event);
    await clearRunning(taskId);
    const tasks = await readTasks();
    return tasks.find((item) => item.id === taskId) ?? null;
  });
  ipcMain.handle("tasks:reorder", async (event: IpcMainInvokeEvent, taskIds: string[]) => {
    assertTrustedSender(event);
    if (!Array.isArray(taskIds) || taskIds.some((id) => typeof id !== "string")) throw new Error("Invalid task order");
    const tasks = await readTasks();
    const byId = new Map(tasks.map((task) => [task.id, task]));
    const ordered = taskIds.map((id) => byId.get(id)).filter((task): task is TaskRecord => Boolean(task));
    const rest = tasks.filter((task) => !taskIds.includes(task.id));
    await saveTasks([...ordered, ...rest]);
    return [...ordered, ...rest];
  });
  ipcMain.handle("tasks:rename", async (event: IpcMainInvokeEvent, taskId: string, title: string) => {
    assertTrustedSender(event);
    if (typeof title !== "string" || !title.trim()) throw new Error("Task title is required");
    const tasks = await readTasks();
    const task = tasks.find((item) => item.id === taskId);
    if (!task) throw new Error("Task not found");
    task.title = title.trim().slice(0, 200);
    await saveTasks(tasks);
    return task;
  });
  ipcMain.handle("tasks:archive", async (event: IpcMainInvokeEvent, taskId: string, archived: boolean) => {
    assertTrustedSender(event);
    const tasks = await readTasks();
    const task = tasks.find((item) => item.id === taskId);
    if (!task) throw new Error("Task not found");
    if (archived) task.archived = true;
    else delete task.archived;
    await saveTasks(tasks);
    return task;
  });
  ipcMain.handle("tasks:delete", async (event: IpcMainInvokeEvent, taskId: string) => {
    assertTrustedSender(event);
    const tasks = await readTasks();
    if (!tasks.some((item) => item.id === taskId)) throw new Error("Task not found");
    await saveTasks(tasks.filter((item) => item.id !== taskId));
    // 任务消失后，属于它的 Agent 进程和布局都不能继续留在内存里。
    for (const map of [codexProcesses, claudeProcesses, dshProcesses, piProcesses]) {
      const client = map.get(taskId);
      if (client) {
        client.dispose();
        map.delete(taskId);
      }
    }
    return { deleted: taskId };
  });
  // 任务在磁盘上可能带着 threadId，但进程只活在内存里：应用重启、Codex 崩溃或
  // 子进程退出后都必须重建并 resume，否则第二次发消息就会报「未连接」。
  async function ensureCodexClient(task: TaskRecord) {
    let client = codexProcesses.get(task.id);
    if (client) return client;
    client = createCodexClient(task.id, task.projectPath);
    codexProcesses.set(task.id, client);
    try {
      await client.initialize();
      if (task.threadId) await client.resume(task.threadId);
    } catch (error) {
      client.dispose();
      codexProcesses.delete(task.id);
      throw error;
    }
    return client;
  }

  ipcMain.handle("codex:start", async (event: IpcMainInvokeEvent, taskId: string, projectPath: string, prompt: string) => {
    assertTrustedSender(event);
    const tasks = await readTasks();
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.projectPath !== await realpath(projectPath)) throw new Error("Task does not belong to this project");
    await markRunning(task.id, "codex");
    // A turn that never reached the app server must not leave the task "running" forever.
    try {
      const client = await ensureCodexClient(task);
      task.messages.push({ role: "user", text: prompt, agent: "codex", createdAt: new Date().toISOString() });
      await saveTasks(tasks);
      const result = await client.start(task.projectPath, prompt);
      task.threadId = result.threadId;
      await saveTasks(tasks);
      return result.threadId;
    } catch (error) {
      void clearRunning(task.id);
      await recordFailedTurn(task.id, "codex", prompt, error);
      throw error;
    }
  });
  ipcMain.handle("codex:send", async (event: IpcMainInvokeEvent, taskId: string, prompt: string) => {
    assertTrustedSender(event);
    const tasks = await readTasks();
    const task = tasks.find((item) => item.id === taskId);
    if (!task) throw new Error("Codex task session is not connected");
    await markRunning(task.id, "codex");
    try {
      const client = await ensureCodexClient(task);
      if (!client.threadId) throw new Error("Codex conversation could not be resumed");
      task.messages.push({ role: "user", text: prompt, agent: "codex", createdAt: new Date().toISOString() });
      await saveTasks(tasks);
      await client.send(prompt);
    } catch (error) {
      void clearRunning(task.id);
      await recordFailedTurn(task.id, "codex", prompt, error);
      throw error;
    }
  });
  ipcMain.handle("codex:interrupt", async (event: IpcMainInvokeEvent, taskId: string) => {
    assertTrustedSender(event);
    await codexProcesses.get(taskId)?.interrupt();
  });
  ipcMain.handle("codex:permission", async (event: IpcMainInvokeEvent, taskId: string, requestId: number, optionId: string | null) => {
    assertTrustedSender(event);
    if (!Number.isInteger(requestId)) throw new Error("Invalid permission request");
    if (optionId !== null && typeof optionId !== "string") throw new Error("Invalid permission option");
    const handled = codexProcesses.get(taskId)?.respondPermission(requestId, optionId) ?? false;
    if (!handled) throw new Error("Permission request is no longer pending");
  });
  ipcMain.handle("claude:run", async (event: IpcMainInvokeEvent, taskId: string, projectPath: string, prompt: string) => {
    assertTrustedSender(event);
    const tasks = await readTasks();
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.projectPath !== await realpath(projectPath)) throw new Error("Task does not belong to this project");
    let client = claudeProcesses.get(taskId);
    if (!client) {
      client = createClaudeClient(taskId, task.projectPath, task.claudeSessionId, (await readSettings()).claudePermissionMode);
      claudeProcesses.set(taskId, client);
    }
    await markRunning(task.id, "claude");
    task.messages.push({ role: "user", text: prompt, agent: "claude", createdAt: new Date().toISOString() });
    await saveTasks(tasks);
    let answer: string;
    try {
      answer = await client.run(prompt);
    } catch (error) {
      // A failed run leaves nothing to resume from it; the next turn starts clean.
      if (!client.sessionId) {
        client.dispose();
        claudeProcesses.delete(task.id);
      }
      await recordFailedTurn(task.id, "claude", prompt, error);
      throw error;
    } finally {
      void clearRunning(task.id);
    }
    task.claudeSessionId = client.sessionId;
    if (answer) {
      const tools = takeTurnTools(task.id);
      task.messages.push({
        role: "assistant", text: answer, agent: "claude", createdAt: new Date().toISOString(),
        ...(tools ? { tools } : {}),
      });
      await saveTasks(tasks);
    }
    return { sessionId: client.sessionId, answer };
  });
  ipcMain.handle("claude:interrupt", async (event: IpcMainInvokeEvent, taskId: string) => {
    assertTrustedSender(event);
    const client = claudeProcesses.get(taskId);
    if (!client) return;
    // Keep the native session so the next turn can resume after the CLI is killed.
    if (client.sessionId) {
      const tasks = await readTasks();
      const task = tasks.find((item) => item.id === taskId);
      if (task) {
        task.claudeSessionId = client.sessionId;
        await saveTasks(tasks);
      }
    }
    await client.interrupt();
  });
  ipcMain.handle("dsh:run", async (event: IpcMainInvokeEvent, taskId: string, projectPath: string, prompt: string) => {
    assertTrustedSender(event);
    const tasks = await readTasks();
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.projectPath !== await realpath(projectPath)) throw new Error("Task does not belong to this project");
    let client = dshProcesses.get(taskId);
    if (!client) {
      client = createDshClient(taskId, task.projectPath);
      dshProcesses.set(taskId, client);
      try {
        await client.initialize();
      } catch (error) {
        client.dispose();
        throw error;
      }
    }
    await markRunning(task.id, "dsh");
    task.messages.push({ role: "user", text: prompt, agent: "dsh", createdAt: new Date().toISOString() });
    await saveTasks(tasks);
    let result;
    try {
      result = await client.run(prompt, task.dshSessionId);
    } catch (error) {
      await recordFailedTurn(task.id, "dsh", prompt, error);
      throw error;
    } finally {
      void clearRunning(task.id);
      dshProcesses.delete(taskId);
      // ACP sessions live on disk, so the process is only needed while the turn runs.
      // Keeping it alive across turns leaves an orphaned DSH per task forever.
      client.dispose();
    }
    task.dshSessionId = result.sessionId;
    if (result.answer) {
      const tools = takeTurnTools(task.id);
      task.messages.push({
        role: "assistant", text: result.answer, agent: "dsh", createdAt: new Date().toISOString(),
        ...(tools ? { tools } : {}),
      });
      await saveTasks(tasks);
    }
    return result;
  });
  ipcMain.handle("dsh:interrupt", async (event: IpcMainInvokeEvent, taskId: string) => {
    assertTrustedSender(event);
    dshProcesses.get(taskId)?.interrupt();
  });
  ipcMain.handle("dsh:permission", async (event: IpcMainInvokeEvent, taskId: string, requestId: number, optionId: string | null) => {
    assertTrustedSender(event);
    if (!Number.isInteger(requestId)) throw new Error("Invalid permission request");
    if (optionId !== null && typeof optionId !== "string") throw new Error("Invalid permission option");
    const handled = dshProcesses.get(taskId)?.respondPermission(requestId, optionId) ?? false;
    if (!handled) throw new Error("Permission request is no longer pending");
  });
  ipcMain.handle("pi:run", async (event: IpcMainInvokeEvent, taskId: string, projectPath: string, prompt: string) => {
    assertTrustedSender(event);
    const tasks = await readTasks();
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.projectPath !== await realpath(projectPath)) throw new Error("Task does not belong to this project");
    let client = piProcesses.get(taskId);
    if (!client) {
      client = createPiClient(taskId, task.projectPath, task.piSessionFile);
      piProcesses.set(taskId, client);
      try {
        await client.restore();
      } catch (error) {
        client.dispose();
        piProcesses.delete(taskId);
        throw error;
      }
    }
    await markRunning(task.id, "pi");
    task.messages.push({ role: "user", text: prompt, agent: "pi", createdAt: new Date().toISOString() });
    await saveTasks(tasks);
    let result;
    try {
      result = await client.run(prompt);
    } catch (error) {
      // A client that failed before it knew its session file cannot be reused.
      if (!client.sessionFile) {
        client.dispose();
        piProcesses.delete(task.id);
      }
      await recordFailedTurn(task.id, "pi", prompt, error);
      throw error;
    } finally {
      void clearRunning(task.id);
    }
    task.piSessionFile = result.sessionFile;
    if (result.answer) {
      const tools = takeTurnTools(task.id);
      task.messages.push({
        role: "assistant", text: result.answer, agent: "pi", createdAt: new Date().toISOString(),
        ...(tools ? { tools } : {}),
      });
      await saveTasks(tasks);
    }
    return result;
  });
  ipcMain.handle("pi:interrupt", async (event: IpcMainInvokeEvent, taskId: string) => {
    assertTrustedSender(event);
    await piProcesses.get(taskId)?.interrupt();
  });
  // `optionId` is the chosen option for select/confirm; for input/editor it is the typed text
  // itself so the user can answer without a separate API.
  ipcMain.handle("pi:ui-response", async (
    event: IpcMainInvokeEvent,
    taskId: string,
    requestId: string,
    optionId: string | null,
    text?: string,
  ) => {
    assertTrustedSender(event);
    if (typeof requestId !== "string") throw new Error("Invalid UI request");
    if (optionId !== null && typeof optionId !== "string") throw new Error("Invalid option");
    if (text !== undefined && typeof text !== "string") throw new Error("Invalid text");
    const handled = piProcesses.get(taskId)?.respondUi(requestId, optionId, text) ?? false;
    if (!handled) throw new Error("Pi UI request is no longer pending");
  });
  ipcMain.handle("terminal:start", async (event: IpcMainInvokeEvent, requestedPath: string, terminalId: string) => {
    assertTrustedSender(event);
    if (typeof terminalId !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(terminalId)) {
      throw new Error("Invalid terminal identifier");
    }
    const existingTerminal = terminals.get(terminalId);
    if (existingTerminal && existingTerminal.cwd === requestedPath) {
      if (existingTerminal.closeTimer) clearTimeout(existingTerminal.closeTimer);
      existingTerminal.closeTimer = undefined;
      return;
    }
    // 换了项目后同一个 pane id 会被复用；旧进程还在原目录里，必须换掉。
    if (existingTerminal) {
      if (existingTerminal.closeTimer) clearTimeout(existingTerminal.closeTimer);
      existingTerminal.process.kill();
      terminals.delete(terminalId);
    }
    if (!currentProjectPath) currentProjectPath = await readLastWorkspace();
    if (!currentProjectPath) throw new Error("Open a project folder before starting a terminal");

    const root = await realpath(currentProjectPath);
    // 界面传入的路径可能已被删除、换过大小写或含短名（8.3），解析失败时退回工作区根目录，
    // 而不是把终端整个启动失败。
    const requested = await realpath(requestedPath).catch(() => root);
    const relative = path.relative(root, requested);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Terminal directory must be inside the selected project: ${requestedPath} is outside ${root}`);
    }
    if (!(await stat(requested)).isDirectory()) throw new Error("Terminal path is not a directory");

    const settings = await readSettings();
    const gitBash = "C:\\Program Files\\Git\\bin\\bash.exe";
    const shell = settings.terminalShell === "cmd"
      ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "cmd.exe")
      : settings.terminalShell === "gitbash"
        ? gitBash
        : path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    const shellArgs = settings.terminalShell === "powershell" ? ["-NoLogo", "-NoExit"] : [];
    const terminalEnvironment: NodeJS.ProcessEnv = {
      ...process.env,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
    };
    delete terminalEnvironment.NO_COLOR;
    const terminal = spawn(shell, shellArgs, {
      name: "xterm-256color",
      cols: 100,
      rows: 30,
      cwd: requested,
      env: terminalEnvironment as Record<string, string>,
      useConpty: true,
      conptyInheritCursor: true,
    });
    terminals.set(terminalId, { process: terminal, cwd: requestedPath });
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
    if (typeof data === "string" && data.length <= 32768) terminals.get(terminalId)?.process.write(data);
  });
  ipcMain.on("terminal:resize", (event, terminalId: string, cols: number, rows: number) => {
    assertTrustedSender(event);
    if (Number.isInteger(cols) && Number.isInteger(rows) && cols >= 2 && rows >= 1 && cols <= 500 && rows <= 300) {
      terminals.get(terminalId)?.process.resize(cols, rows);
    }
  });
  ipcMain.on("terminal:close", (event, terminalId: string) => {
    assertTrustedSender(event);
    const terminal = terminals.get(terminalId);
    if (terminal) {
      terminal.closeTimer = setTimeout(() => {
        if (terminals.get(terminalId) === terminal) terminal.process.kill();
      }, 120);
    }
  });
}

function assertTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent) {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) {
    throw new Error("Untrusted IPC sender");
  }
}

type WindowState = { x?: number; y?: number; width: number; height: number; maximized?: boolean };

function windowStateFile() {
  return path.join(app.getPath("userData"), "window.json");
}

async function readWindowState(): Promise<WindowState | null> {
  try {
    const state = JSON.parse(await readFile(windowStateFile(), "utf8")) as WindowState;
    if (!Number.isFinite(state.width) || !Number.isFinite(state.height)) return null;
    return state;
  } catch {
    return null;
  }
}

// Keep restored bounds on a connected display; monitors change between runs.
function clampToDisplay(state: WindowState): WindowState {
  const displays = screen.getAllDisplays();
  const visible = displays.some((display) => {
    const area = display.workArea;
    const x = state.x ?? area.x;
    const y = state.y ?? area.y;
    return x + 80 < area.x + area.width && x + state.width - 80 > area.x
      && y + 40 < area.y + area.height && y + 40 > area.y;
  });
  if (visible) return state;
  const area = screen.getPrimaryDisplay().workArea;
  return { width: state.width, height: state.height, maximized: state.maximized, x: area.x + 40, y: area.y + 40 };
}

async function createWindow() {
  const saved = await readWindowState();
  const bounds = saved ? clampToDisplay(saved) : null;
  mainWindow = new BrowserWindow({
    width: bounds?.width ?? 1420,
    height: bounds?.height ?? 920,
    ...(bounds?.x !== undefined && bounds?.y !== undefined ? { x: bounds.x, y: bounds.y } : {}),
    minWidth: 980,
    minHeight: 640,
    icon: path.join(app.getAppPath(), "assets", "tango-icon.png"),
    backgroundColor: "#ffffff",
    title: "Tango",
    // T3 和 Codex 都是无边框窗口：顶部由网页自己画，窗口按钮走原生 overlay。
    titleBarStyle: "hidden",
    ...(process.platform === "win32"
      ? { titleBarOverlay: { color: "#fafafa", symbolColor: "#18181b", height: 44 } }
      : {}),
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
  if (bounds?.maximized) mainWindow.maximize();

  let saveTimer: NodeJS.Timeout | undefined;
  const persistBounds = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const value: WindowState = mainWindow.isMaximized()
      ? { ...mainWindow.getNormalBounds(), maximized: true }
      : { ...mainWindow.getBounds(), maximized: false };
    void writeJsonAtomic(windowStateFile(), value).catch(() => {});
  };
  const schedule = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persistBounds, 400);
  };
  mainWindow.on("resize", schedule);
  mainWindow.on("move", schedule);
  mainWindow.on("maximize", schedule);
  mainWindow.on("unmaximize", schedule);
  mainWindow.on("close", () => { if (saveTimer) clearTimeout(saveTimer); persistBounds(); });
  // Record the first launch too, not only later moves.
  setTimeout(persistBounds, 1500);
  mainWindow.on("closed", () => { mainWindow = null; });
}

// 菜单栏现在画在应用内（见 titlebar），这里只保留一个隐藏的菜单，
// 因为 Windows 上的 Ctrl+C / Ctrl+V / Ctrl+A 依赖 Edit 角色注册快捷键。
function buildApplicationMenu() {
  return Menu.buildFromTemplate([
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
  ]);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(buildApplicationMenu());
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
  void createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
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
  for (const client of dshProcesses.values()) client.dispose();
  dshProcesses.clear();
  for (const client of piProcesses.values()) client.dispose();
  piProcesses.clear();
  for (const terminal of terminals.values()) {
    if (terminal.closeTimer) clearTimeout(terminal.closeTimer);
    terminal.process.kill();
  }
  terminals.clear();
  if (process.platform !== "darwin") app.quit();
});
