import type { GlobalProvider } from "@ladle/react";

import "../src/fonts.ts";
import "../src/styles/globals.css";

export const Provider: GlobalProvider = ({ children }) => (
  <div className="min-h-screen bg-shell font-data text-ink antialiased">
    {children}
  </div>
);
