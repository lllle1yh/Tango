// T3 用路由区分"服务端线程"和"草稿线程"；Tango 的当前任务放在查询参数里。
import { type ScopedThreadRef } from "../lib/t3-types";

export type ThreadRouteTarget =
  | { kind: "server"; threadRef: ScopedThreadRef }
  | { kind: "draft"; draftId: string };

export function useThreadRouteTarget(): ThreadRouteTarget | null {
  const match = /[?&]taskId=([^&]+)/.exec(window.location.search);
  if (!match) return null;
  return { kind: "server", threadRef: { environmentId: "local", threadId: decodeURIComponent(match[1]!) } };
}
