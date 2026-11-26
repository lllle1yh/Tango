// T3 的本地存储读写带 Schema 校验；这里保留同样签名，内部按原值 JSON 化。
import { type SchemaLike } from "../lib/effect-schema-shim";

export function getLocalStorageItem<T>(key: string, schema?: SchemaLike<T>): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    return schema ? schema.parse(value) : (value as T);
  } catch {
    return null;
  }
}

export function setLocalStorageItem<T>(key: string, value: T, schema?: SchemaLike<T>) {
  try {
    window.localStorage.setItem(key, JSON.stringify(schema ? schema.parse(value) : value));
  } catch {
    // Storage disabled or over quota: keep the in-memory value.
  }
}

export function writeLocalStorageValue<T>(key: string, value: T, _default?: T, schema?: SchemaLike<T>) {
  setLocalStorageItem(key, value, schema);
}

export function readLocalStorageValue<T>(key: string, schema?: SchemaLike<T>): T | null {
  return getLocalStorageItem(key, schema);
}
