import { NextRequest } from "next/server";
import { z } from "zod";
import { db, parcels } from "@/db";
import { processSingleAddress } from "@/lib/batch-processor";
import { getOrCreateActiveBatch, incrementBatchParcelCount } from "@/lib/batch-service";
import { jsonResponse, errorResponse, handleOptions } from "@/lib/api-response";

export async function OPTIONS() {
  return handleOptions();
}

const sortRequestSchema = z.object({
  rawAddress: z.string().min(1, "rawAddress is required"),
  hubId: z.string().min(1, "hubId is required"),
  batchId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON payload", 400);
    }

    const validation = sortRequestSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(
        "Validation error",
        422,
        validation.error.flatten().fieldErrors
      );
    }

    const { rawAddress, hubId, batchId: inputBatchId } = validation.data;

    // 1. Process address through Hanazo parsing, resolution and bin allocation
    const sortResult = await processSingleAddress(rawAddress, hubId);

    // 2. Resolve target batch (use provided batchId or find/create active daily batch)
    const batchId = inputBatchId || (await getOrCreateActiveBatch(hubId));

    // 3. Create parcel record in the database
    const parcelId = crypto.randomUUID();
    const isOverflowRider = sortResult.isOverflow || sortResult.riderId === "overflow";

    await db.insert(parcels).values({
      id: parcelId,
      batchId,
      rawAddress: sortResult.rawAddress,
      extractedLandmark: sortResult.extractedLandmark,
      resolvedDistrictCode: sortResult.districtCode,
      assignedBin: sortResult.bin,
      riderId: isOverflowRider ? null : sortResult.riderId,
      status: "sorted",
      createdAt: new Date(),
    } as any);

    // 4. Increment batch count asynchronously
    incrementBatchParcelCount(batchId, 1);

    return jsonResponse(
      {
        parcelId,
        batchId,
        bin: sortResult.bin,
        riderId: sortResult.riderId,
        riderName: sortResult.riderName,
        districtCode: sortResult.districtCode || "",
        districtName: sortResult.districtName || "",
        confidence: sortResult.confidence,
        extractedLandmark: sortResult.extractedLandmark,
        isOverflow: sortResult.isOverflow,
      },
      201
    );
  } catch (error: any) {
    console.error("[Hanazo API] Error in /api/sort:", error);
    return errorResponse(error?.message || "Internal server error during sorting", 500);
  }
}

