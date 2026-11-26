// T3 的文案由 gt-react 提供 ICU 消息；Tango 没有翻译服务，但组件依然用
// "{time}"、"{count, plural, ...}" 这类模板，所以这里实现最小可用的 ICU 替换：
// 简单占位符、plural 分支与 #。没有参数时原样返回。
import type * as React from "react";

export type Options = Record<string, unknown> | undefined;

function pluralBranch(template: string, count: number): string {
  const one = /\bone\s*\{([^{}]*)\}/.exec(template)?.[1];
  const other = /\bother\s*\{([^{}]*)\}/.exec(template)?.[1];
  const exact = new RegExp(`\\b=${count}\\s*\\{([^{}]*)\\}`).exec(template)?.[1];
  const body = exact ?? (count === 1 ? one : other) ?? other ?? one ?? "";
  return body.replace(/#/g, String(count));
}

export function msg(message: string, options?: Options): string {
  if (!options) return message;
  return message.replace(/\{(\w+), plural, ((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g, (_all, key: string, body: string) => {
    const count = Number(options[key] ?? 0);
    return pluralBranch(body, count);
  }).replace(/\{(\w+)\}/g, (all, key: string) => {
    const value = options[key];
    return value === undefined ? all : String(value);
  });
}

export const m = msg;
export const mFallback = msg;
export function useGT() {
  return msg;
}
export function useMessages() {
  return msg;
}
export function useLocale() {
  return "en";
}
export const GTProvider = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const T = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const Var = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export default { msg, m, mFallback, useGT, useMessages, T, Var, GTProvider };
