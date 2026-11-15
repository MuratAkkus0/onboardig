import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    // drizzle-kit only needs a URL for migrate/studio/push; `generate` works offline.
    url: process.env.DATABASE_URL ?? "postgres://onboarding:onboarding@localhost:5433/onboarding",
  },
});
