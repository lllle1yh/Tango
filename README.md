<div align="center">

# Tango

**同一个对话，任意 agent 都能接。**
**One conversation, any agent.**

让 Claude Code、Codex、DSH 和其他 agent，用起来像同一个 agent。

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](#)
[![DSH](https://img.shields.io/badge/DSH-plugin-6c5ce7)](https://github.com/deepseek-ai/deepseek-harness)
[![Adapter ecosystem](https://img.shields.io/badge/adapter-ecosystem-6c5ce7)](CONTRIBUTING.md)
[![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)

</div>

Tango 是 DSH 桌面端的一个插件，让不同 agent 共用同一段对话。你可以从最顺手的 agent 开始一个任务，在中途切换执行者，而无需重开对话或重新说明上下文；也可以将多个 agent 组合成一组，让它们以同一个 agent 的方式协同工作。Codex、DSH、Claude Code，都可以成为执行者。

**独立执行、中途切换、协同执行，都在同一段对话中完成。**

## 三种常见用法

| 场景 | 使用方式 |
| --- | --- |
| 单个任务，单个 agent | 打开一个面板，使用 Codex、DSH 或 Claude Code |
| 任务进行中切换 | 在另一个面板接棒继续，无需重开对话或重复说明 |
| 多个 agent 协同 | 将面板组合成一组，共享同一段对话，以同一个 agent 的方式工作 |

## 为什么需要 Tango

选择 agent 不应该成为负担。

有人依赖 Codex 的特定工作流，有人习惯了 Claude Code 的 hooks 与 CLAUDE.md，有人偏爱 DSH 的原生体验和插件生态。每个 agent 也各有长处：有的更适合长时间运行的任务，有的在终端操作上更顺手，有的能直接使用你常用的模型和工具。

Tango 不要求你迁移，也不要求二选一。你可以继续单独使用一个 agent；需要切换或协同执行时，它负责保持对话的连续性。

## 一个典型场景

你在 DSH 面板里输入：“把登录改成 JWT。”

1. DSH 修改了 auth 中间件，测试未通过。
2. 你在旁边的 Claude Code 面板选择接棒。
3. Claude Code 无需你重复说明：它能读取 DSH 刚才的消息和修改过的文件，继续修复。
4. 你切回 DSH，DSH 也能看到 Claude Code 的改动。
5. 整段对话始终只有一份记录，而不是两份。

这就是 Tango 想提供的体验：始终像一个 agent 一样连续。

## 两种模式

两种模式并不互斥：同一个工作区里可以同时存在共舞组和独立面板。

### 共舞 / Unified

需要多个 agent 协同执行时，将面板组合成一组。

- 所有参与者共享同一段对话。
- 可随时切换执行者：DSH、Claude Code、Codex，或后续接入的其他 agent。
- 切回时只补交离开期间的已完成回合和工作记录，不重放完整历史。
- 每个 agent 仍保留自己的原生会话、工具、权限和项目指令（CLAUDE.md / AGENTS.md）。

### 独舞 / Solo

日常单个任务使用一个 agent，即独舞模式；也可以同时打开多个独立面板。

- 每个 agent 拥有独立会话，上下文互不影响。
- 可通过名称互相发送消息；对方忙碌时消息进入队列。
- 你可以随时切换到任意面板接管。

| | 共舞 / Unified | 独舞 / Solo |
| --- | --- | --- |
| 上下文 | 共享同一段对话 | 各自独立 |
| 执行者 | 可随时切换 | 各自独立执行 |
| 切换 | 随时切换，仅补交增量 | 切换后不共享上下文 |
| 适用场景 | 单个任务协同执行，或中途换人 | 日常独立使用，或多任务并行 |
| 消息 | 无需额外通信 | 通过消息总线互发 |

## 工作区

采用类似 Windows 的平铺式布局，而不是固定的左右分栏。

```text
┌──────────────────────────────┬──────────────────────────────┐
│  DSH                         │  Claude Code                 │
│                              │                              │
├──────────────────────────────┼──────────────────────────────┤
│  Codex                       │  终端 / 其他 agent           │
│                              │                              │
└──────────────────────────────┴──────────────────────────────┘
```

- 面板数量不限，支持拖动、缩放、分屏和标签页。
- 任意面板都可以拖出为独立系统窗口，放置到第二块屏幕。
- 多个面板可以组合成共舞组，其余面板保持独立。
- 布局按工作区保存，下次打开时恢复原状。

更详细的面板、交互与持久化定义见 [docs/workspace.md](docs/workspace.md)。

## 支持的 agent

| Agent | 共舞 | 独舞 | 接入方式 | Adapter |
| --- | --- | --- | --- | --- |
| DSH | ✓ | ✓ | 内置 session API | 官方 |
| Claude Code | ✓ | ✓ | stream-json / Agent SDK | 官方（开发中） |
| Codex | ✓ | ✓ | app-server JSON-RPC | 官方（开发中） |
| Gemini CLI | ✓ | ✓ | MCP / ACP | 社区 |
| Kimi Code | ✓ | ✓ | ACP | 社区 |
| 你的 agent | ✓ | ✓ | [Adapter API](docs/adapter-spec.md) | 你 |

首批官方 adapter 正在开发中；社区 adapter 现在即可提案。

## 生态：接入自己的 agent

Tango 的扩展方式不是不断往内核里加入更多 agent，而是让任何人都能接入自己的 agent。

一个 adapter 只需实现四项能力：

| 能力 | 说明 |
| --- | --- |
| `detect()` | 发现 CLI、版本与登录状态 |
| `start()` / `resume()` | 启动或恢复原生会话 |
| `send()` / `stream()` | 发送一轮请求，流式返回正文与工具活动 |
| `interrupt()` | 取消当前回合 |

一个 adapter 的 manifest 保持简单：

```json
{
  "id": "claude-code",
  "name": "Claude Code",
  "modes": ["unified", "solo"],
  "transport": "stream-json",
  "entry": "./adapter.mjs"
}
```

接入步骤：

1. 使用 [Adapter 提案模板](.github/ISSUE_TEMPLATE/adapter-proposal.md) 提交 issue，说明 agent、传输方式、登录方式和目标平台。
2. 按照 [adapter 协议](docs/adapter-spec.md) 实现最小可用 adapter。
3. 运行一致性测试并提交 PR；通过后列入 adapter 列表。

后续将提供 adapter 注册表和 DSH 插件市场的一键安装。希望自己的 agent 进入首批名单，现在就可以提交提案。

## Tango 不做什么

- 不是模型聚合器，也不是 API 网关。
- 不是新的聊天客户端；界面仍然是 DSH 和你熟悉的终端。
- 不替代 DSH / Claude Code / Codex 的原生能力。
- 不将会话上传到云端。

## FAQ

**Tango 是另一个聊天客户端吗？**  
不是。它是 DSH 桌面端的一个插件，负责把对话交给下一个接棒的 agent；聊天界面仍然是 DSH 和你熟悉的终端。

**会取代 DSH / Claude Code / Codex 吗？**  
不会。每个 agent 仍然按自己的方式运行，Tango 只负责会话、切换和消息。

**必须把所有 agent 都接进来吗？**  
不需要。你可以只使用一个 agent，也可以只让两个 agent 共舞，其余面板保持独立。

**面板只能左右两个吗？**  
不是。面板可以平铺成任意数量，支持拖动、缩放、分屏和标签页，也可以将任意面板拖出为独立系统窗口。

**需要把会话上传到云端吗？**  
不需要。默认全部保存在本机，adapter 也遵循本地优先原则。

**我能接入自己的 agent 吗？**  
可以。只要能启动进程，并通过 stream/stdout 或 MCP/ACP 通信，就可以编写 adapter。

**为什么叫 Tango？**  
Tango 是两个人的舞，但舞池可以容纳更多人。共舞时是一支舞，独舞时各自独立。

## 参与贡献

Tango 的生态需要更多 adapter、更多界面想法和真实使用场景。欢迎：

- 提出新的 adapter（Claude Code、Codex、Gemini、Kimi、Aider、OpenCode 等）
- 参与调度协议与 handoff 设计
- 参与多面板工作区的 UI / UX（平铺、分屏、标签页、独立窗口）
- 补充文档、翻译和测试用例
- 报告 agent 兼容性问题

详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## English

**Tango** is a DSH Desktop plugin that lets different agents share one conversation. Start a task with whichever agent fits, switch the executor at any point without restarting or re-explaining, or link multiple agents into a group that works as one. Codex, DSH, Claude Code — any of them can join.

- **Unified** — one shared conversation; switch the executor at any time; only the delta is handed over.
- **Solo** — independent native sessions, with a local message bus for agent-to-agent communication.
- **Flexible panes** — resize, drag, split, tab, add or remove panes like windows; detach any pane into its own OS window.
- **Extensible** — add your own agent through the [adapter API](docs/adapter-spec.md).

## License

[MIT](LICENSE) © 2026 Tango contributors
