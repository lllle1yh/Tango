#!/usr/bin/env node
// Tango 的 MCP 桥：让外部 Agent（例如 Claude Code CLI）读到 Tango 里同一个任务的对话，
// 并把它的回答写回去。只读写 tasks.json，不复制 Agent 的会话或凭据。
//
// 用法（在 Claude Code 里）：
//   claude mcp add tango -- node <repo>/scripts/tango-mcp.mjs
// 数据目录默认与 Tango 相同的位置，可用 TANGO_DATA_DIR 覆盖。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

const dataDir = process.env.TANGO_DATA_DIR
  ? path.resolve(process.env.TANGO_DATA_DIR)
  : path.join(os.homedir(), "AppData", "Roaming", "tango");
const tasksPath = path.join(dataDir, "tasks.json");

function readTasks() {
  try {
    const parsed = JSON.parse(fs.readFileSync(tasksPath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// 与 Tango 主进程一样写临时文件再改名，避免读到写了一半的 JSON。
function writeTasks(tasks) {
  const tmp = `${tasksPath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(tasks, null, 2));
  fs.renameSync(tmp, tasksPath);
}

const roleName = (message) => {
  if (message.role === "user") return "User";
  const agent = { codex: "Codex", claude: "Claude Code", dsh: "DSH", pi: "Pi" }[message.agent] ?? message.agent ?? "Agent";
  return agent;
};

function transcript(task, limit) {
  const messages = limit > 0 ? task.messages.slice(-limit) : task.messages;
  const lines = messages.map((message) => {
    const when = message.createdAt ? ` (${message.createdAt})` : "";
    const tools = message.tools?.length
      ? "\n" + message.tools.map((tool) => `  - ${tool.name}${tool.exitCode !== undefined ? ` exit ${tool.exitCode}` : ""}: ${tool.detail ?? ""}`).join("\n")
      : "";
    const failed = message.role === "assistant" && message.text.startsWith("The turn could not run:") ? "\n  (interrupted: did not run)" : "";
    return `[${roleName(message)}]${when} ${message.text}${tools}${failed}`;
  });
  return `${task.title}\nProject: ${task.projectPath}\n\n${lines.join("\n\n")}`;
}

const tools = [
  {
    name: "tango_list_tasks",
    description: "列出 Tango 里的任务（标题、项目、消息数、最后活动时间）。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "tango_read_task",
    description: "读取某个 Tango 任务的对话记录（含每回合工具与失败标记）。",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "任务 id，可先用 tango_list_tasks 查。" },
        limit: { type: "number", description: "只取最近 N 条消息，默认 30，0 表示全部。" },
      },
      required: ["taskId"],
      additionalProperties: false,
    },
  },
  {
    name: "tango_reply",
    description: "把这段回答写回某个 Tango 任务，Tango 窗口回到前台时就能看到。",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        text: { type: "string", description: "要写进对话的 Markdown 文本。" },
      },
      required: ["taskId", "text"],
      additionalProperties: false,
    },
  },
];

function callTool(name, args) {
  const tasks = readTasks();
  if (name === "tango_list_tasks") {
    const rows = tasks
      .filter((task) => !task.archived)
      .map((task) => ({
        id: task.id,
        title: task.title,
        project: task.projectPath,
        messages: task.messages.length,
        last: task.messages.at(-1)?.createdAt ?? null,
      }));
    return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
  }
  if (name === "tango_read_task") {
    const task = tasks.find((item) => item.id === args?.taskId);
    if (!task) return { isError: true, content: [{ type: "text", text: `No task ${args?.taskId}` }] };
    return { content: [{ type: "text", text: transcript(task, Number(args?.limit ?? 30)) }] };
  }
  if (name === "tango_reply") {
    const task = tasks.find((item) => item.id === args?.taskId);
    if (!task) return { isError: true, content: [{ type: "text", text: `No task ${args?.taskId}` }] };
    const text = String(args?.text ?? "").trim();
    if (!text) return { isError: true, content: [{ type: "text", text: "Empty reply" }] };
    task.messages.push({ role: "assistant", agent: "claude", text, createdAt: new Date().toISOString() });
    writeTasks(tasks);
    return { content: [{ type: "text", text: `Appended to ${task.title} (${task.messages.length} messages).` }] };
  }
  return { isError: true, content: [{ type: "text", text: `Unknown tool ${name}` }] };
}

function handle(request) {
  const { id, method, params } = request;
  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: params?.protocolVersion ?? "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "tango", version: "0.1.0" },
      },
    };
  }
  if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools } };
  if (method === "tools/call") {
    return { jsonrpc: "2.0", id, result: callTool(params?.name, params?.arguments ?? {}) };
  }
  if (method === "ping") return { jsonrpc: "2.0", id, result: {} };
  if (method?.startsWith("notifications/")) return null;
  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method ${method}` } };
}

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let reply;
  try {
    reply = handle(JSON.parse(trimmed));
  } catch (error) {
    reply = { jsonrpc: "2.0", id: null, error: { code: -32700, message: String(error?.message ?? error) } };
  }
  if (reply) process.stdout.write(`${JSON.stringify(reply)}\n`);
});
