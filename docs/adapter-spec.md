# Tango Adapter 协议

设计草案。Adapter 把外部 Agent 接入 Tango 的任务和回合模型。Tango 自带的 Agent 直接由自身运行时驱动。

## 1. 职责

| 角色 | 职责 |
| --- | --- |
| Tango 运行时 | 管理任务时间线、执行者、回合、审批、取消与交接 |
| Adapter | 将 Tango 的请求转为外部 Agent 的原生输入，并把原生输出转换为 Tango 事件 |
| 外部 Agent | 执行任务并管理自己的原生会话、登录、工具和权限 |

## 2. Manifest

每个 Adapter 在包根目录提供 `tango.adapter.json`。以下为示例，实际能力以该 Adapter 的实现为准。

```json
{
  "id": "example-agent",
  "name": "Example Agent",
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

声明支持的模式应与恢复和权限能力一致。Tango 根据声明展示可用操作。

## 3. 接口

```ts
interface TangoAdapter {
  detect(): Promise<AgentInfo>
  start(options: StartOptions): Promise<SessionHandle>
  resume?(sessionId: string, options: StartOptions): Promise<SessionHandle>
  send(handle: SessionHandle, turn: Turn): AsyncIterable<AgentEvent>
  interrupt(handle: SessionHandle): Promise<void>
  dispose(handle: SessionHandle): Promise<void>
}
```

`send` 通过异步迭代返回事件。基础事件包括 `text_delta`、`turn_end` 和 `error`。能力允许时可传递 `reasoning`、`tool_start`、`tool_end`、`usage` 和 `permission_request`。能够在 Tango 内审批的 Adapter 还需定义如何将批准或拒绝结果传回原生会话。

## 4. 任务时间线

Tango 保存任务记录，并维护任务、Agent 与原生会话标识的映射。对话条目按回合追加，使用稳定 ID 和来源标记。示例条目如下。

```json
{
  "id": "msg_01J...",
  "taskId": "task_01J...",
  "turn": 12,
  "agentId": "reviewer",
  "role": "assistant",
  "content": [{ "type": "text", "text": "已跑完导出测试。" }],
  "toolCalls": [],
  "createdAt": "2026-11-15T00:00:00Z"
}
```

## 5. 共舞 / Unified

- 一个任务同时只允许一个执行回合，Tango 负责记录回合归属。
- 交接资料包含目标、已完成回合、工作记录、待办和当前请求。来自其他 Agent 的内容应标明来源。
- 共舞 Adapter 支持原生会话恢复。Tango 记录每个会话已接收的进度，恢复时只补交离开期间新增的已完成记录。
- 恢复失败或无法确认会话连续性时，Tango 保留任务记录，允许用户重试或建立新的原生会话。

## 6. 独舞 / Solo

- 每个任务绑定自己的原生会话，Tango 保存工作台中可见的对话和回合状态。
- 独舞的会话恢复能力按 Adapter 声明启用。跨任务消息的计划与交互见[工作区规格](workspace.md)。

## 7. 权限与数据

- 使用外部 Agent 自身的登录与权限。Tango 展示工作区范围和 Adapter 能力，提示需要到原生端完成的审批。
- Adapter 声明额外的托管目录和需要访问的数据。会话数据、日志与交接按[安全文档](../SECURITY.md)处理。

## 8. 一致性测试（计划）

- CLI 或服务发现、版本和登录状态
- 启动、发送、流式事件、取消与资源清理
- 原生权限与审批事件
- 声明会话恢复时，验证崩溃或重启后的恢复
- 声明共舞时，验证增量交接、来源标记和恢复失败行为
- 声明支持的平台上分别验证
