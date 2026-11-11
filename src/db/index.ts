import * as pgSchema from "./schema";
import * as sqliteSchema from "./sqlite-schema";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

export const isOffline = process.env.OFFLINE_MODE === "true";

export type PgDb = NeonDatabase<typeof pgSchema>;
export type SqliteDb = BetterSQLite3Database<typeof sqliteSchema>;
export type AppDb = PgDb;

let dbInstance: any = null;
let activePool: any = null;

/**
 * Normalizes PostgreSQL connection string for Vercel Serverless connection poolers
 * (Neon WebSockets or Supabase PgBouncer).
 */
function normalizeServerlessDbUrl(url: string): string {
  if (!url) return url;

  // Supabase transaction pooler recommendation
  if (url.includes("supabase.co") && !url.includes("pgbouncer=true") && !url.includes(":5432")) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}pgbouncer=true`;
  }

  return url;
}

export function getDbClient(): any {
  if (dbInstance) return dbInstance;

  if (isOffline) {
    try {
      // Dynamic require ensures better-sqlite3 native addon is only loaded in local offline mode
      const Database = require("better-sqlite3");
      const { drizzle } = require("drizzle-orm/better-sqlite3");
      const dbPath = process.env.SQLITE_DB_PATH || "./hanazo-offline.db";
      const sqlite = new Database(dbPath);
      // Enable WAL mode for high concurrency
      sqlite.pragma("journal_mode = WAL");
      sqlite.pragma("foreign_keys = ON");
      dbInstance = drizzle(sqlite, { schema: sqliteSchema });
    } catch (error) {
      console.error("[Hanazo DB] Failed to initialize SQLite offline database:", error);
      throw error;
    }
  } else {
    try {
      const { Pool, neonConfig } = require("@neondatabase/serverless");
      const { drizzle } = require("drizzle-orm/neon-serverless");

      // Configure WebSocket pooling for low-latency serverless invocations on Vercel
      if (typeof WebSocket !== "undefined") {
        neonConfig.webSocketConstructor = WebSocket;
      }

      const rawConnection = process.env.DATABASE_URL;
      if (!rawConnection) {
        console.warn("[Hanazo DB] DATABASE_URL is not set. Database operations will fail unless configured.");
      }

      const connectionString = normalizeServerlessDbUrl(rawConnection || "");
      activePool = new Pool({
        connectionString,
        max: 10,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000,
      });

      dbInstance = drizzle(activePool, { schema: pgSchema });
    } catch (error) {
      console.error("[Hanazo DB] Failed to initialize PostgreSQL Neon database:", error);
      throw error;
    }
  }

  return dbInstance;
}

/**
 * Closes active serverless pool connections if required during lifecycle teardown.
 */
export async function closeDbPool(): Promise<void> {
  if (activePool && typeof activePool.end === "function") {
    try {
      await activePool.end();
      activePool = null;
      dbInstance = null;
    } catch (err) {
      console.warn("[Hanazo DB] Error ending database pool:", err);
    }
  }
}

/**
 * Unified `db` export.
 * Uses a Proxy for lazy initialization so importing `db` doesn't throw during build or before env vars are available.
 */
export const db = new Proxy({} as AppDb, {
  get(_target, prop) {
    const client = getDbClient();
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export { pgSchema, sqliteSchema };

// Dynamically select the correct table definitions matching the active database engine
const activeSchema = isOffline ? sqliteSchema : pgSchema;

export const hubs = activeSchema.hubs as typeof pgSchema.hubs;
export const riders = activeSchema.riders as typeof pgSchema.riders;
export const districtNodes = activeSchema.districtNodes as typeof pgSchema.districtNodes;
export const batches = activeSchema.batches as typeof pgSchema.batches;
export const parcels = activeSchema.parcels as typeof pgSchema.parcels;

export * from "./schema";
