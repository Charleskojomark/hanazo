import { NextRequest } from "next/server";
import { z } from "zod";
import { db, hubs, riders } from "@/db";
import { jsonResponse, errorResponse, handleOptions } from "@/lib/api-response";

export async function OPTIONS() {
  return handleOptions();
}

const createHubSchema = z.object({
  name: z.string().min(2, "Hub name must be at least 2 characters"),
  city: z.string().min(2, "City must be at least 2 characters"),
});

export async function GET() {
  try {
    const allHubs = await db.select().from(hubs);
    const allRiders = await db.select().from(riders);

    // Group rider count per hub
    const riderCounts = new Map<string, number>();
    for (const r of allRiders) {
      if (r.active) {
        riderCounts.set(r.hubId, (riderCounts.get(r.hubId) || 0) + 1);
      }
    }

    const result = allHubs.map((hub) => ({
      id: hub.id,
      name: hub.name,
      city: hub.city,
      riderCount: riderCounts.get(hub.id) || 0,
      createdAt: hub.createdAt,
    }));

    return jsonResponse(result, 200);
  } catch (error: any) {
    console.error("[Hanazo API] Error in GET /api/hubs:", error);
    return errorResponse(error?.message || "Internal server error fetching hubs", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON payload", 400);
    }

    const validation = createHubSchema.safeParse(body);
    if (!validation.success) {
      return errorResponse(
        "Validation error",
        422,
        validation.error.flatten().fieldErrors
      );
    }

    const { name, city } = validation.data;
    const newHubId = crypto.randomUUID();

    await db.insert(hubs).values({
      id: newHubId,
      name,
      city,
      createdAt: new Date(),
    } as any);

    return jsonResponse(
      {
        id: newHubId,
        name,
        city,
        riderCount: 0,
        createdAt: new Date(),
      },
      201
    );
  } catch (error: any) {
    console.error("[Hanazo API] Error in POST /api/hubs:", error);
    return errorResponse(error?.message || "Internal server error creating hub", 500);
  }
}

