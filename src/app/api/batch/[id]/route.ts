import { NextRequest } from "next/server";
import { getBatchWithParcels } from "@/lib/batch-service";
import { jsonResponse, errorResponse, handleOptions } from "@/lib/api-response";

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id || id.trim().length === 0) {
      return errorResponse("Batch ID parameter is required", 400);
    }

    const batchDetails = await getBatchWithParcels(id);

    if (!batchDetails) {
      return errorResponse(`Batch with ID '${id}' not found`, 404);
    }

    return jsonResponse(batchDetails, 200);
  } catch (error: any) {
    console.error("[Hanazo API] Error in GET /api/batch/[id]:", error);
    return errorResponse(error?.message || "Internal server error fetching batch details", 500);
  }
}

