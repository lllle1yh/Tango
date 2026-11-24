import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const uiRoot = path.resolve(process.cwd(), "ui");

export default defineConfig({
  root: uiRoot,
  plugins: [react()],
  base: "./",
  build: {
    outDir: path.resolve(uiRoot, "../dist"),
    emptyOutDir: true,
  },
});
