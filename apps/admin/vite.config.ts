import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Admin is dev-only tooling on 3001; apps/api serves 3000 without CORS
  // headers. The dev proxy keeps the browser same-origin — `/hp-api/*` is
  // forwarded to the api with the prefix stripped (see src/lib/api.ts).
  server: {
    proxy: {
      "/hp-api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hp-api/, ""),
      },
    },
  },
  plugins: [
    // SPA mode: prerendered shell, client-side routing — same recipe as
    // apps/webapp (Map #1). Admin is dev-tooling, never deployed, but the
    // build target stays identical so the two apps don't diverge for no
    // reason.
    tanstackStart({ spa: { enabled: true } }),
    viteReact(),
    tailwindcss(),
  ],
});
