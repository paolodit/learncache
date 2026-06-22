import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteApiPlugin } from "./src/server/viteApiPlugin.js";

export default defineConfig(({ command, mode }) => ({
  plugins: [command === "serve" && mode !== "test" ? viteApiPlugin() : null, react()].filter(Boolean),
  server: {
    host: "127.0.0.1",
    port: 3000
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  },
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/dist-server/**", "**/extension/**"]
  }
}));
