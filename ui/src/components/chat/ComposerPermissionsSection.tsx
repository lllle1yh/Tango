// 照 T3 的 ComposerPermissionsSection 改写的 Tango 版：在输入框底栏选 Claude 的权限模式。
// T3 的模式由服务端按线程保存并下发；Tango 交给 Claude CLI 的 --permission-mode，
// 每轮都是新进程，所以改完从下一条消息开始生效，不中断当前回合。
import { ShieldCheck } from "lucide-react";

import type { AppSettings } from "../../../../electron/preload";

const MODES: Array<{ value: AppSettings["claudePermissionMode"]; label: string }> = [
  { value: "default", label: "Ask first" },
  { value: "acceptEdits", label: "Accept edits" },
  { value: "auto", label: "Auto" },
  { value: "plan", label: "Plan only" },
  { value: "manual", label: "Manual" },
  { value: "dontAsk", label: "Don't ask" },
  { value: "bypassPermissions", label: "Bypass" },
];

export function ComposerPermissionsSection({
  value,
  onChange,
  disabled,
}: {
  value: AppSettings["claudePermissionMode"];
  onChange: (next: AppSettings["claudePermissionMode"]) => void;
  disabled?: boolean;
}) {
  const current = MODES.find((mode) => mode.value === value) ?? MODES[0];
  return (
    <label
      className="composer-permissions"
      title={`Claude Code permission mode for the next message: ${current.label}`}
      data-composer-permissions={value}
    >
      <ShieldCheck size={12} aria-hidden />
      <select
        className="composer-permissions-select"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as AppSettings["claudePermissionMode"])}
      >
        {MODES.map((mode) => (
          <option key={mode.value} value={mode.value}>
            {mode.label}
          </option>
        ))}
      </select>
    </label>
  );
}
