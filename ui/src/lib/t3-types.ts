// @t3tools/contracts 的基础 id 类型；Tango 只需要类型层面兼容。
export type ThreadId = string;
export type RunId = string;
export type EnvironmentId = string;
export type ScopedThreadRef = { readonly threadId: ThreadId; readonly environmentId: EnvironmentId };
export type ProjectId = string;
export type MessageId = string;
export type DraftId = string;
