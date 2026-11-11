import { getDistrictNodes } from "@/lib/resolver";
import { jsonResponse, errorResponse, handleOptions } from "@/lib/api-response";

export async function OPTIONS() {
  return handleOptions();
}

/**
 * Returns cached district nodes with aliases for client-side offline sorting fallback.
 */
export async function GET() {
  try {
    const nodes = await getDistrictNodes();
    return jsonResponse(nodes, 200, {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    });
  } catch (error: any) {
    return errorResponse(error?.message || "Failed to load district nodes", 500);
  }
}

