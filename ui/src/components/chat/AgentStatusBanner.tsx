import { Info, X } from "lucide-react";
import type { ReactNode } from "react";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "../ui/alert";

// 照 T3 的 ProviderStatusBanner：所选 Agent 没装或版本读不出来时，在时间线上方
// 提醒一句，带一个「重新检测」和一个按会话内关闭。Tango 的 Agent 状态只有
// 可用 / 不可用两态，所以只做这一种横幅。

export function AgentStatusBanner({
  agentName,
  version,
  rechecking,
  onRecheck,
  onDismiss,
}: {
  agentName: string;
  version: string | null;
  rechecking: boolean;
  onRecheck: () => void;
  onDismiss?: () => void;
}) {
  const title: ReactNode = version
    ? `${agentName} answered with an unrecognised version (${version})`
    : `${agentName} is not installed`;
  return (
    <div className="pointer-events-auto mx-auto w-fit max-w-[min(48rem,calc(100%-2rem))] pt-3">
      <Alert variant={version ? "warning" : "error"} controlAlignment="first-line">
        <Info aria-hidden="true" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          {version
            ? "Tango could not read the version this CLI reports, so its capabilities are unknown."
            : `Install the ${agentName} CLI, then run the check again. Tasks that already ran with it keep their transcript.`}
        </AlertDescription>
        <AlertAction>
          <button
            type="button"
            className="h-7 rounded-md px-2 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-60"
            disabled={rechecking}
            onClick={onRecheck}
          >
            {rechecking ? "Checking…" : "Check again"}
          </button>
          {onDismiss && (
            <button
              type="button"
              aria-label="Dismiss"
              title="Dismiss"
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={onDismiss}
            >
              <X size={13} />
            </button>
          )}
        </AlertAction>
      </Alert>
    </div>
  );
}
