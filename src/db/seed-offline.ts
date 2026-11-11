import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import * as sqliteSchema from "./sqlite-schema";
import { CURATED_DISTRICTS } from "./seed";
import { nipost } from "../lib/nipost-client";

export async function seedOfflineDatabase() {
  console.log("🌱 [Hanazo Offline Seeder] Initializing local SQLite database at ./hanazo-offline.db...");

  const dbPath = process.env.SQLITE_DB_PATH || "./hanazo-offline.db";
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  // Ensure tables exist in SQLite if not yet migrated
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS hubs (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS riders (
      id TEXT PRIMARY KEY NOT NULL,
      hub_id TEXT NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      assigned_bin INTEGER NOT NULL,
      assigned_districts TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS district_nodes (
      code TEXT PRIMARY KEY NOT NULL,
      state TEXT NOT NULL,
      lga TEXT NOT NULL,
      district TEXT NOT NULL,
      display_name TEXT NOT NULL,
      aliases TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY NOT NULL,
      hub_id TEXT NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
      batch_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sorting',
      total_parcels INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parcels (
      id TEXT PRIMARY KEY NOT NULL,
      batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      raw_address TEXT NOT NULL,
      extracted_landmark TEXT,
      resolved_district_code TEXT REFERENCES district_nodes(code) ON DELETE SET NULL,
      assigned_bin INTEGER,
      rider_id TEXT REFERENCES riders(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL
    );
  `);

  const db = drizzle(sqlite, { schema: sqliteSchema });
  const allRecords = new Map<string, typeof CURATED_DISTRICTS[0]>();

  // 1. Add curated records
  for (const item of CURATED_DISTRICTS) {
    allRecords.set(item.code, item);
  }

  // 2. Optionally pull from NIPOST API if available
  try {
    console.log("📡 [Hanazo Offline Seeder] Checking NIPOST NDAPS for updates...");
    const states = await nipost.listStates();
    console.log(`✅ [Hanazo Offline Seeder] Fetched ${states.length} states from NIPOST.`);
  } catch {
    console.log("ℹ️ [Hanazo Offline Seeder] Operating in pure offline mode. Using curated local reference dataset.");
  }

  const records = Array.from(allRecords.values());
  console.log(`💾 [Hanazo Offline Seeder] Seeding ${records.length} district nodes into SQLite...`);

  for (const record of records) {
    await db
      .insert(sqliteSchema.districtNodes)
      .values({
        code: record.code,
        state: record.state,
        lga: record.lga,
        district: record.district,
        displayName: record.displayName,
        aliases: record.aliases,
      })
      .onConflictDoUpdate({
        target: sqliteSchema.districtNodes.code,
        set: {
          displayName: sql`excluded.display_name`,
          aliases: sql`excluded.aliases`,
        },
      });
  }

  console.log(`✅ [Hanazo Offline Seeder] Successfully seeded ${records.length} district nodes in ./hanazo-offline.db!`);
}

// Auto-run if executed directly via tsx
if (require.main === module) {
  seedOfflineDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ [Hanazo Offline Seeder] Seed failed:", err);
      process.exit(1);
    });
}

