import { NextRequest } from "next/server";
import { db, batches, hubs, riders, parcels } from "@/db";
import { eq, and } from "drizzle-orm";
import { getDistrictNodes, CachedDistrictNode } from "@/lib/resolver";
import { OVERFLOW_BIN_NUMBER, OVERFLOW_RIDER_ID, OVERFLOW_RIDER_NAME } from "@/lib/sorter";
import { jsonResponse, errorResponse, handleOptions } from "@/lib/api-response";

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ batchId: string; bin: string }> }
) {
  try {
    const { batchId, bin: binParam } = await context.params;

    if (!batchId || !binParam) {
      return errorResponse("Both batchId and bin parameters are required", 400);
    }

    const binNumber = parseInt(binParam, 10);
    if (isNaN(binNumber)) {
      return errorResponse("Bin parameter must be a valid integer", 400);
    }

    // 1. Fetch batch
    const batchRows = await db
      .select()
      .from(batches)
      .where(eq(batches.id, batchId))
      .limit(1);

    if (batchRows.length === 0) {
      return errorResponse(`Batch with ID '${batchId}' not found`, 404);
    }
    const batch = batchRows[0];

    // 2. Fetch Hub
    const hubRows = await db
      .select()
      .from(hubs)
      .where(eq(hubs.id, batch.hubId))
      .limit(1);
    const hub = hubRows[0] || { id: batch.hubId, name: "Hanazo Courier Hub", city: "Nigeria" };

    // 3. Fetch Rider for this bin
    let rider = {
      id: OVERFLOW_RIDER_ID,
      name: OVERFLOW_RIDER_NAME,
      phone: "N/A",
    };

    if (binNumber !== OVERFLOW_BIN_NUMBER) {
      const riderRows = await db
        .select()
        .from(riders)
        .where(
          and(
            eq(riders.hubId, batch.hubId),
            eq(riders.assignedBin, binNumber),
            eq(riders.active, true)
          )
        )
        .limit(1);

      if (riderRows.length > 0) {
        rider = {
          id: riderRows[0].id,
          name: riderRows[0].name,
          phone: riderRows[0].phone,
        };
      }
    }

    // 4. Fetch all parcels for this batch and bin
    const parcelRows = await db
      .select()
      .from(parcels)
      .where(
        and(
          eq(parcels.batchId, batchId),
          eq(parcels.assignedBin, binNumber)
        )
      );

    // 5. Load district reference cache to append human-readable names
    const districtNodes = await getDistrictNodes();
    const nodeMap = new Map<string, CachedDistrictNode>();
    for (const node of districtNodes) {
      nodeMap.set(node.code.toUpperCase(), node);
    }

    // 6. Sort parcels by district proximity and street/landmark sequential clustering
    const sequencedParcels = parcelRows
      .map((p) => {
        const code = p.resolvedDistrictCode?.toUpperCase() || "";
        const node = code ? nodeMap.get(code) : null;
        return {
          id: p.id,
          rawAddress: p.rawAddress,
          extractedLandmark: p.extractedLandmark,
          districtCode: p.resolvedDistrictCode,
          districtName: node ? node.displayName : p.resolvedDistrictCode || "Unresolved Area",
          status: p.status,
          createdAt: p.createdAt,
        };
      })
      .sort((a, b) => {
        // Primary sort: group by district code
        const distCompare = (a.districtCode || "ZZZ").localeCompare(b.districtCode || "ZZZ");
        if (distCompare !== 0) return distCompare;

        // Secondary sort: group by landmark or street clustering
        const landmarkA = a.extractedLandmark || a.rawAddress;
        const landmarkB = b.extractedLandmark || b.rawAddress;
        return landmarkA.localeCompare(landmarkB);
      })
      .map((p, idx) => ({
        sequenceNumber: idx + 1,
        ...p,
      }));

    return jsonResponse(
      {
        manifestId: `MAN-${batchId.slice(0, 8)}-BIN${binNumber}`,
        batchId: batch.id,
        batchDate: batch.batchDate,
        batchStatus: batch.status,
        hub: {
          id: hub.id,
          name: hub.name,
          city: hub.city,
        },
        bin: binNumber,
        rider,
        totalParcels: sequencedParcels.length,
        generatedAt: new Date().toISOString(),
        parcels: sequencedParcels,
      },
      200
    );
  } catch (error: any) {
    console.error("[Hanazo API] Error in GET /api/manifest/[batchId]/[bin]:", error);
    return errorResponse(error?.message || "Internal server error generating manifest", 500);
  }
}

