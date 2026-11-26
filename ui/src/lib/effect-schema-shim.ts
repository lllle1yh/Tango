// T3 用 effect/Schema 校验本地存储；这里提供最小的 Number/Boolean/Finite 解析。
export type SchemaLike<T> = { readonly parse: (value: unknown) => T };
const schema = <T>(parse: (value: unknown) => T): SchemaLike<T> => ({ parse });
export const Number = schema<number>((value) => globalThis.Number(value));
export const Finite = schema<number>((value) => {
  const n = globalThis.Number(value);
  return globalThis.Number.isFinite(n) ? n : 0;
});
export const Boolean = schema<boolean>((value) => value === true || value === "true");
export const String = schema<string>((value) => globalThis.String(value));
export function decodeSync<T>(s: SchemaLike<T>, value: unknown): T {
  return s.parse(value);
}
