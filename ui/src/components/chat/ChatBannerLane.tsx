// 照 T3 的 ChatBannerLane 改写：时间线上方的横幅通道。
// T3 这一层同时挂 ProviderStatusBanner 和 ThreadErrorBanner；Tango 的 Agent 状态
// 已经挪到输入框下方（ReadOnlyComposerBar），所以这里只留错误条，接口按 Tango 的数据简化。
import { ThreadErrorBanner } from "./ThreadErrorBanner";

export function ChatBannerLane({
  error,
  onRetry,
  onDismiss,
}: {
  error: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  if (!error) return null;
  return (
    <div className="chat-banner-lane" data-chat-banner-lane="true">
      <ThreadErrorBanner error={error} onRetry={onRetry} onDismiss={onDismiss} />
    </div>
  );
}
