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

Tango 是一个 DSH 桌面插件。它把不同 agent 放进同一个工作区：你可以让它们共用一条对话、随时换谁执行；也可以让它们各自独立、互相发消息。

**你不再需要决定“这轮该用哪个 agent”。你只是在同一个对话里继续。**

## 为什么需要 Tango

Agent 不该逼你选边。

有人离不开 Codex 的某个工作流，有人把 Claude Code 的 hooks 和 CLAUDE.md 用成了肌肉记忆，有人喜欢 DSH 的原生体验和插件生态。每个 agent 也都有自己的长处：有的擅长长任务，有的擅长终端操作，有的接入了你离不开的模型或工具。

Tango 不要求你迁移，也不要求二选一。它让不同的 agent 共用一条对话，或者各自独立、互相协作。

## 一个具体例子

你在 DSH 面板里说：“把登录改成 JWT。”

1. DSH 改了 auth 中间件，停在测试失败。
2. 你点旁边 Claude Code 面板的「接棒」。
3. Claude Code 不用你复述：它看到 DSH 刚才说了什么、改了哪些文件，直接接着修。
4. 你切回 DSH，DSH 也看得到 Claude Code 的改动。
5. 整条对话仍然只有一份记录，不是两份。

这就是“像一个 agent”。

## 两种用法

### 共舞 / Unified

- 所有参与者共用一条对话。
- 每个回合选执行者：DSH、Claude Code、Codex，或后续接入的其他 agent。
- 切回时只补交离开期间的已完成回合和工作记录，不重放全量。
- 每个 agent 仍保留自己的原生会话、工具、权限和项目指令（CLAUDE.md / AGENTS.md）。

### 独舞 / Solo

- 每个 agent 独立会话，上下文互不污染。
- 按名字互发消息；对方忙时消息排队。
- 你可以随时切到任意面板接管。

| | 共舞 / Unified | 独舞 / Solo |
| --- | --- | --- |
| 上下文 | 共用一条对话 | 各自独立 |
| 谁执行 | 每回合你选，或自动接棒 | 各自跑各自的 |
| 切换 | 随时切，只补增量 | 不切换 |
| 适合 | 一件事，换擅长的 agent 接着做 | 多件事并行，或让 agent 互相派活 |
| 消息 | 不需要额外发消息 | 通过消息总线互发 |

## 工作区

像 Windows 窗口一样平铺，不是固定左右两栏。

```text
┌──────────────────────────────┬──────────────────────────────┐
│  DSH                         │  Claude Code                 │
│                              │                              │
├──────────────────────────────┼──────────────────────────────┤
│  Codex                       │  终端 / 其他 agent           │
│                              │                              │
└──────────────────────────────┴──────────────────────────────┘
```

- 面板数量不限，可拖动、缩放、分屏、开标签页。
- 任意面板可以拖出成独立系统窗口，放到第二块屏幕。
- 几个面板可以编组共舞，其他面板独舞。
- 布局按工作区保存，下次打开恢复原样。

更细的面板、交互和持久化定义见 [docs/workspace.md](docs/workspace.md)。

## 支持的 agent

| Agent | 共舞 | 独舞 | 接入方式 | Adapter |
| --- | --- | --- | --- | --- |
| DSH | ✓ | ✓ | 内置 session API | 官方 |
| Claude Code | ✓ | ✓ | stream-json / Agent SDK | 官方（开发中） |
| Codex | ✓ | ✓ | app-server JSON-RPC | 官方（开发中） |
| Gemini CLI | ✓ | ✓ | MCP / ACP | 社区 |
| Kimi Code | ✓ | ✓ | ACP | 社区 |
| 你的 agent | ✓ | ✓ | [Adapter API](docs/adapter-spec.md) | 你 |

首批官方 adapter 正在开发中；社区 adapter 现在就可以提案。

## 生态：把你的 agent 接进来

Tango 不靠往内核里塞更多 agent 来扩展，而是让**任何人都能把自己的 agent 接进来**。

一个 adapter 只需要实现四件事：

| 能力 | 说明 |
| --- | --- |
| `detect()` | 找到 CLI、版本、登录状态 |
| `start()` / `resume()` | 启动或恢复原生会话 |
| `send()` / `stream()` | 发送一轮，流式返回正文与工具活动 |
| `interrupt()` | 取消当前回合 |

一个 adapter 的 manifest 很简单：

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

1. 用 [Adapter 提案模板](.github/ISSUE_TEMPLATE/adapter-proposal.md) 开 issue，说明 agent、传输方式、登录方式和平台。
2. 按 [adapter 协议](docs/adapter-spec.md) 实现最小可用 adapter。
3. 跑一致性测试，提交 PR；通过后进入 adapter 列表。

后续会有 adapter 注册表和 DSH 插件市场的一键安装。想让自己的 agent 进入首批名单，现在就可以开提案。

## Tango 不是什么

- 不是模型聚合器，也不是 API 网关。
- 不是新的聊天客户端；界面仍然是 DSH 和你熟悉的终端。
- 不替代 DSH / Claude Code / Codex 的原生能力。
- 不把会话上传到云端。

## FAQ

**Tango 是另一个聊天客户端吗？**  
不是。它是 DSH 桌面端的一个插件，加一层中立的调度器；聊天界面仍然是 DSH 和你熟悉的终端。

**会取代 DSH / Claude Code / Codex 吗？**  
不会。每个 agent 仍然按自己的方式运行，Tango 只负责会话、切换和消息。

**必须把所有 agent 都接进来吗？**  
不用。你可以只用一个 agent，也可以只让两个 agent 共舞，其他面板独舞。

**面板只能左右两个吗？**  
不是。可以平铺成任意数量，拖动、缩放、分屏、开标签页，也可以把任意面板拖出成独立系统窗口。

**需要把会话上传到云端吗？**  
不需要。默认全部在本机，adapter 也遵守本地优先。

**我能接入自己的 agent 吗？**  
能。只要能启动一个进程并通过 stream/stdout 或 MCP/ACP 通信，就可以写 adapter。

**为什么叫 Tango？**  
Tango 是两个人的舞，但舞池可以站很多人。共舞时是一支舞，独舞时各跳各的。

## 参与贡献

Tango 的生态需要更多 adapter、更多界面想法和更多真实使用场景。欢迎：

- 提出新的 adapter（Claude Code、Codex、Gemini、Kimi、Aider、OpenCode……）
- 参与调度协议与 handoff 设计
- 做多面板工作区的 UI / UX（平铺、分屏、标签页、拖出窗口）
- 补文档、翻译、测试用例
- 报告你遇到的 agent 兼容性问题

详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## English

**Tango** makes Claude Code, Codex, DSH and other agents feel like one agent.

- **Unified** — one shared conversation; choose who executes each turn; switch anytime, with only the delta handed over.
- **Solo** — native sessions stay separate, with a local message bus for agent-to-agent messages.
- **Flexible panes** — resize, drag, split, tab, add or remove panes like windows; detach any pane into its own OS window.
- **Extensible** — bring your own agent through the [adapter API](docs/adapter-spec.md).

## License

[MIT](LICENSE) © 2026 Tango contributors
