import { NextRequest } from "next/server";
import { z } from "zod";
import { db, batches, parcels } from "@/db";
import { processBatchWithSummary } from "@/lib/batch-processor";
import { jsonResponse, errorResponse, handleOptions } from "@/lib/api-response";

export async function OPTIONS() {
  return handleOptions();
}

const batchRequestSchema = z.object({
  addresses: z.array(z.string().min(1)).min(1, "At least one address must be provided"),
  hubId: z.string().min(1, "hubId is required"),
});

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON payload", 400);
    }

    const validation = batchRequestSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(
        "Validation error",
        422,
        validation.error.flatten().fieldErrors
      );
    }

    const { addresses, hubId } = validation.data;

    // 1. Process batch concurrently via the Hanazo engine
    const summary = await processBatchWithSummary(addresses, hubId);

    // 2. Create the new batch record in the database
    const batchId = crypto.randomUUID();
    const today = new Date().toISOString().slice(0, 10);

    await db.insert(batches).values({
      id: batchId,
      hubId,
      batchDate: today,
      status: "sorting",
      totalParcels: summary.total,
      createdAt: new Date(),
    } as any);

    // 3. Prepare parcel records for bulk database insertion
    const parcelRows = summary.results.map((result) => {
      const isOverflowRider = result.isOverflow || result.riderId === "overflow";
      return {
        id: crypto.randomUUID(),
        batchId,
        rawAddress: result.rawAddress,
        extractedLandmark: result.extractedLandmark,
        resolvedDistrictCode: result.districtCode,
        assignedBin: result.bin,
        riderId: isOverflowRider ? null : result.riderId,
        status: "sorted",
        createdAt: new Date(),
      };
    });

    // Insert parcels in chunks of 50 to guarantee compatibility across all database engines
    const CHUNK_SIZE = 50;
    for (let i = 0; i < parcelRows.length; i += CHUNK_SIZE) {
      const chunk = parcelRows.slice(i, i + CHUNK_SIZE);
      await db.insert(parcels).values(chunk as any);
    }

    // 4. Group bins for summary output
    const binCounts = new Map<number, { bin: number; riderName: string; count: number }>();
    for (const r of summary.results) {
      const current = binCounts.get(r.bin);
      if (current) {
        current.count += 1;
      } else {
        binCounts.set(r.bin, {
          bin: r.bin,
          riderName: r.riderName,
          count: 1,
        });
      }
    }

    const bins = Array.from(binCounts.values()).sort((a, b) => a.bin - b.bin);

    return jsonResponse(
      {
        batchId,
        totalParcels: summary.total,
        sorted: summary.sorted,
        unresolved: summary.unresolved,
        bins,
        durationMs: summary.durationMs,
      },
      201
    );
  } catch (error: any) {
    console.error("[Hanazo API] Error in /api/batch:", error);
    return errorResponse(error?.message || "Internal server error during batch processing", 500);
  }
}

