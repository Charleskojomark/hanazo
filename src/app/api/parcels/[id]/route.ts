import { NextRequest } from "next/server";
import { z } from "zod";
import { db, parcels } from "@/db";
import { eq } from "drizzle-orm";
import { jsonResponse, errorResponse, handleOptions } from "@/lib/api-response";

export async function OPTIONS() {
  return handleOptions();
}

const updateParcelSchema = z.object({
  assignedBin: z.number().int().min(1).max(999),
  riderId: z.string().optional().nullable(),
  status: z.enum(["pending", "sorted", "in_transit", "delivered", "failed"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: parcelId } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON payload", 400);
    }

    const validation = updateParcelSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(
        "Validation error",
        422,
        validation.error.flatten().fieldErrors
      );
    }

    const { assignedBin, riderId, status } = validation.data;

    await db
      .update(parcels)
      .set({
        assignedBin,
        riderId: riderId ?? null,
        status: status || "sorted",
      } as any)
      .where(eq(parcels.id, parcelId));

    return jsonResponse({ success: true, parcelId, assignedBin }, 200);
  } catch (error: any) {
    console.error("[Hanazo API] Error updating parcel:", error);
    return errorResponse(error?.message || "Failed to update parcel", 500);
  }
}

