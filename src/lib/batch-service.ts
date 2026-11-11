/**
 * Hanazo Batch & Manifest Service
 * Shared database query helpers for parcel sorting, batch lifecycle, and rider manifests.
 */

import { db, batches, hubs, riders, parcels } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import { OVERFLOW_BIN_NUMBER, OVERFLOW_RIDER_ID, OVERFLOW_RIDER_NAME } from "./sorter";

/**
 * Finds an active "sorting" batch for today at the specified hub,
 * or creates a new one if none exists.
 *
 * @param hubId - Hub UUID
 * @returns Batch UUID
 */
export async function getOrCreateActiveBatch(hubId: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);

  // Check for existing sorting batch for today
  const existing = await db
    .select()
    .from(batches)
    .where(
      and(
        eq(batches.hubId, hubId),
        eq(batches.batchDate, today),
        eq(batches.status, "sorting")
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Create a new batch for today
  const newBatchId = crypto.randomUUID();
  await db.insert(batches).values({
    id: newBatchId,
    hubId,
    batchDate: today,
    status: "sorting",
    totalParcels: 0,
    createdAt: new Date(),
  } as any);

  return newBatchId;
}

/**
 * Increments the total parcel count on a batch.
 */
export async function incrementBatchParcelCount(batchId: string, count = 1): Promise<void> {
  try {
    await db
      .update(batches)
      .set({
        totalParcels: sql`${batches.totalParcels} + ${count}`,
      } as any)
      .where(eq(batches.id, batchId));
  } catch (error) {
    console.error(`[Hanazo Batch] Failed to increment parcel count for batch ${batchId}:`, error);
  }
}

/**
 * Fetches batch details along with all parcels and rider assignments.
 */
export async function getBatchWithParcels(batchId: string) {
  const batchList = await db
    .select()
    .from(batches)
    .where(eq(batches.id, batchId))
    .limit(1);

  if (batchList.length === 0) return null;
  const batch = batchList[0];

  // Fetch hub
  const hubList = await db
    .select()
    .from(hubs)
    .where(eq(hubs.id, batch.hubId))
    .limit(1);
  const hub = hubList[0] || null;

  // Fetch all parcels in this batch
  const parcelRows = await db
    .select()
    .from(parcels)
    .where(eq(parcels.batchId, batchId))
    .orderBy(desc(parcels.createdAt));

  // Fetch all riders for this hub
  const hubRiders = await db
    .select()
    .from(riders)
    .where(eq(riders.hubId, batch.hubId));

  const riderMap = new Map<string, typeof hubRiders[0]>();
  const binRiderMap = new Map<number, typeof hubRiders[0]>();
  for (const r of hubRiders) {
    riderMap.set(r.id, r);
    binRiderMap.set(Number(r.assignedBin), r);
  }

  // Group parcels by bin
  const binGroups = new Map<
    number,
    {
      bin: number;
      riderId: string;
      riderName: string;
      riderPhone?: string;
      count: number;
      parcels: any[];
    }
  >();

  for (const p of parcelRows) {
    const binNumber = p.assignedBin ?? OVERFLOW_BIN_NUMBER;
    const isOverflow = binNumber === OVERFLOW_BIN_NUMBER;

    let group = binGroups.get(binNumber);
    if (!group) {
      let riderId = OVERFLOW_RIDER_ID;
      let riderName = OVERFLOW_RIDER_NAME;
      let riderPhone = "";

      if (!isOverflow && p.riderId && riderMap.has(p.riderId)) {
        const r = riderMap.get(p.riderId)!;
        riderId = r.id;
        riderName = r.name;
        riderPhone = r.phone;
      } else if (!isOverflow && binRiderMap.has(binNumber)) {
        const r = binRiderMap.get(binNumber)!;
        riderId = r.id;
        riderName = r.name;
        riderPhone = r.phone;
      }

      group = {
        bin: binNumber,
        riderId,
        riderName,
        riderPhone,
        count: 0,
        parcels: [],
      };
      binGroups.set(binNumber, group);
    }

    group.count += 1;
    group.parcels.push({
      id: p.id,
      rawAddress: p.rawAddress,
      extractedLandmark: p.extractedLandmark,
      resolvedDistrictCode: p.resolvedDistrictCode,
      assignedBin: p.assignedBin,
      riderId: p.riderId,
      status: p.status,
      createdAt: p.createdAt,
    });
  }

  return {
    batch,
    hub,
    totalParcels: parcelRows.length,
    bins: Array.from(binGroups.values()).sort((a, b) => a.bin - b.bin),
  };
}

