import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
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
