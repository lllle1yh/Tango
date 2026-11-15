# Security

Tango 默认本地运行，不上传会话。即便如此，adapter 会启动本地进程、读取会话并可能访问凭据，所以安全边界必须说清楚。

## 报告问题

请不要在公开 issue 里贴 API key、token、完整对话日志或可利用细节。请私下联系维护者，或在 GitHub 的 Security Advisory 中提交。

## 设计边界

- bridge 只监听 `127.0.0.1`，使用随机 bearer token。
- 会话、消息、账本默认存放在本机 `~/.dsh/tango/`。
- 日志不得输出密钥、token、原始 stderr。
- work ledger 对常见凭据形态先脱敏。
- adapter 不得静默改写用户的全局配置；需要托管目录时必须在 manifest 中显式声明。
- 共舞模式的 handoff 必须做身份隔离，避免一个 agent 把另一个 agent 的历史当成自己的记忆。

## 支持的版本

项目尚在设计阶段，暂未发布可安装版本。发布后将在此列出安全支持范围。
