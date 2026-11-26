// 搬自 T3 的 ComposerFreshSession：/clear 或「Fresh session」武装后，
// 输入框上方提示「下一条消息会开新会话」，并且可以点掉继续用当前会话。
import { EraserIcon } from "lucide-react";

import type { ComposerBannerStackItem } from "./ComposerBannerStack";

export function freshSessionBannerItem(onUndo: () => void): ComposerBannerStackItem {
  return {
    id: "fresh-session",
    variant: "info",
    icon: <EraserIcon />,
    title: "Your next message starts a fresh session",
    description: "The agent won't see earlier messages in this thread.",
    dismissLabel: "Keep the current session",
    onDismiss: onUndo,
  };
}
