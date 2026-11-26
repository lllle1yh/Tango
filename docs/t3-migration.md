# T3 → Tango 迁移清单

生成自 `t3code/apps/web/src/components/chat`（160 个组件文件，不含测试）。

- 已搬入并接线：**18**
- 纯展示、可搬但尚未搬：**12**
- 依赖 T3 服务端契约（provider / PR / diff / 预览会话 / 后台任务 / 附件），Tango 没有对应数据源：**130**

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
