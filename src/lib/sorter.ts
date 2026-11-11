/**
 * Hanazo Bin Allocation Engine
 * Maps resolved NIPOST district codes to physical sorting bins and delivery riders.
 * If no active rider covers the district, routes the parcel to the hub overflow bin.
 */

import { db, riders } from "../db";
import { eq, and } from "drizzle-orm";
import { getDistrictNodes, CachedDistrictNode } from "./resolver";

export const OVERFLOW_BIN_NUMBER = 99;
export const OVERFLOW_RIDER_ID = "overflow";
export const OVERFLOW_RIDER_NAME = "Overflow / Unassigned";

/**
 * Result of allocating a parcel to a physical sorting bin.
 */
export interface BinAllocationResult {
  bin: number;
  riderId: string;
  riderName: string;
  districtCode: string | null;
  districtName: string;
  isOverflow: boolean;
}

/**
 * Cached rider representation for in-memory fast matching.
 */
export interface CachedRider {
  id: string;
  hubId: string;
  name: string;
  phone: string;
  assignedBin: number;
  assignedDistricts: string[];
  active: boolean;
}

// In-memory cache for hub riders (30-second TTL to handle high-frequency barcode scans)
const hubRidersCache = new Map<string, { riders: CachedRider[]; timestamp: number }>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

/**
 * Clears the in-memory rider cache for a specific hub (or all hubs).
 * Useful when riders are updated via the dispatch admin UI.
 *
 * @param hubId - Optional hub ID to clear. If omitted, clears all hubs.
 */
export function clearRiderCache(hubId?: string): void {
  if (hubId) {
    hubRidersCache.delete(hubId);
  } else {
    hubRidersCache.clear();
  }
}

/**
 * Retrieves active riders for a specific hub with caching.
 *
 * @param hubId - Unique identifier of the courier hub
 * @param forceRefresh - If true, bypasses in-memory cache and reloads from DB
 * @returns Array of active cached riders
 */
export async function getActiveRidersForHub(
  hubId: string,
  forceRefresh = false
): Promise<CachedRider[]> {
  const now = Date.now();
  const cached = hubRidersCache.get(hubId);

  if (!forceRefresh && cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.riders;
  }

  try {
    const rows = await db
      .select()
      .from(riders)
      .where(and(eq(riders.hubId, hubId), eq(riders.active, true)));

    const parsedRiders: CachedRider[] = rows.map((r: any) => {
      let assignedDistricts: string[] = [];
      if (Array.isArray(r.assignedDistricts)) {
        assignedDistricts = r.assignedDistricts;
      } else if (typeof r.assignedDistricts === "string") {
        try {
          assignedDistricts = JSON.parse(r.assignedDistricts);
        } catch {
          assignedDistricts = [r.assignedDistricts];
        }
      }

      return {
        id: r.id,
        hubId: r.hubId,
        name: r.name,
        phone: r.phone,
        assignedBin: Number(r.assignedBin),
        assignedDistricts: assignedDistricts.map((d: string) => d.trim().toUpperCase()),
        active: Boolean(r.active),
      };
    });

    hubRidersCache.set(hubId, { riders: parsedRiders, timestamp: now });
    return parsedRiders;
  } catch (error) {
    console.error(`[Hanazo Sorter] Error fetching active riders for hub ${hubId}:`, error);
    return cached?.riders || [];
  }
}

/**
 * Allocates a resolved district code to a physical sorting bin and dispatch rider.
 *
 * Algorithm:
 * 1. If districtCode is null or empty, routes immediately to Overflow Bin (Bin 99).
 * 2. Fetches active riders for the target hub.
 * 3. Checks if any active rider has an exact match or prefix match (e.g. rider covers "LA-04"
 *    and parcel is for "LA-04-A12").
 * 4. Resolves the human-readable district name from district nodes cache.
 * 5. Returns bin number, rider details, and overflow flag.
 *
 * @param districtCode - The resolved NIPOST code (e.g. 'LA-04-A12'), or null if unresolved
 * @param hubId - Target courier hub UUID
 * @returns Complete bin allocation metadata
 */
export async function allocateBin(
  districtCode: string | null,
  hubId: string
): Promise<BinAllocationResult> {
  const districtNodes = await getDistrictNodes();
  const matchedNode = districtCode
    ? districtNodes.find(
        (n: CachedDistrictNode) =>
          n.code.toUpperCase() === districtCode.toUpperCase()
      )
    : null;

  const districtName = matchedNode ? matchedNode.displayName : districtCode || "Unresolved Area";

  // If no district code was resolved, immediately send to overflow bin
  if (!districtCode) {
    return {
      bin: OVERFLOW_BIN_NUMBER,
      riderId: OVERFLOW_RIDER_ID,
      riderName: OVERFLOW_RIDER_NAME,
      districtCode: null,
      districtName: "Unresolved Address",
      isOverflow: true,
    };
  }

  const activeRiders = await getActiveRidersForHub(hubId);
  const targetCode = districtCode.toUpperCase().trim();
  const targetCodeClean = targetCode.replace(/[^A-Za-z0-9]/g, "");

  // Find a rider assigned to this district
  let matchedRider: CachedRider | null = null;

  for (const rider of activeRiders) {
    const isAssigned = rider.assignedDistricts.some((districtPattern) => {
      const cleanPattern = districtPattern.replace(/[^A-Za-z0-9]/g, "");

      // 1. Exact match (e.g. "LA-04-A12" === "LA-04-A12")
      if (districtPattern === targetCode || cleanPattern === targetCodeClean) {
        return true;
      }

      // 2. Prefix / LGA match (e.g. rider has "LA-04" or "LA-04-*" and parcel is "LA-04-A12")
      const prefix = districtPattern.replace(/\*+$/, "").trim();
      const cleanPrefix = prefix.replace(/[^A-Za-z0-9]/g, "");

      if (cleanPrefix.length >= 4 && targetCodeClean.startsWith(cleanPrefix)) {
        return true;
      }

      return false;
    });

    if (isAssigned) {
      matchedRider = rider;
      break;
    }
  }

  if (matchedRider) {
    return {
      bin: matchedRider.assignedBin,
      riderId: matchedRider.id,
      riderName: matchedRider.name,
      districtCode: targetCode,
      districtName,
      isOverflow: false,
    };
  }

  // No active rider covers this district; assign to hub overflow bin
  return {
    bin: OVERFLOW_BIN_NUMBER,
    riderId: OVERFLOW_RIDER_ID,
    riderName: OVERFLOW_RIDER_NAME,
    districtCode: targetCode,
    districtName,
    isOverflow: true,
  };
}

