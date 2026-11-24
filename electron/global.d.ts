import type { TangoApi } from "./preload";

declare global {
  interface Window {
    tango: TangoApi;
  }
}

export {};
