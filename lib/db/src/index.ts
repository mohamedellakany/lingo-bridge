import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

/**
 * The database is optional. When DATABASE_URL is set we create a real Postgres
 * client; otherwise `db` is null and callers fall back to their in-memory /
 * file-based store. This lets the app run locally with zero infrastructure
 * while supporting a real database in production by setting one env var.
 */
export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

export const pool = isDatabaseConfigured
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

export const db: NodePgDatabase<typeof schema> | null = pool
  ? drizzle(pool, { schema })
  : null;

export * from "./schema";
