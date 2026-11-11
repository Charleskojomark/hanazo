import { NextRequest } from "next/server";
import { z } from "zod";
import { db, hubs, riders } from "@/db";
import { eq, and } from "drizzle-orm";
import { clearRiderCache } from "@/lib/sorter";
import { jsonResponse, errorResponse, handleOptions } from "@/lib/api-response";

export async function OPTIONS() {
  return handleOptions();
}

const riderUpsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Rider name must be at least 2 characters"),
  phone: z.string().min(8, "Valid phone number is required"),
  assignedBin: z.coerce.number().int().min(1, "Bin number must be >= 1"),
  assignedDistricts: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: hubId } = await context.params;

    const hubRows = await db.select().from(hubs).where(eq(hubs.id, hubId)).limit(1);
    if (hubRows.length === 0) {
      return errorResponse(`Hub with ID '${hubId}' not found`, 404);
    }

    const hubRiders = await db
      .select()
      .from(riders)
      .where(eq(riders.hubId, hubId));

    const formatted = hubRiders.map((r: any) => ({
      id: r.id,
      hubId: r.hubId,
      name: r.name,
      phone: r.phone,
      assignedBin: r.assignedBin,
      assignedDistricts: Array.isArray(r.assignedDistricts)
        ? r.assignedDistricts
        : typeof r.assignedDistricts === "string"
        ? JSON.parse(r.assignedDistricts)
        : [],
      active: Boolean(r.active),
    }));

    return jsonResponse(formatted, 200);
  } catch (error: any) {
    console.error("[Hanazo API] Error in GET /api/hubs/[id]/riders:", error);
    return errorResponse(error?.message || "Internal server error fetching riders", 500);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: hubId } = await context.params;

    // Verify hub exists
    const hubRows = await db.select().from(hubs).where(eq(hubs.id, hubId)).limit(1);
    if (hubRows.length === 0) {
      return errorResponse(`Hub with ID '${hubId}' not found`, 404);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON payload", 400);
    }

    const validation = riderUpsertSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(
        "Validation error",
        422,
        validation.error.flatten().fieldErrors
      );
    }

    const { id: inputRiderId, name, phone, assignedBin, assignedDistricts, active } =
      validation.data;

    let targetRiderId = inputRiderId;
    let isUpdate = false;

    if (inputRiderId) {
      const existing = await db
        .select()
        .from(riders)
        .where(and(eq(riders.id, inputRiderId), eq(riders.hubId, hubId)))
        .limit(1);

      if (existing.length > 0) {
        isUpdate = true;
      }
    }

    if (isUpdate && targetRiderId) {
      // Update existing rider
      await db
        .update(riders)
        .set({
          name,
          phone,
          assignedBin,
          assignedDistricts,
          active,
        } as any)
        .where(eq(riders.id, targetRiderId));
    } else {
      // Create new rider
      targetRiderId = targetRiderId || crypto.randomUUID();
      await db.insert(riders).values({
        id: targetRiderId,
        hubId,
        name,
        phone,
        assignedBin,
        assignedDistricts,
        active,
      } as any);
    }

    // Invalidate sorter cache so updated routes take effect immediately
    clearRiderCache(hubId);

    return jsonResponse(
      {
        id: targetRiderId,
        hubId,
        name,
        phone,
        assignedBin,
        assignedDistricts,
        active,
        updated: isUpdate,
      },
      isUpdate ? 200 : 201
    );
  } catch (error: any) {
    console.error("[Hanazo API] Error in POST /api/hubs/[id]/riders:", error);
    return errorResponse(error?.message || "Internal server error saving rider", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: hubId } = await context.params;
    const { searchParams } = new URL(request.url);
    const riderId = searchParams.get("riderId");

    if (!riderId) {
      return errorResponse("riderId query parameter is required", 400);
    }

    await db
      .delete(riders)
      .where(and(eq(riders.id, riderId), eq(riders.hubId, hubId)));

    clearRiderCache(hubId);

    return jsonResponse({ success: true, deletedRiderId: riderId }, 200);
  } catch (error: any) {
    console.error("[Hanazo API] Error in DELETE /api/hubs/[id]/riders:", error);
    return errorResponse(error?.message || "Internal server error deleting rider", 500);
  }
}

