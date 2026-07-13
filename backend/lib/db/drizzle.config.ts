import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DB_URL) {
  throw new Error("DB_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/**/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DB_URL,
  },
});


