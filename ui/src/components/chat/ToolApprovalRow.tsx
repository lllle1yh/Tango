// 移植 T3 的 TimelinePendingApprovalRow（apps/web/src/components/chat/）：
// 等待确认的请求画成时间线末尾的一行工具日志，细节可选中，操作内联在下面一行。
// Tango 的三种 Agent 给的是 optionId 列表，这里按 kind 拆成“主按钮 + 更多选项”。
import { ShieldIcon } from "lucide-react";

import { InlineButton } from "../ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { WorkLogRow } from "../../WorkLog";

export interface ToolApprovalOption {
  optionId: string;
  name: string;
  kind?: string | undefined;
}

export interface ToolApprovalRequest {
  title: string;
  detail?: string | undefined;
  options: ToolApprovalOption[];
  input?: { placeholder: string; prefill: string } | undefined;
}

const isReject = (option: ToolApprovalOption) =>
  option.kind === "reject_once" || option.kind === "reject_always";

const primaryOptions = (options: ToolApprovalOption[]) => {
  const reject = options.find(isReject);
  const allow = options.find((option) => option.kind === "allow_once") ?? options.find((option) => !isReject(option));
  return [reject, allow].filter((option): option is ToolApprovalOption => option !== undefined);
};

const moreOptions = (options: ToolApprovalOption[]) => {
  const primary = new Set(primaryOptions(options).map((option) => option.optionId));
  return options.filter((option) => !primary.has(option.optionId));
};

export function ToolApprovalRow({
  request,
  responding = false,
  onRespond,
}: {
  request: ToolApprovalRequest;
  responding?: boolean;
  onRespond: (optionId: string) => void;
}) {
  const primary = primaryOptions(request.options);
  const more = moreOptions(request.options);
  return (
    <WorkLogRow
      role="group"
      aria-label={request.title}
      wrapLabel
      icon={<ShieldIcon className="size-4 shrink-0 stroke-2 text-warning" />}
      label={<span className="block min-w-0 whitespace-pre-wrap text-xs leading-5 text-foreground wrap-anywhere">{request.title}</span>}
    >
      <div className="ms-7.5 flex min-w-0 flex-col gap-1 pb-1 text-xs">
        {request.detail ? (
          <pre className="block max-h-40 min-w-0 overflow-auto whitespace-pre-wrap font-mono text-xs leading-5 text-muted-foreground select-text wrap-anywhere [scrollbar-width:thin]">
            {request.detail}
          </pre>
        ) : null}
        {request.input ? (
          <span className="text-muted-foreground">Type your answer in the box below to respond.</span>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1 text-warning">
            <ShieldIcon aria-hidden className="size-3 shrink-0" />
            Waiting for approval
          </span>
          {primary.length > 0 ? (
            <>
              <span aria-hidden className="text-muted-foreground">
                ·
              </span>
              {primary.map((option) => (
                <InlineButton
                  key={option.optionId}
                  tone={isReject(option) ? "muted" : "default"}
                  disabled={responding}
                  onClick={() => onRespond(option.optionId)}
                >
                  {option.name}
                </InlineButton>
              ))}
            </>
          ) : null}
          {more.length > 0 ? (
            <Menu>
              <MenuTrigger
                disabled={responding}
                render={<InlineButton tone="muted" aria-label="More approval options" />}
              >
                More
              </MenuTrigger>
              <MenuPopup data-chat-composer-floating-layer="true" side="top" align="end" width="content">
                {more.map((option) => (
                  <MenuItem
                    key={option.optionId}
                    disabled={responding}
                    onClick={() => onRespond(option.optionId)}
                  >
                    <span className="min-w-0 whitespace-normal wrap-break-word">{option.name}</span>
                  </MenuItem>
                ))}
              </MenuPopup>
            </Menu>
          ) : null}
        </div>
      </div>
    </WorkLogRow>
  );
}
