# Contributing to Tango

Tango 还在设计阶段。请先达成设计共识，再写实现；这样 adapter 生态才不会各自长歪。

## 先读

- [README](README.md)
- [Adapter 协议草案](docs/adapter-spec.md)
- README 里的「设计原则」

## 可以贡献什么

- **Adapter**：接入新的 agent（Claude Code、Codex、Gemini、Kimi、Aider、OpenCode……）
- **调度与协议**：canonical ledger、回合仲裁、增量 handoff、身份隔离
- **桌面 UI**：多面板工作区、平铺/分屏/标签页、拖出独立窗口、模式开关
- **文档与翻译**：中英文优先，欢迎其他语言
- **测试**：adapter 一致性测试、跨平台用例
- **问题报告**：某个 agent 在你的机器上跑不起来、恢复失败、权限异常

## 提案一个 adapter

请用 [Adapter 提案模板](.github/ISSUE_TEMPLATE/adapter-proposal.md) 开 issue，至少写清：

- agent 名称、仓库、许可证
- 接入方式：CLI / API / SDK，传输协议是什么
- 登录与鉴权方式
- 是否支持原生 session 恢复
- 工具与权限模型
- 支持的平台
- 你是否愿意自己实现

先讨论，再写代码。一个 adapter 不需要一次支持两种模式；先做独舞或先做共舞都可以。

## Adapter 验收标准（草案）

- 实现 `detect` / `start` / `send` / `stream` / `interrupt`
- 共舞模式：支持 `resume`、增量 handoff、身份隔离
- 独舞模式：支持消息总线、忙时排队、人工接管
- 日志不泄漏密钥、token、原始 stderr
- 明确声明支持的平台；Windows 不能默认「应该能跑」
- 许可证与 MIT 兼容

完整接口见 [docs/adapter-spec.md](docs/adapter-spec.md)。

## 开发

仓库尚未搭起代码骨架。当前阶段欢迎文档、协议、设计类 PR；代码骨架会在 Phase 1 开始后提供。

## PR 检查清单

- [ ] 一个 PR 只做一件事
- [ ] 附上测试或可复现的 fixture
- [ ] 更新相关文档
- [ ] 没有提交密钥、token、个人路径
- [ ] 符合 README 的设计原则

## Commit 风格

建议使用常见前缀：`feat:` `fix:` `docs:` `refactor:` `test:` `chore:`。

## 安全

不要在 issue / PR 里贴 API key、token、完整对话日志。发现安全问题请私下联系维护者，不要公开细节。

## 行为准则

保持基本的尊重。讨论设计可以尖锐，对人不要。

## 讨论

优先用 Issues；较大的设计变更请先开 issue，不要直接大 PR。
