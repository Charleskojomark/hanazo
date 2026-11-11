import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  date,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const batchStatusEnum = pgEnum("batch_status", [
  "sorting",
  "dispatched",
  "completed",
]);

export const parcelStatusEnum = pgEnum("parcel_status", [
  "pending",
  "sorted",
  "in_transit",
  "delivered",
  "failed",
]);

// 1. Hubs Table
export const hubs = pgTable("hubs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 2. Riders Table
export const riders = pgTable("riders", {
  id: uuid("id").primaryKey().defaultRandom(),
  hubId: uuid("hub_id")
    .notNull()
    .references(() => hubs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  assignedBin: integer("assigned_bin").notNull(),
  assignedDistricts: text("assigned_districts")
    .array()
    .notNull()
    .default([]),
  active: boolean("active").default(true).notNull(),
});

// 3. District Nodes Table (Local NIPOST cache & aliases)
export const districtNodes = pgTable("district_nodes", {
  code: text("code").primaryKey(), // e.g. 'LA-04-A12'
  state: text("state").notNull(),
  lga: text("lga").notNull(),
  district: text("district").notNull(),
  displayName: text("display_name").notNull(),
  aliases: text("aliases")
    .array()
    .notNull()
    .default([]),
});

// 4. Batches Table
export const batches = pgTable("batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  hubId: uuid("hub_id")
    .notNull()
    .references(() => hubs.id, { onDelete: "cascade" }),
  batchDate: date("batch_date").notNull(),
  status: batchStatusEnum("status").notNull().default("sorting"),
  totalParcels: integer("total_parcels").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 5. Parcels Table
export const parcels = pgTable("parcels", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => batches.id, { onDelete: "cascade" }),
  rawAddress: text("raw_address").notNull(),
  extractedLandmark: text("extracted_landmark"),
  resolvedDistrictCode: text("resolved_district_code").references(
    () => districtNodes.code,
    { onDelete: "set null" }
  ),
  assignedBin: integer("assigned_bin"),
  riderId: uuid("rider_id").references(() => riders.id, {
    onDelete: "set null",
  }),
  status: parcelStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
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
export type Hub = typeof hubs.$inferSelect;
export type NewHub = typeof hubs.$inferInsert;

export type Rider = typeof riders.$inferSelect;
export type NewRider = typeof riders.$inferInsert;

export type DistrictNode = typeof districtNodes.$inferSelect;
export type NewDistrictNode = typeof districtNodes.$inferInsert;

export type Batch = typeof batches.$inferSelect;
export type NewBatch = typeof batches.$inferInsert;

export type Parcel = typeof parcels.$inferSelect;
export type NewParcel = typeof parcels.$inferInsert;

