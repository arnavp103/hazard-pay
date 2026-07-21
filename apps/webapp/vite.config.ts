import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    // SPA mode: prerendered shell, client-side routing — the overworld is
    // a live surface, not a content site (Map #1: Start used lightly).
    tanstackStart({ spa: { enabled: true } }),
    viteReact(),
    tailwindcss(),
  ],
});
