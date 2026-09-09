import { defineConfig } from "vite";
export default defineConfig({
  server: { watch: { ignored: ["**/work/**", "**/outputs/**"] } },
  build: {
    rollupOptions: {
      output: { manualChunks: { webgl: ["three"], icons: ["lucide"] } },
    },
  },
});
