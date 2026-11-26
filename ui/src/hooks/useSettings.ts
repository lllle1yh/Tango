// 复制过来的 T3 组件用 useClientSettings(selector) 读面板动画时长等设置；
// Tango 的设置由 App 持有，这里只提供这些组件的默认值。
export interface ClientSettings {
  readonly panelAnimationDurationMs: number;
  readonly sidebarWidth: number;
}

const DEFAULTS: ClientSettings = { panelAnimationDurationMs: 200, sidebarWidth: 256 };

export function useClientSettings<T>(selector: (settings: ClientSettings) => T): T {
  return selector(DEFAULTS);
}

export function useSettings(): ClientSettings {
  return DEFAULTS;
}
