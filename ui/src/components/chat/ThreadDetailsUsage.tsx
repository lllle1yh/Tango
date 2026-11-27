// 照 T3 的 ThreadDetailsUsage / ThreadDetailsContext 改写的 Tango 版：
// 一栏细线 + 数值的用量行。T3 读服务端的额度窗口与上下文快照；Tango 用自己的记录：
// 每轮 token、缓存读、费用，以及从 CLI 拿到的上下文窗口上限算出占用。
import type { ReactNode } from "react";

import { cn } from "../../lib/utils";
import { ThreadDetailsSection } from "./ThreadDetailsPanel";

type UsageTone = "error" | "warning" | null;

// T3 的 formatContextWindowTokens：1k 以下原样，之上按 k / M 缩写。
export function formatContextWindowTokens(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "0";
  if (value < 1_000) return `${Math.round(value)}`;
  if (value < 10_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  if (value < 999_500) return `${Math.round(value / 1_000)}k`;
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}M`;
  return `${Math.round(value / 1_000_000)}M`;
}

function toneFor(percent: number | null): UsageTone {
  if (percent === null) return null;
  if (percent >= 90) return "error";
  if (percent >= 80) return "warning";
  return null;
}

export interface ThreadUsageTotals {
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
  /** 最近一轮的上下文占用与上限（Claude 的 modelUsage 里带 contextWindow）。 */
  contextUsedTokens: number;
  maxContextTokens: number | null;
}

export function summarizeThreadUsage(
  messages: ReadonlyArray<{
    usage?:
      | { model: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens?: number; maxContextTokens?: number; costUsd: number }
      | undefined;
  }>,
): ThreadUsageTotals | null {
  const withUsage = messages.filter((message) => message.usage);
  if (withUsage.length === 0) return null;
  const totals: ThreadUsageTotals = {
    model: withUsage.at(-1)?.usage?.model ?? null,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    costUsd: 0,
    contextUsedTokens: 0,
    maxContextTokens: null,
  };
  for (const message of withUsage) {
    const usage = message.usage!;
    totals.inputTokens += usage.inputTokens ?? 0;
    totals.outputTokens += usage.outputTokens ?? 0;
    totals.cacheReadTokens += usage.cacheReadTokens ?? 0;
    totals.cacheCreationTokens += usage.cacheCreationTokens ?? 0;
    totals.costUsd += usage.costUsd ?? 0;
    // 最近一轮的输入侧 = 它读进来的上下文。
    totals.contextUsedTokens = (usage.inputTokens ?? 0) + (usage.cacheReadTokens ?? 0) + (usage.cacheCreationTokens ?? 0);
    totals.maxContextTokens = usage.maxContextTokens ?? totals.maxContextTokens;
  }
  return totals;
}

export function ThreadDetailsUsage({ totals }: { totals: ThreadUsageTotals }) {
  const usedPercent =
    totals.maxContextTokens && totals.maxContextTokens > 0
      ? Math.min(100, Math.round((totals.contextUsedTokens / totals.maxContextTokens) * 100))
      : null;
  return (
    <>
      <ThreadDetailsSection title="Context window">
        <div className="grid grid-cols-[auto_minmax(3rem,1fr)_auto] gap-x-3 text-xs">
          <UsageRow
            label="Context"
            fill={usedPercent}
            tone={toneFor(usedPercent)}
            muted
            value={
              totals.maxContextTokens
                ? `${formatContextWindowTokens(totals.contextUsedTokens)} / ${formatContextWindowTokens(totals.maxContextTokens)}`
                : formatContextWindowTokens(totals.contextUsedTokens)
            }
            tooltip={
              <>
                <span className="text-foreground">
                  {usedPercent !== null ? `Context: ${usedPercent}% used` : "Context in this turn"}
                </span>
                <span className="text-muted-foreground">
                  {totals.contextUsedTokens.toLocaleString()} tokens read in the last turn
                </span>
              </>
            }
          />
          <UsageRow
            label="Model"
            fill={null}
            tone={null}
            value={totals.model ?? "—"}
            tooltip={<span className="text-foreground">{totals.model ?? "Unknown model"}</span>}
          />
          <UsageRow
            label="Tokens in / out"
            fill={null}
            tone={null}
            value={`${formatContextWindowTokens(totals.inputTokens)} / ${formatContextWindowTokens(totals.outputTokens)}`}
            tooltip={
              <>
                <span className="text-foreground">All turns in this task</span>
                <span className="text-muted-foreground">
                  {totals.inputTokens.toLocaleString()} in · {totals.outputTokens.toLocaleString()} out
                </span>
              </>
            }
          />
          <UsageRow
            label="Cache read"
            fill={null}
            tone={null}
            value={formatContextWindowTokens(totals.cacheReadTokens + totals.cacheCreationTokens)}
            tooltip={
              <>
                <span className="text-foreground">Prompt cache</span>
                <span className="text-muted-foreground">
                  {totals.cacheReadTokens.toLocaleString()} read · {totals.cacheCreationTokens.toLocaleString()} written
                </span>
              </>
            }
          />
          <UsageRow
            label="Cost"
            fill={null}
            tone={null}
            value={`$${totals.costUsd.toFixed(4)}`}
            tooltip={<span className="text-foreground">Sum of the reported cost for this task</span>}
          />
        </div>
      </ThreadDetailsSection>
    </>
  );
}

/** 一行：标签、细线、数值。线按 fill 填充，悬停看说明（T3 用 tooltip 弹层，这里用 title）。 */
function UsageRow({
  label,
  fill,
  tone,
  value,
  tooltip,
  muted = false,
}: {
  label: string;
  fill: number | null;
  tone: UsageTone;
  value: string;
  tooltip: ReactNode;
  muted?: boolean;
}) {
  const tooltipText = typeof tooltip === "string" ? tooltip : undefined;
  return (
    <div
      tabIndex={0}
      aria-label={`${label}: ${value}`}
      title={tooltipText}
      className="col-span-3 grid h-6 grid-cols-subgrid items-center rounded-lg px-2.5 outline-none hover:bg-black/[0.035] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring dark:hover:bg-white/[0.08]"
    >
      <span className="max-w-28 truncate text-muted-foreground">{label}</span>
      {fill !== null ? (
        <span className="relative h-[3px] rounded-full bg-muted-foreground/30 dark:bg-muted-foreground/20">
          {fill > 0 ? (
            <span
              className={cn(
                "absolute inset-y-0 left-0 rounded-full",
                tone === "error" ? "bg-error" : tone === "warning" ? "bg-warning" : muted ? "bg-muted-foreground" : "bg-foreground/80",
              )}
              style={{ width: `max(${fill}%, 6px)` }}
            />
          ) : null}
        </span>
      ) : null}
      <span
        className={cn(
          "text-end font-medium tabular-nums",
          fill === null && "col-span-2",
          tone === "error" ? "text-error-foreground" : tone === "warning" ? "text-warning-foreground" : fill === null ? "text-muted-foreground" : "text-foreground/80",
        )}
      >
        {value}
      </span>
    </div>
  );
}
