import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DB_URL) {
  throw new Error(
    "DB_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DB_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
