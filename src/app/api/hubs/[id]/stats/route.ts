import { NextRequest } from "next/server";
import { db, hubs, batches, parcels, riders } from "@/db";
import { eq, desc } from "drizzle-orm";
import { jsonResponse, errorResponse, handleOptions } from "@/lib/api-response";

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: hubId } = await context.params;

    // 1. Fetch Hub
    const hubRows = await db.select().from(hubs).where(eq(hubs.id, hubId)).limit(1);
    if (hubRows.length === 0) {
      return errorResponse(`Hub with ID '${hubId}' not found`, 404);
    }
    const hub = hubRows[0];

    // 2. Fetch riders count
    const hubRiders = await db.select().from(riders).where(eq(riders.hubId, hubId));
    const activeRidersCount = hubRiders.filter((r) => r.active).length;

    // 3. Fetch all batches for this hub
    const hubBatches = await db
      .select()
      .from(batches)
      .where(eq(batches.hubId, hubId))
      .orderBy(desc(batches.createdAt));

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayBatches = hubBatches.filter((b) => b.batchDate === todayStr);

    // 4. Fetch all parcels associated with today's batches (or recent batches)
    const todayBatchIds = todayBatches.map((b) => b.id);
    let todayParcels: any[] = [];

    if (todayBatchIds.length > 0) {
      const allParcels = await db.select().from(parcels);
      todayParcels = allParcels.filter((p) => todayBatchIds.includes(p.batchId));
    }

    const totalToday = todayParcels.length;
    let overflowCount = 0;

    for (const p of todayParcels) {
      if (p.assignedBin === 99 || !p.resolvedDistrictCode) {
        overflowCount++;
      }
    }

    const avgConfidencePct =
      totalToday > 0 ? Math.round(((totalToday - overflowCount) / totalToday) * 100) : 100;

    // 5. Generate Last 7 Days mini-chart data
    const dailyVolume: Array<{ date: string; label: string; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });

      const dayBatches = hubBatches.filter((b) => b.batchDate === dStr);
      const dayCount = dayBatches.reduce((acc, b) => acc + (b.totalParcels || 0), 0);

      dailyVolume.push({
        date: dStr,
        label: dayLabel,
        count: dayCount,
      });
    }

    return jsonResponse(
      {
        hub,
        activeRidersCount,
        todayBatch: todayBatches[0] || null,
        stats: {
          totalParcelsToday: totalToday,
          avgConfidencePct,
          unresolvedCount: overflowCount,
          activeBatchesCount: todayBatches.length,
        },
        dailyVolume,
      },
      200
    );
  } catch (error: any) {
    console.error("[Hanazo API] Error in GET /api/hubs/[id]/stats:", error);
    return errorResponse(error?.message || "Failed to load hub statistics", 500);
  }
}

