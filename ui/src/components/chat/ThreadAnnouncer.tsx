import { useEffect, useRef } from "react";

// 照 T3 的 ThreadActivityAnnouncer：把回合的关键变化念给读屏软件听。
// 状态（开始 / 等审批 / 结束 / 失败）走独立的 polite 区域，和正文分开，
// 免得「需要你批准」被刚写完的那句话顶掉。

export type ThreadAnnouncementState =
  | "idle"
  | "working"
  | "needs-approval"
  | "done"
  | "failed"
  | "stopped";

const LABELS: Record<ThreadAnnouncementState, string> = {
  idle: "",
  working: "The agent is working",
  "needs-approval": "The agent needs your approval",
  done: "The turn finished",
  failed: "The turn could not run",
  stopped: "The turn was stopped",
};

export function ThreadAnnouncer({ state, agentName }: { state: ThreadAnnouncementState; agentName?: string }) {
  const statusRef = useRef<HTMLDivElement | null>(null);
  const previousRef = useRef<ThreadAnnouncementState | null>(null);

  useEffect(() => {
    if (previousRef.current === state) return;
    previousRef.current = state;
    const region = statusRef.current;
    if (!region || !LABELS[state]) return;
    // 同一区域连写两次会只念后一次，所以先清空再写。
    region.textContent = "";
    const timer = window.setTimeout(() => {
      region.textContent = agentName ? `${LABELS[state]}: ${agentName}` : LABELS[state];
    }, 50);
    return () => window.clearTimeout(timer);
  }, [state, agentName]);

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only" data-chat-thread-status-announcer>
      <div ref={statusRef} />
    </div>
  );
}
