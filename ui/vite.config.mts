import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const uiRoot = path.resolve(process.cwd(), "ui");

export default defineConfig({
  root: uiRoot,
  plugins: [react(), tailwindcss()],
  base: "./",
  resolve: {
    alias: {
      // 复制过来的 T3 组件仍按 gt-react 取文案；这里映射到恒等返回的适配层。
      "gt-react": path.resolve(uiRoot, "src/lib/gt-shim.tsx"),
      "gt-i18n": path.resolve(uiRoot, "src/lib/gt-shim.tsx"),
      "gt-i18n/types": path.resolve(uiRoot, "src/lib/gt-shim.tsx"),
    },
  },
  build: {
    outDir: path.resolve(uiRoot, "../dist"),
    emptyOutDir: true,
  },
});
