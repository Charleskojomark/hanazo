import { db, districtNodes } from "@/db";
import { jsonResponse, handleOptions } from "@/lib/api-response";

export async function OPTIONS() {
  return handleOptions();
}

/**
 * Health check endpoint for Vercel, uptime monitors, and load balancers.
 */
export async function GET() {
  const startTime = Date.now();

  // 1. Check Database connectivity
  let databaseStatus: "connected" | "offline" = "offline";
  try {
    await db.select().from(districtNodes).limit(1);
    databaseStatus = "connected";
  } catch (err) {
    console.error("[Hanazo Health] Database probe failed:", err);
    databaseStatus = "offline";
  }

  // 2. Check NIPOST NDAPS API reachability (2.5s maximum timeout)
  let nipostStatus: "reachable" | "unreachable" = "unreachable";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);

    const baseUrl = process.env.NIPOST_API_URL || "https://api.postcode.gov.ng";
    const response = await fetch(`${baseUrl}/v1/reference/states`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "X-API-Key": process.env.NIPOST_API_KEY || "nipost_test_xxxx",
      },
    });
    clearTimeout(timer);

    if (response.status < 500) {
      nipostStatus = "reachable";
    }
  } catch {
    nipostStatus = "unreachable";
  }

  const isHealthy = databaseStatus === "connected";
  const status = isHealthy ? "ok" : "degraded";

  return jsonResponse(
    {
      status,
      database: databaseStatus,
      nipost: nipostStatus,
      version: "0.1.0",
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    },
    isHealthy ? 200 : 503
  );
}

