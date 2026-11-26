# T3 → Tango 迁移清单

Tango 是 T3 Code 的二开。这份表记录 T3 的界面工作搬到哪一步，避免"代码写了但没接线"
或者"搬了一半又重写一遍"。范围以 `t3code/apps/web/src/components` 为准。

统计口径：`components/chat` 下 160 个组件文件（不含 `*.test.*`）与 `components/ui`
下 54 个原语文件，对照 `ui/src/components`。

## 1. 原语层（`components/ui`）

**48 / 48 已搬入**（T3 另有 6 个 `*.browser.test.tsx`，测试文件不搬）。
搬入时只改 import 路径与 i18n：T3 用 `gt-react`，Tango 直接写英文；样式类保持原样，
依赖 `ui/src/tw.css` 里的 Tailwind v4 theme 与 `@utility`。

| 组 | 文件 |
| --- | --- |
| 基础 | button, badge, kbd, separator, skeleton, spinner, empty, alert |
| 表单 | checkbox, combobox, input, input-group, label, number-field, radio-group, select, switch, textarea, toggle, toggle-group, color-picker, calendar, autocomplete |
| 浮层 | dialog, sheet, menu, popover, tooltip, shared-tooltip, closing-positioner, alert-dialog, command |
| 布局 | sidebar, scroll-area, group, collapsible, collapsible-section-header, panel-tab-close-button, standalone-page |
| 其它 | table, toast, wizard, qr-code, refresh-icon, middle-truncate, draft-input, discovery-list, preview-card, background-thread |

## 2. 对话层（`components/chat`）

已搬入并接到 `App.tsx`（13 个）：

- `ComposerControl` — 输入框左下角的控制键与图标
- `ComposerSurface` — 输入框的玻璃卡片外壳
- `MessageCopyButton` — 单条消息复制
- `QueuedRuns` — 排队消息的逐条操作
- `ThreadFindBar` — 对话内查找（计数、上下跳、Esc）
- `ThreadStatusLine` — 时间线末尾的状态行
- `TimelineMinimap` — 长对话缩略刻度
- `TimelineRowParts` — 作者标题、时间戳、活动微光
- `TimelineSystemDivider` — 交接 / 暂停 / 恢复分隔行
- `TimelineAssistantRow` / `TimelineUserRow` — 消息行（按 T3 行结构改造）
- `ToolApprovalRow` — 审批卡片
- `MarkdownCodeBlock` — 代码块顶栏（语言、换行、复制）
- `DiffStatLabel` — 改动行数标签（+N / -N，大数压成 1.2k）
- `ComposerPromptLengthValidation` — 输入框超长提示
- `DraftProjectName` — 空任务标题里的项目名排版

另按 T3 的写法新写了四个适配版（T3 同名组件依赖服务端契约，直接搬不可用）：

- `ThreadDetailsPanel` — 右侧详情栏（工作区 / 会话 / 操作）
- `ThreadErrorBanner` — 失败回合的错误条（就地重试、会话内关闭）
- `AgentStatusBanner` — 所选 Agent 未安装 / 版本读不出时的提醒
- `ThreadAnnouncer` — 回合状态的读屏播报

## 3. 依赖 T3 服务端契约、Tango 没有等价数据的（132 个）

这些不是"没搬"，是 Tango 当前没有产生它们所需数据的入口。要搬必须先补数据层：

| 数据源 | 涉及组件（举例） |
| --- | --- |
| Provider 会话 / 模型 / 用量 | ProviderModelPicker, ProviderStatusBanner, ComposerModelEffort, ComposerUsageLimits, ThreadDetailsUsage |
| Git / PR / Issue | DiffPanel, ThreadDetailsPrRow(s), ThreadRepositorySections, BranchToolbar |

Git 分支已开始补：`git:status` / `git:diff-stat` 两个 IPC 已接到 `ThreadDetailsPanel` 的
「Repository」一节（分支、领先/落后、改动文件数、工作区 +/-）。PR / Issue 仍无数据源，
`DiffPanel` 的逐行 diff 也还没接。
| 预览会话 / 设备 / 分享 | ChatRightPanel 的 preview/device 面、GuestShareControls, HtmlRenderDialog, McpAppFrame |
| 子代理 / 后台任务 / 计划 | BackgroundWorkDetails, ThreadActivityBanners, ProposedPlanCard, SubagentTooltipContent |
| 附件 / 图像 / 语音 | ComposerImageThumbnail, ExpandedImageDialog, VoiceInputPill, AttachmentImage |
| 富文本编辑器（Tiptap）与技能 / 提及 | ComposerPromptEditorTiptap, SkillInlineText, ModelMentionChip |
| Pierre / Shiki 高亮 | HighlightedCodeLines, PierreEntryIcon, MarkdownCodeBlock 的 Shiki 路径 |

## 4. 接下去要搬的（纯展示、不依赖服务端契约）

- `ComposerBanner` / `ComposerPromptLengthValidation` — 输入框上方的提示与长度校验
- `DraftProjectName` — 空任务标题里的项目名排版
- `ProviderPackageIcon` — 包装成 Tango 的 Agent 图标位

## 5. 已知适配差异

- T3 的 `--chat-content-max-width` 是 820px；Tango 的消息列按 796px 收过，两者需要保持一致。
- T3 用 `gt-react` 做 i18n；Tango 目前写英文文案，翻译要另起一层。
- T3 的 `ThreadDetailsPanel` 走 popover / sheet 两种模式；Tango 先在对话列右侧内联。
