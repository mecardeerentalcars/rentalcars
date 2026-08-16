import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".dev.vars");
} catch {
  // Railway injects DATABASE_URL; a local .dev.vars file is optional.
}

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/mecardee",
  },
});
