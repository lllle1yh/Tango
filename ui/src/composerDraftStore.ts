// T3 的 composerDraftStore 管"草稿线程"；Tango 的任务本身就是落盘记录，
// toast 只查询草稿会话是否存在，这里保持订阅接口并恒返回 null。
import { useSyncExternalStore } from "react";

interface DraftSession { environmentId: string; threadId: string }
interface StoreState { getDraftSession: (draftId: string) => DraftSession | null }

const EMPTY: StoreState = { getDraftSession: () => null };
const subscribe = () => () => {};

export function useComposerDraftStore<T>(selector: (store: StoreState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(EMPTY), () => selector(EMPTY));
}
