// T3 的文案由 gt-react / gt-i18n 提供；Tango 只需原样返回英文，保留同名导出即可。
import type * as React from "react";

export function msg(message: string, _options?: unknown): string {
  return message;
}
export const m = msg;
export const mFallback = msg;
export function useGT() {
  return (message: string, _options?: unknown) => message;
}
export function useMessages() {
  return (message: string, _options?: unknown) => message;
}
export function useLocale() {
  return "en";
}
export const GTProvider = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const T = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const Var = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export default { msg, m, mFallback, useGT, useMessages, T, Var, GTProvider };
