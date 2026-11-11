import { NextResponse, type NextRequest } from "next/server";

// Rate limiting memory stores (sliding window per minute)
interface RateRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateRecord>();

// Clean up expired entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 120000);

function checkRateLimit(ip: string, category: "sort_batch" | "hub_mgmt" | "general"): {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();
  const WINDOW_MS = 60 * 1000; // 1 minute

  const limit = category === "sort_batch" ? 100 : category === "hub_mgmt" ? 10 : 60;
  const key = `${ip}:${category}`;
  const existing = rateLimitStore.get(key);

  if (!existing || now > existing.resetTime) {
    const newRecord: RateRecord = { count: 1, resetTime: now + WINDOW_MS };
    rateLimitStore.set(key, newRecord);
    return { allowed: true, limit, remaining: limit - 1, resetTime: newRecord.resetTime };
  }

  if (existing.count >= limit) {
    return { allowed: false, limit, remaining: 0, resetTime: existing.resetTime };
  }

  existing.count += 1;
  return { allowed: true, limit, remaining: limit - existing.count, resetTime: existing.resetTime };
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Only apply to /api/* routes; all dashboard UI routes are public for warehouse operators
  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // 1. Always allow CORS OPTIONS preflight
  if (request.method === "OPTIONS") {
    return NextResponse.next();
  }

  // 2. Health check endpoint is public
  if (pathname === "/api/health") {
    return NextResponse.next();
  }

  // 3. Optional B2B API Key Check
  const configuredApiKey = process.env.HANAZO_API_KEY;
  if (configuredApiKey) {
    const providedKey = request.headers.get("x-hanazo-key") || request.headers.get("x-api-key");
    const secFetchSite = request.headers.get("sec-fetch-site");
    const isBrowserSameOrigin = secFetchSite === "same-origin" || secFetchSite === "same-site";

    // Allow requests originating from our internal web dashboard or callers with valid API key
    if (!isBrowserSameOrigin && providedKey !== configuredApiKey) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Valid X-Hanazo-Key header is required for external B2B access.",
        },
        { status: 401 }
      );
    }
  }

  // 4. Rate Limiting per IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";

  let category: "sort_batch" | "hub_mgmt" | "general" = "general";
  if (pathname.startsWith("/api/sort") || pathname.startsWith("/api/batch")) {
    category = "sort_batch";
  } else if (pathname.startsWith("/api/hubs")) {
    category = "hub_mgmt";
  }

  const { allowed, limit, remaining, resetTime } = checkRateLimit(ip, category);

  if (!allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000));
    return NextResponse.json(
      {
        error: "Too Many Requests",
        message: `Rate limit of ${limit} requests per minute exceeded. Please retry after ${retryAfterSeconds}s.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfterSeconds.toString(),
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", limit.toString());
  response.headers.set("X-RateLimit-Remaining", remaining.toString());
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};

