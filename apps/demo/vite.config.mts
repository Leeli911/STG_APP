import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: process.env.GITHUB_ACTIONS ? "/STG_APP/" : "/",
  esbuild: {
    jsx: "automatic"
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../web/src", import.meta.url))
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
