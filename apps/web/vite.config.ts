import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@dayflow/domain": fileURLToPath(
        new URL("../../packages/domain/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    host: "127.0.0.1",
    proxy: { "/api": "http://127.0.0.1:3002" },
  },
  preview: {
    // Explicit hostname only. Do not disable Vite host validation with `true`.
    // Keeps the preview bound to localhost while permitting the existing proxy domain.
    allowedHosts: ["dayflow.liuduc.site"],
  },
});
