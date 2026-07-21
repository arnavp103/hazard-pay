import { defineConfig } from "drizzle-kit";

import env from "@hazard-pay/env";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/schema.ts", "./src/auth-schema.ts", "./src/agent-schema.ts"],
  out: "./migrations",
  dbCredentials: { url: env.DATABASE_URL },
});
