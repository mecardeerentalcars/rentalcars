import { defineConfig } from "drizzle-kit";

for (const file of [".env", ".dev.vars"]) {
  if (process.env.DATABASE_URL) break;
  try {
    process.loadEnvFile(file);
  } catch {
    // Railway injects DATABASE_URL; local environment files are optional.
  }
}

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/mecardee",
  },
});
