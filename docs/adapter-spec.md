# Tango Adapter Spec

**Status: Draft v0.1** — 这是协议草案，欢迎在 issue 里讨论后再实现。

## 1. 目的

定义 Tango Scheduler 与一个 agent CLI 之间的最小契约。任何 agent，只要能用进程和流式输出（或 MCP / ACP）通信，都可以通过 adapter 接入。

## 2. 角色

| 角色 | 职责 |
| --- | --- |
| Scheduler | canonical ledger、回合仲裁、handoff、权限、取消 |
| Adapter | 把 Tango 的回合翻译成 agent 的原生输入，把原生输出翻译回 Tango 事件 |
| Agent | 原生 CLI 进程，保留自己的 session、工具和权限模型 |

Scheduler 不关心 agent 内部怎么实现；Adapter 不拥有 canonical history。

## 3. Manifest

每个 adapter 在包根目录提供 `tango.adapter.json`：

```json
{
  "id": "claude-code",
  "name": "Claude Code",
  "version": "0.1.0",
  "modes": ["unified", "solo"],
  "transport": "stream-json",
  "entry": "./adapter.mjs",
  "capabilities": {
    "text": true,
    "images": false,
    "tools": true,
    "resume": true,
    "permissions": "native"
  }
}
```

## 4. 接口

```ts
interface TangoAdapter {
  detect(): Promise<AgentInfo>
  start(options: StartOptions): Promise<SessionHandle>
  resume(sessionId: string, options: StartOptions): Promise<SessionHandle>
  send(handle: SessionHandle, turn: Turn): AsyncIterable<AgentEvent>
  interrupt(handle: SessionHandle): Promise<void>
  dispose(handle: SessionHandle): Promise<void>
}
```

`AgentEvent` 至少包含：

- `text_delta`
- `reasoning`
- `tool_start` / `tool_end`
- `usage`
- `permission_request`
- `turn_end`
- `error`

## 5. Canonical message

```json
{
  "id": "msg_01J...",
  "turn": 12,
  "harness": "claude-code",
  "role": "assistant",
  "content": [{ "type": "text", "text": "..." }],
  "toolCalls": [],
  "createdAt": "2026-11-15T00:00:00Z"
}
```

规则：

- 只追加，不原地修改。
- `id` 稳定；`turn` 与 `harness` 必须标注，避免切换后被误认成自己的历史。
- 不把 adapter 私有状态写进 canonical message。

## 6. 共舞 / Unified 契约

- Scheduler 是 canonical history 的唯一所有者。
- Adapter 必须支持 `resume`；切回时只接收「离开期间」的增量。
- Handoff 内容：离开后已完成的 canonical messages + work ledger + 当前请求。
- 必须做身份隔离：明确告诉 agent 哪些历史来自别的 harness。
- 不允许把完整历史重复注入已有原生 session。
- 证明失败、恢复失败、配置变化时 fail closed，并 rollover 到新原生 session。

## 7. 独舞 / Solo 契约

- 原生 session 完全独立，Tango 不写入它的上下文。
- 消息总线至少提供：`send(to, text)`、`read()`、`wait()`。
- 对方忙时消息排队；人可以在任意终端接管。
- 消息不进入 canonical history，除非用户显式要求。

## 8. 安全

- bridge 只监听 `127.0.0.1`，每个 route 使用随机 bearer token。
- 日志不输出 API key、token、原始 stderr。
- work ledger 对常见凭据形态先脱敏。
- 默认不联网、不上传会话。
- adapter 不得静默改写用户的全局配置；需要托管目录时显式声明。

## 9. 一致性测试（计划中）

- `detect` 能找到 CLI 与登录状态
- `start` / `send` / `stream` 正常
- `resume` 连续性与增量 handoff
- `interrupt` 能终止整个进程树
- 权限请求能冒泡到 Tango
- 崩溃 / 重启后的恢复
- 各平台 fixture（Windows / macOS / Linux）

## 10. 可参考的实现

这些项目是参考，不是依赖：

- `dsh-harness-ally`：Claude Code / Codex / Kimi 的 adapter、原生 session 停泊、增量 handoff、身份隔离
- `dsh-oh-my-claude`：Claude Code 的 stream-json 驱动
- `earshot`：peer 消息总线
- `multiagents`：broker / driver 分层
- `dsh-as-mcp`：DSH 会话控制接口

## 11. 讨论

协议草案阶段，接口名和字段都可能调整。提案请开 issue，附上你的 agent 的传输方式和恢复能力。
