import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import stylex from "@stylexjs/unplugin";
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  server: { host: "0.0.0.0", port: 3000 },
  vite: {
    plugins: [
      stylex.vite({
        unstable_moduleResolution: { type: "commonJS", rootDir: process.cwd() },
        runtimeInjection: false,
      }),
    ],
  },
});
