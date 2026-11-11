import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// 1. Hubs Table (SQLite)
export const hubs = sqliteTable("hubs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  city: text("city").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// 2. Riders Table (SQLite)
export const riders = sqliteTable("riders", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  hubId: text("hub_id")
    .notNull()
    .references(() => hubs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  assignedBin: integer("assigned_bin").notNull(),
  assignedDistricts: text("assigned_districts", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .$defaultFn(() => []),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

// 3. District Nodes Table (SQLite)
export const districtNodes = sqliteTable("district_nodes", {
  code: text("code").primaryKey(), // e.g. 'LA-04-A12'
  state: text("state").notNull(),
  lga: text("lga").notNull(),
  district: text("district").notNull(),
  displayName: text("display_name").notNull(),
  aliases: text("aliases", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .$defaultFn(() => []),
});

// 4. Batches Table (SQLite)
export const batches = sqliteTable("batches", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  hubId: text("hub_id")
    .notNull()
    .references(() => hubs.id, { onDelete: "cascade" }),
  batchDate: text("batch_date").notNull(),
  status: text("status", { enum: ["sorting", "dispatched", "completed"] })
    .notNull()
    .default("sorting"),
  totalParcels: integer("total_parcels").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// 5. Parcels Table (SQLite)
export const parcels = sqliteTable("parcels", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  batchId: text("batch_id")
    .notNull()
    .references(() => batches.id, { onDelete: "cascade" }),
  rawAddress: text("raw_address").notNull(),
  extractedLandmark: text("extracted_landmark"),
  resolvedDistrictCode: text("resolved_district_code").references(
    () => districtNodes.code,
    { onDelete: "set null" }
  ),
  assignedBin: integer("assigned_bin"),
  riderId: text("rider_id").references(() => riders.id, {
    onDelete: "set null",
  }),
  status: text("status", {
    enum: ["pending", "sorted", "in_transit", "delivered", "failed"],
  })
    .notNull()
    .default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Relations
export const hubsRelations = relations(hubs, ({ many }) => ({
  riders: many(riders),
  batches: many(batches),
}));

export const ridersRelations = relations(riders, ({ one, many }) => ({
  hub: one(hubs, {
    fields: [riders.hubId],
    references: [hubs.id],
  }),
  parcels: many(parcels),
}));

export const batchesRelations = relations(batches, ({ one, many }) => ({
  hub: one(hubs, {
    fields: [batches.hubId],
    references: [hubs.id],
  }),
  parcels: many(parcels),
}));

export const districtNodesRelations = relations(districtNodes, ({ many }) => ({
  parcels: many(parcels),
}));

export const parcelsRelations = relations(parcels, ({ one }) => ({
  batch: one(batches, {
    fields: [parcels.batchId],
    references: [batches.id],
  }),
  rider: one(riders, {
    fields: [parcels.riderId],
    references: [riders.id],
  }),
  districtNode: one(districtNodes, {
    fields: [parcels.resolvedDistrictCode],
    references: [districtNodes.code],
  }),
}));

// Export type definitions for inference
export type SqliteHub = typeof hubs.$inferSelect;
export type NewSqliteHub = typeof hubs.$inferInsert;

export type SqliteRider = typeof riders.$inferSelect;
export type NewSqliteRider = typeof riders.$inferInsert;

export type SqliteDistrictNode = typeof districtNodes.$inferSelect;
export type NewSqliteDistrictNode = typeof districtNodes.$inferInsert;

export type SqliteBatch = typeof batches.$inferSelect;
export type NewSqliteBatch = typeof batches.$inferInsert;

export type SqliteParcel = typeof parcels.$inferSelect;
export type NewSqliteParcel = typeof parcels.$inferInsert;

