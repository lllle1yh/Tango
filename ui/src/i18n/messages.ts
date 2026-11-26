// T3 的 m() 是 i18n 解析器；Tango 只有英文/中文文案，原样返回。
export { msg as m } from "../lib/gt-shim";


export type MessageResolver = (message: string, options?: Record<string, unknown>) => string;

export function getActiveLocale(): string {
  return "en";
}
