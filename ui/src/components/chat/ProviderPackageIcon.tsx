// 照 T3 的 ProviderPackageIcon 改写：Agent 图标位。
// T3 读 provider-core 的矢量描述再画；Tango 的 Agent 图标是现成的 SVG 文件，
// 所以这里保留它对外那张「包图标」的用法：一个可传 className / size 的图标位，
// 未知 Agent 回退到首字母方块。
import { useId, type CSSProperties, type SVGProps } from "react";

import type { AgentStatus } from "../../../../electron/preload";

export const AGENT_ICON_FILES: Record<AgentStatus["id"], string> = {
  codex: "codex.svg",
  claude: "claude-code.svg",
  dsh: "deepseek.svg",
  pi: "pi.svg",
};

export function ProviderPackageIcon({
  agentId,
  agentName,
  className,
  ...props
}: { agentId: AgentStatus["id"] | string; agentName?: string } & SVGProps<SVGSVGElement>) {
  // T3 用 useId 给渐变编号；这里留下同样的编号作用域，回退方块不会和目标图共享 id。
  const label = useId();
  const file = AGENT_ICON_FILES[agentId as AgentStatus["id"]];
  const style = { "--icon-label": label } as CSSProperties;
  if (file) {
    return (
      <svg
        {...props}
        data-provider-package-icon={agentId}
        role="img"
        aria-label={agentName ?? agentId}
        style={style}
      >
        <image href={`./icons/${file}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" />
      </svg>
    );
  }
  return (
    <svg
      {...props}
      data-provider-package-icon="unknown"
      role="img"
      aria-label={agentName ?? agentId}
      style={style}
    >
      <rect width="100%" height="100%" rx="22%" fill="currentColor" opacity="0.18" />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize="55%"
        fill="currentColor"
      >
        {(agentName ?? agentId).slice(0, 1).toUpperCase()}
      </text>
    </svg>
  );
}
