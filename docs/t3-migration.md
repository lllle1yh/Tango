# T3 → Tango 迁移清单

生成自 `t3code/apps/web/src/components/chat`（160 个组件文件，不含测试）。

- 已搬入并接线：**31**（与 T3 `components/chat` 同名且可运行；另有 10 个 Tango 自写组件，见「Tango 自写」）
- 纯展示、可搬但尚未搬：**12**
- 依赖 T3 服务端契约（provider / PR / diff / 预览会话 / 后台任务 / 附件），Tango 没有对应数据源：**130**

> 计数说明：29 是与 T3 `components/chat` 同名、且在 Tango 里真的挂到界面上的文件（`ComposerPermissionsSection` 等其余文件归在「Tango 自写」）；另外
> `MarkdownAlert`、`ChatRightPanel`、`RightPanelTabs`、`ScrollToEndButton`、`WorkspaceFileDropOverlay`、
> `MarkdownMath`、`ImageLightbox` 分别搬自 T3 的 `ChatMarkdown`、根目录组件、`TimelineOverlays`
> 或 `ExpandedImageDialog`，T3 没有同名文件。
> 130 这一类不是「没搬」，而是 Tango 目前没有对应数据源，硬搬只能做成占位实现，不符合仓库约定。

## 已搬入

- `ComposerBanner.tsx`（328 行）
- `ComposerCommandMenuLayer.tsx`（111 行，适配 `observeResize` 路径）
- `ReadOnlyComposerBar.tsx`（37 行）
- `ChatBannerLane.tsx`（64 行，Tango 适配版：只留错误条）
- `MarkdownDetails.tsx`（108 行，适配为原生 details）
- `MarkdownExternalLink.tsx`（118 行，去掉品牌图标只留 favicon）
- `MarkdownAlert.tsx`（T3 ChatMarkdown 的提示块渲染：Note/Tip/Important/Warning/Caution）
- `ChatRightPanel.tsx` + `RightPanelTabs.tsx`（照 T3 根目录同名组件改写：右侧面板共用外壳与页签）
- `ScrollToEndButton.tsx`（T3 `TimelineOverlays` 的「滚到底」胶囊，带末尾摘要）
- `composerPromptHistory.ts`（搬自 T3 同名文件：回填历史时剥掉上下文块并去重）
- `ComposerAttachmentStrip.tsx`（Tango 版：本地文件路径代替 T3 的上传资产）
- `WorkspaceFileDropOverlay.tsx`（搬自 T3 `TimelineOverlays` 的拖拽提示）
- `ComposerFreshSession.tsx`（搬自 T3 同名文件：下一条消息开新会话的横幅）
- `MermaidDiagram.tsx` + `MarkdownMermaidCodeBlock.tsx`（搬自 T3：pele 画图，可切源码、点开大图；$$ 数学标签暂不支持）
- `ImageLightbox.tsx`（T3 ExpandedImageDialog 的最小版：点开消息里的图片看大图，Esc 关闭）
- `ComposerPermissionsSection.tsx`（照 T3 同名组件改写：输入框底栏选 Claude 权限模式，即时保存）
- `MarkdownFileLink.tsx`（搬自 T3：消息里指向项目文件的内联代码可点，交系统默认程序打开）
- `PierreEntryIcon.tsx` + `pierreIcons.ts`（搬自 T3：按文件类型显示图标，用于改动列表与附件芯片）
- `markdownGithubAlerts.ts`（搬自 T3 `packages/shared`：把 `> [!NOTE]` 标成 dataAlert）
- `ProviderPackageIcon.tsx`（Tango 适配版：Agent 图标位）
- `ComposerBannerStack.tsx`（228 行）
- `ComposerControl.tsx`（82 行）
- `ComposerPromptLengthValidation.tsx`（14 行）
- `ComposerSurface.tsx`（86 行）
- `DiffStatLabel.tsx`（47 行）
- `DraftHeroProjectHeading.tsx`（77 行）
- `DraftProjectName.tsx`（17 行）
- `MarkdownCodeBlock.tsx`（375 行）
- `MarkdownTable.tsx`（89 行）
- `MessageCopyButton.tsx`（62 行）
- `ThreadDetailsPanel.tsx`（380 行）
- `ThreadErrorBanner.tsx`（149 行）
- `ThreadFindBar.tsx`（157 行）
- `ThreadStatusLine.tsx`（28 行）
- `TimelineMinimap.tsx`（314 行）
- `TimelineRowParts.tsx`（66 行）
- `TimelineSystemDivider.tsx`（86 行）

## 可搬但尚未搬

- `ChatRightPanel.tsx`（52 行）
- `ComposerCodeBlockNodeView.tsx`（57 行）
- `ComposerCommandMenuLayer.tsx`（112 行）
- `ComposerImageThumbnail.tsx`（81 行）
- `ComposerPendingTerminalContexts.tsx`（33 行）
- `HighlightedCodeLines.tsx`（47 行）
- `PierreEntryIcon.tsx`（96 行）
- `ProviderPackageIcon.tsx`（69 行）
- `ReadOnlyComposerBar.tsx`（38 行）
- `ThreadDetailsSection.tsx`（50 行）
- `VoiceInputPill.tsx`（77 行）
- `WorkLog.tsx`（193 行）

## 依赖 T3 服务端契约，需先有等价数据

- `AgentElapsed.tsx`（74 行）
- `AssistantCitationChip.tsx`（371 行）
- `AssistantCitationCommentEditor.tsx`（150 行）
- `AssistantCitationSource.tsx`（382 行）
- `AssistantSelectionToolbar.tsx`（222 行）
- `BackgroundWorkDetails.tsx`（123 行）
- `ChatBannerLane.tsx`（65 行）
- `ChatCanvas.tsx`（203 行）
- `ChatComposer.tsx`（4196 行）
- `ChatGptSharingControl.tsx`（40 行）
- `ChatHeader.tsx`（420 行）
- `ChatMarkdownMedia.tsx`（511 行）
- `ChatOverlayHosts.tsx`（298 行）
- `ChatTerminalDrawers.tsx`（108 行）
- `ChildThreadApprovals.tsx`（105 行）
- `CollapsedComposerPromptPreview.tsx`（129 行）
- `CommandOutputPanel.tsx`（106 行）
- `CompactComposerControlsMenu.tsx`（57 行）
- `ComposerAttachmentStrip.tsx`（790 行）
- `ComposerCodeBlockLanguagePicker.tsx`（114 行）
- `ComposerCommandMenu.tsx`（369 行）
- `ComposerControlsBar.tsx`（316 行）
- `ComposerFeedback.tsx`（56 行）
- `ComposerFooterControls.tsx`（340 行）
- `ComposerFreshSession.tsx`（23 行）
- `ComposerHeldSendBanner.tsx`（51 行）
- `ComposerModelEffort.tsx`（740 行）
- `ComposerPendingApprovalActions.tsx`（162 行）
- `ComposerPendingUserInputPanel.tsx`（371 行）
- `ComposerPrimaryActions.tsx`（553 行）
- `ComposerServerUpdateStatus.tsx`（15 行）
- `ComposerSpeechButton.tsx`（261 行）
- `ComposerStashBadge.tsx`（67 行）
- `ComposerStashMenu.tsx`（290 行）
- `ComposerUsageLimits.tsx`（195 行）
- `DraftHeroHeadline.tsx`（391 行）
- `EffortGlyph.tsx`（108 行）
- `ExpandedImageDialog.tsx`（352 行）
- `ExpandedImagePreview.tsx`（221 行）
- `FeedbackRequestCard.tsx`（219 行）
- `FileSearchResults.tsx`（135 行）
- `FileTagChip.tsx`（28 行）
- `GlobalVoiceInputIndicator.tsx`（54 行）
- `GuestMessageAttachments.tsx`（107 行）
- `GuestShareControls.tsx`（354 行）
- `HighlightedTokens.tsx`（122 行）
- `HtmlRenderDialog.tsx`（111 行）
- `HtmlRenderFrame.tsx`（152 行）
- `LinkRequestCard.tsx`（541 行）
- `LinkedThreadPage.tsx`（68 行）
- `LinkedThreadPane.tsx`（269 行）
- `MarkdownDetails.tsx`（108 行）
- `MarkdownExternalLink.tsx`（118 行）
- `MarkdownFileLink.tsx`（471 行）
- `MarkdownMermaidCodeBlock.tsx`（87 行）
- `MarkdownThreadLink.tsx`（145 行）
- `McpAppFrame.tsx`（531 行）
- `McpSignInAction.tsx`（215 行）
- `MermaidDiagram.tsx`（327 行）
- `MessagesTimeline.tsx`（1973 行）
- `ModelListRow.tsx`（155 行）
- `ModelMentionChip.tsx`（128 行）
- `ModelPickerContent.tsx`（1263 行）
- `ModelPickerSidebar.tsx`（235 行）
- `NativeChildWorkDialog.tsx`（147 行）
- `OpenInPicker.tsx`（362 行）
- `PanelLayoutControls.tsx`（266 行）
- `ProposedPlanCard.tsx`（337 行）
- `ProviderInstanceIcon.tsx`（195 行）
- `ProviderModelPicker.tsx`（506 行）
- `ProviderStartingIcon.tsx`（68 行）
- `ProviderStatusBanner.tsx`（254 行）
- `ProviderSubagentBar.tsx`（92 行）
- `QueuedRunsControl.tsx`（631 行）
- `ReadOnlyThreadTimeline.tsx`（147 行）
- `RightPanelSurfaceContent.tsx`（311 行）
- `SecretRequestCard.tsx`（382 行）
- `ShellCommandBlock.tsx`（65 行）
- `SideThreadPane.tsx`（224 行）
- `SkillInlineText.tsx`（162 行）
- `SnapShotAttachmentDetails.tsx`（248 行）
- `SubagentTooltipContent.tsx`（220 行）
- `TerminalContextInlineChip.tsx`（78 行）
- `ThreadActivityAnnouncer.tsx`（189 行）
- `ThreadActivityBanners.tsx`（355 行）
- `ThreadAutomationsPanel.tsx`（286 行）
- `ThreadContextDragGhost.tsx`（26 行）
- `ThreadDetailsCard.tsx`（202 行）
- `ThreadDetailsControl.tsx`（142 行）
- `ThreadDetailsIssueRows.tsx`（187 行）
- `ThreadDetailsItemsMenu.tsx`（50 行）
- `ThreadDetailsPrRow.tsx`（629 行）
- `ThreadDetailsPrRows.tsx`（205 行）
- `ThreadDetailsUsage.tsx`（392 行）
- `ThreadFindProvider.tsx`（49 行）
- `ThreadLineageWorkflowRow.tsx`（301 行）
- `ThreadNow.tsx`（100 行）
- `ThreadRelationshipIcon.tsx`（113 行）
- `ThreadRelationshipsControl.tsx`（1162 行）
- `ThreadRepositorySections.tsx`（372 行）
- `ThreadServersPanel.tsx`（355 行）
- `ThreadTimeline.tsx`（61 行）
- `ThreadVisitWatermark.tsx`（38 行）
- `TimelineAssistantRows.tsx`（403 行）
- `TimelineOverlays.tsx`（57 行）
- `TimelinePendingApprovalRow.tsx`（133 行）
- `TimelineToolActivityIcon.tsx`（277 行）
- `TimelineUserMessageRow.tsx`（1311 行）
- `TimelineV2EventRow.tsx`（182 行）
- `TimelineWorkEntryRow.tsx`（823 行）
- `TimelineWorkGroupRows.tsx`（773 行）
- `TraitsPicker.tsx`（590 行）
- `TraitsSpeed.tsx`（78 行）
- `TriageDraftHero.tsx`（80 行）
- `UsageLimitRecoveryBanner.tsx`（216 行）
- `UserMessageContextChips.tsx`（658 行）
- `V2ItemInspector.tsx`（431 行）
- `V2LifecycleRow.tsx`（776 行）
- `VoiceInputErrorPill.tsx`（118 行）
- `VoiceInputSetup.tsx`（300 行）
- `WorkflowOpeningBlock.tsx`（253 行）
- `WorkspaceEntryIcon.tsx`（42 行）
- `WorktreeSetupCard.tsx`（409 行）
- `ZoomableImage.tsx`（266 行）
- `composerProviderState.tsx`（202 行）
- `guestMessageStyle.tsx`（21 行）
- `useAutoBalanceUpdateBanner.tsx`（181 行）
- `useProjectCloneBanner.tsx`（138 行）
- `useSystemComposerBanners.tsx`（299 行）
- `useThreadLifecycle.tsx`（773 行）

## Markdown 管线的对齐

T3 的 `packages/shared/src/markdownPipeline.ts` 用 `remarkRehype({ allowDangerousHtml: true })` + `rehype-raw` 让 Markdown 里的
`<details><summary>` 等 HTML 块真正变成元素，再用 sanitize 洗一遍。Tango 的 `ui/src/Markdown.tsx` 现在也走这条管线，
并给 sanitize schema 补了 `blockquote` 的 `dataAlert` 属性，`remarkGithubAlerts` 才有地方落脚。已验证：
折叠块点击展开/收起、内容渲染代码块；`> [!NOTE]` / `> [!WARNING]` 各自的色线与图标；`#fragment` 链接不新开窗口。

## 附件（Tango 版）

T3 的附件由服务端上传、按资产 ID 引用；Tango 没有这层服务，改为本地文件：

- 粘贴图片或复制文件 → 主进程 `attachments:save` 存到 `<userData>/attachments/`（扩展名白名单、25 MB 上限）
- 从系统拖文件 → 只取真实路径（`webUtils.getPathForFile`），不复制
- 发送时在消息末尾追加 `Attached files (read them from disk if you need them):` 列表，Agent 自己读
- 回填历史（上方向键）会剥掉这段列表，只留用户原话
- 输入框上方显示芯片（文件名、大小、移除），拖动经过时浮出 `Drop files to attach`

## 任务与原生会话的绑定

一个会话窗口对应一个原生 Agent 会话，判定顺序如下（`ui/src/App.tsx`、`electron/main.ts`）：

- 打开任务：选**最近一次真正跑成的回复**所属的 Agent；失败回合（`The turn could not run:`）不计，
  否则一次失败就会把窗口改绑到失败的 Agent。
- 新建任务：用设置里的默认 Agent。
- 发送：`threadId` / `claudeSessionId` / `dshSessionId` / `piSessionFile` 指向的原生会话会被 resume，
  窗口里看到的历史就是那个原生会话的历史。
- `/new-session`：清掉这些引用并丢弃内存客户端，下一条消息开新会话。
- 存的会话文件不在了（`No conversation found with session ID`，或 resume 参数不是有效 UUID）：主进程丢弃旧会话，
  用新会话重跑这一轮，并把最近 12 条记录作为上下文开头一起发过去；回复带 `sessionReset` 标记，
  时间线上插一行「Started a fresh session」。实测：会话丢失的任务问「我之前让你记什么」，回答 `APPLE`。
- Claude 子进程会清掉继承的 `CLAUDE_CODE_*` / `CLAUDECODE` 环境变量，避免 CLI 去别的入口目录找会话；
  resume 失败时把 CLI `errors[]` 的原文显示出来。

### 会话落盘时机

Claude CLI 只在**进程退出时**写会话文件。所以每轮结束后 Adapter 会收掉 CLI 的 stdin 让它正常退出
（最多等 3 秒），下一次对话带着刚拿到的 `sessionId` 重新 `--resume`。这样第二次对话、以及重启应用后，
都能找到这条原生会话。旧的「一直挂着同一个 CLI 进程」的做法在重启后就找不到会话。

### 已知边界：从 Claude Code 终端里启动的 Tango

如果 Tango 本身是从一个 Claude Code 会话（例如 `claude` 里跑 `npm run dev`，或某个 Claude Code
包装器）里启动的，它的环境会带着 `CLAUDE_CODE_SESSION_ID` 这类变量。即使 Adapter 已经把
`CLAUDE_CODE_*` / `CLAUDECODE` 从子进程环境里去掉，实测时 Claude CLI **在这种父进程下仍然不会把会话写盘**，
于是每次 resume 都会触发「新开会话」兜底。从普通终端（PowerShell / Explorer）启动 Tango 时，
会话能正常写盘并在重启后 resume。这是 CLI 自身的判定，不是 Tango 能绕开的，按普通方式启动即可。

## 数学公式

T3 的公式排版在上游（服务端把 TeX 转成 SVG 后随消息下发），客户端只负责保留。Tango 没有这一层服务，改为本地排版：

- `remark-math` 只在文本里真的出现 `$...$` 时才启用（价格 `$95 or $100` 不会被当成公式）
- `MarkdownMath` 懒加载 katex，`trust:false`，只输出 HTML；排版失败显示源码，不让消息报错
- 块级公式（`$$` 独占几行）显示在正文里，不套代码框

已知限制：同一段里出现两个以上 `$`（例如「一个坏公式 $rac{1}{$ 和一个价格 $95」）时，remark-math 会把它们
配成一对公式，结果价格也会被渲染成公式。T3 的客户端同样只做解析层面的处理，这条限制来自 remark-math 本身。

## Claude 的权限

T3 用客户端的控制协议在会话里弹审批；Tango 目前走 Claude CLI 的 `--permission-mode`：

- 输入框底栏（只在该任务用 Claude 时出现）可以选 Ask first / Accept edits / Auto / Plan only / Manual /
  Don't ask / Bypass；改完从下一条消息生效
- **必须显式传 `--permission-mode`**：实测不传时 print 模式会直接放行 Write，不等于 "default"
- CLI 的 `system/permission_denied` 会把对应工具行标成失败并写明「Permission denied — this tool needs
  approval in Claude's permission mode」，不再显示成“跑完了”；Agent 也收到拒绝原因并改路线

实测：`default` 下 Write 被拒（文件未生成），`bypassPermissions` 下同一句成功写入。
会话内逐个审批（T3 的 control request）仍未实现。

## 消息里的文件路径

T3 的 `MarkdownFileLink` 把内联代码里指向项目文件的路径变成链接，并在自己的预览面板打开。
Tango 没有文件预览面板，改用系统默认程序打开，并加了两道约束：

- `files:exists` / `files:open` 只接受项目目录内的相对路径（realpath 后仍在项目根下、是文件）
- Markdown 只把「像路径、且确实存在」的内联代码变成链接，命令（`npm run dev`）、变量（`$x`）、
  绝对路径（`C:\…`）和 `../` 都保持原样

实测：`package.json`、`electron/main.ts` 变成链接；`src/missing-file.ts` 不存在保持代码；
`../` 与绝对路径被拒绝。

## 用量

T3 的 ComposerUsageLimits 读服务端的额度；Tango 没有服务端，改为从 Claude CLI 的 `result.modelUsage`
取每轮真实数字，随回复保存并在任务详情「Usage」里汇总：模型、累计输入/输出 token、缓存读、累计费用。
Claude 的字段来自 CLI result；Codex 从 `turn/completed` 的 `usage`（input_tokens / cached_input_tokens /
output_tokens）映射到同一结构，费用记为 0（Codex 不给金额）。Codex 的实时采集在本机无法验证——
`~/.codex` 的权限问题导致 app server 起不来；用量面板本身已用 Codex 形状的记录验证过。

## 文件类型图标

T3 的 `PierreEntryIcon` 用 `@pierre/trees` 的内置 sprite 加自己补的语言/文档图标。Tango 原样搬了 sprite
与解析器，去掉了 `@t3tools/shared` 的视频/MIME 两个依赖（Tango 没有用到），并把它用在改动列表与
附件芯片上。图标颜色按 `light-dark()` 取浅色那一档，深色主题下仍走 sprite 自带的两档色。

实测：sprite 注入 86 个 symbol；改动列表的 `.json/.npm/.tsx` 显示对应图标；附件 `diagram.png` 显示图片图标。
