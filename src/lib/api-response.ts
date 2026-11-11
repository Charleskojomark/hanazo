/**
 * Hanazo API Response & CORS Utilities
 * Provides standard CORS headers and structured JSON responses for serverless API routes.
 */

import { NextResponse } from "next/server";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-API-Key",
};

/**
 * Handles OPTIONS preflight requests for CORS.
 */
export function handleOptions() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Standard JSON success response with CORS headers.
 */
export function jsonResponse<T>(data: T, status = 200, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(data, {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

/**
 * Standard JSON error response with CORS headers.
 */
export function errorResponse(message: string, status = 400, details?: any) {
  return NextResponse.json(
    {
      error: message,
      status,
      ...(details !== undefined ? { details } : {}),
    },
    {
      status,
      headers: corsHeaders,
    }
  );
}

