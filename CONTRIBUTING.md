# Contributing to Tango

Tango 是独立的本地 Agent 工作台，目前处于设计阶段。了解项目定位、首版范围与实现草案。 [README](README.md) · [工作区规格](docs/workspace.md) · [Adapter 协议](docs/adapter-spec.md)

## 可以贡献什么

- **Tango Agent 与运行时**　角色和模型配置、工具调用、权限审批、回合取消、任务恢复与交接。
- **工作台**　项目与任务导航、独舞和共舞交互、对话、工具活动与布局。
- **外部接入**　Agent Adapter、平台兼容性与一致性测试。
- **文档与测试**　使用场景、协议示例、翻译与跨平台用例。

## 提案一个 Adapter

提交提案时，请写清 Agent 名称、仓库和许可证、传输协议、登录方式、会话恢复能力、权限模型与目标平台，并注明计划首先支持的模式。 [Adapter 提案模板](.github/ISSUE_TEMPLATE/adapter-proposal.md)

Adapter 验收按声明的能力检查，覆盖发现、启动、流式事件、中断与清理。支持共舞时，补充会话恢复、增量交接和来源标记的测试。 [Adapter 协议](docs/adapter-spec.md)

## 提交 PR

- [ ] 说明改动对应的使用场景。
- [ ] 附上验证步骤、测试结果或可复现的 fixture。
- [ ] 更新相关文档及支持范围。
- [ ] 清理密钥、token、会话日志和个人路径。

安全问题按安全文档私下报告。 [SECURITY.md](SECURITY.md)
