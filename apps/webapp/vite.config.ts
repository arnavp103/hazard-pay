import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev wiring to apps/api (#50, decided with #20): a Vite dev proxy, not
// CORS. The browser sees one origin, so EventSource, better-auth cookies,
// and the telemetry flush all work with zero client-side configuration and
// the api keeps its landed defaults (port 3000, API_BASE_URL). The webapp
// itself moves to Vite's own default port 5173 — it was squatting the api's
// 3000. These prefixes are the api's whole public surface; a new api route
// group means a new entry here.
const API_DEV_PROXY = Object.fromEntries(
  ["/api", "/health", "/overworld", "/player", "/telemetry", "/ticks"].map((path) => [
    path,
    { target: "http://localhost:3000", changeOrigin: true },
  ]),
);

export default defineConfig({
  server: {
    port: 5173,
    proxy: API_DEV_PROXY,
  },
  plugins: [
    // SPA mode: prerendered shell, client-side routing — the overworld is
    // a live surface, not a content site (Map #1: Start used lightly).
    tanstackStart({ spa: { enabled: true } }),
    viteReact(),
    tailwindcss(),
  ],
});
