// T3 的 m() 是 i18n 解析器；Tango 只有英文/中文文案，原样返回。
export function m(message: string, _options?: unknown): string {
  return message;
}

export type MessageResolver = (message: string, options?: unknown) => string;
