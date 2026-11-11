import { getDistrictNodes } from "@/lib/resolver";
import { jsonResponse, errorResponse, handleOptions } from "@/lib/api-response";

export async function OPTIONS() {
  return handleOptions();
}

/**
 * Returns all official NIPOST district nodes for offline caching in IndexedDB.
 */
export async function GET() {
  try {
    const nodes = await getDistrictNodes();
    return jsonResponse(nodes, 200, {
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    });
  } catch (error: any) {
    return errorResponse(error?.message || "Failed to load districts", 500);
  }
}

