# Security

## 报告问题

请通过 GitHub Security Advisory 或私下联系维护者报告。公开 issue 和 PR 中请省略 API key、token、完整对话日志和可利用细节。

## 设计边界

- Tango 管理任务和工作记录，默认存放在自己的本机用户数据目录。所选 Agent 根据自身配置处理执行所需的上下文。
- 接入的 Agent 按自己的权限执行工具。Adapter 需要如实传递其能力和审批状态。
- 实现本地 HTTP bridge 时，监听 `127.0.0.1` 并对请求使用随机 bearer token。
- 日志须过滤密钥、token 与原始 stderr。跨 Agent 交接前对工作记录中的常见凭据形态脱敏。
- Adapter 沿用所接入 Agent 的原生登录状态。修改用户全局配置需要用户确认，额外托管目录应在 manifest 中声明。
- 交接资料保留来源和执行者标记，确保回合归属可追溯。

## 支持的版本

Tango 仍在设计阶段，安全支持范围将在首次发布时说明。
