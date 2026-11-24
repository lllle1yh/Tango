<div align="center">

<h1><img src="assets/tango-banner.png" width="910" alt="Tango · Local agent workspace"></h1>

**独立的本地 Agent 工作台**

在一个工作台里运行自己的 Agent，让多个 Agent 沿着同一段对话继续工作。

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Project status](https://img.shields.io/badge/status-design-blue)](#project-status)
[![Target platforms](https://img.shields.io/badge/target%20platforms-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](docs/workspace.md)
[![External agent adapters](https://img.shields.io/badge/agent-adapters-6c5ce7)](docs/adapter-spec.md)
[![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)

</div>

Tango 面向每天和 Agent 一起写代码、查资料、跑测试的人。打开 Tango，选一个项目目录，就能在工作区里用 Tango Agent 开始任务。你可以让一个 Agent 独立完成，也可以把任务交给另一个 Agent 继续。任务目标、对话和工作记录随任务保存在 Tango，接手时能看到已经做了什么、还有哪些事待处理。

<a name="project-status"></a>

**项目状态**　设计阶段。[工作区规格](docs/workspace.md)和 [Adapter 协议](docs/adapter-spec.md)是实现草案。目前尚无可运行版本。

## 自己的 Agent 怎么工作

| 组成 | 职责 |
| --- | --- |
| Tango Agent | Tango 自带的执行者。可以为实现、测试等工作分别配置模型、角色指令、可用工具和权限。 |
| Tango 运行时 | 驱动模型和工具调用，管理执行回合、审批、取消与任务交接。 |
| 工作区 | 管理项目目录、任务列表、对话、工作记录和面板布局。重新打开时，可以从任务记录了解进度并继续。 |
| Adapter | 按需连接 Codex、Claude Code、DSH 等外部 Agent。外部 Agent 沿用各自的登录、原生会话、工具和权限。 |

一个工作区可以只用 Tango Agent。需要其他工具或执行环境时，再添加外部 Agent。

## 独舞与共舞

| 模式 | 怎么用 | 对话 |
| --- | --- | --- |
| **独舞 / Solo** | 选一个 Agent 做一个任务。多个任务可以各开一个面板，同时推进。 | 每个任务有独立记录。 |
| **共舞 / Unified** | 给同一个任务添加多个 Agent，按需切换执行者。同一时间由一个 Agent 执行回合。 | 共用一份任务记录，标明每轮由谁执行。 |

比如，你在 Tango 里创建「修复导出文件的编码问题」，让实现 Agent 修改导出逻辑。随后把任务交给测试 Agent。它从同一条任务时间线接手，能看到改过的文件、已经跑过的检查和待验证的内容。测试发现回归时，你可以再交回实现 Agent。你打开任务就能看到整个过程。

## 工作台

侧栏用于选择项目和任务。主区用于看对话、发指令和审批工具操作。任务时间线记录执行者、工具结果与交接。一个任务可以关联多个 Agent 面板，切换面板后仍能看到该任务的记录。

工作区的布局设计包含平铺、分屏、标签页和独立窗口。首版从单窗口开始，先把从创建任务到恢复工作的流程做通。详见[工作区规格](docs/workspace.md)。

## 首版范围

1. 打开项目目录，配置模型，用 Tango Agent 创建任务。
2. 在面板里发送指令、查看流式输出和工具结果，按需审批或停止。
3. 本地保存任务和对话，关闭后重新打开并继续。
4. 在同一个任务中切换两个 Tango Agent，交接目标、已完成工作和待办。

外部 Agent 的接入按各自的协议和能力逐项验证。欢迎提案、实现 Adapter 或参与工作台和运行时开发。 [Adapter 提案模板](.github/ISSUE_TEMPLATE/adapter-proposal.md) · [Adapter 协议](docs/adapter-spec.md) · [贡献指南](CONTRIBUTING.md)

## English

Tango is a standalone, local-first workspace for running your own agents. Its built-in runtime manages tasks, model and tool execution, approvals, and handoffs. Use one agent in Solo mode, or hand the same task between agents in Unified mode while keeping a single conversation and activity record. Codex, Claude Code, and DSH are optional integrations through adapters.

Tango is currently in the design stage. [Workspace spec](docs/workspace.md) · [Adapter spec](docs/adapter-spec.md)

## License

[MIT](LICENSE) © 2026 Tango contributors
