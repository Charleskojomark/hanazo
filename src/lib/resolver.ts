/**
 * Hanazo District Resolution Engine
 * Resolves unstructured addresses to official NIPOST District codes using a 3-tier cascade:
 * Tier 1: Fast in-memory / SQL alias match (15ms)
 * Tier 2: NIPOST NDAPS Autocomplete API fallback (500ms)
 * Tier 3: Levenshtein fuzzy distance matching (tolerance of 2 edits)
 */

import { db, districtNodes } from "../db";
import { normalizeAddress, extractStructuredTokens, extractLandmarks, StructuredAddressTokens } from "./parser";
import { nipost } from "./nipost-client";

export type ResolutionConfidence = "high" | "medium" | "low" | "unresolved";
export type ResolutionMethod = "alias_match" | "nipost_api" | "fuzzy_match" | "none";

export interface DistrictResolutionResult {
  districtCode: string | null;
  districtName: string | null;
  confidence: ResolutionConfidence;
  method: ResolutionMethod;
  extractedLandmark: string | null;
  tokens: StructuredAddressTokens;
}

export interface CachedDistrictNode {
  code: string;
  state: string;
  lga: string;
  district: string;
  displayName: string;
  aliases: string[];
}

// In-memory cache for district reference nodes to achieve < 15ms resolution latency
let districtCache: CachedDistrictNode[] | null = null;
let lastCacheUpdate = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Loads all district nodes from the database into memory with TTL caching.
 */
export async function getDistrictNodes(): Promise<CachedDistrictNode[]> {
  const now = Date.now();
  if (districtCache && now - lastCacheUpdate < CACHE_TTL_MS) {
    return districtCache;
  }

  try {
    const rows = await db.select().from(districtNodes);
    districtCache = rows.map((r: any) => ({
      code: r.code,
      state: r.state,
      lga: r.lga,
      district: r.district,
      displayName: r.displayName || r.display_name,
      // Parse JSON string if coming from SQLite, or use array directly if PostgreSQL
      aliases: Array.isArray(r.aliases)
        ? r.aliases
        : typeof r.aliases === "string"
        ? JSON.parse(r.aliases)
        : [],
    }));
    lastCacheUpdate = now;
    return districtCache;
  } catch (error) {
    console.error("[Hanazo Resolver] Error fetching district nodes from database:", error);
    return districtCache || [];
  }
}

/**
 * Fast Levenshtein distance calculation for fuzzy matching.
 * Includes early-exit optimization if length delta exceeds max threshold.
 */
function calculateLevenshtein(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  if (Math.abs(an - bn) > 2) return 999;

  const matrix: number[][] = [];
  for (let i = 0; i <= bn; ++i) matrix[i] = [i];
  for (let j = 0; j <= an; ++j) matrix[0][j] = j;

  for (let i = 1; i <= bn; ++i) {
    for (let j = 1; j <= an; ++j) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[bn][an];
}

/**
 * Resolves an unstructured raw address to an official NIPOST District Code.
 *
 * @param rawAddress - Raw address string from customer or waybill
 * @returns Complete resolution result with confidence score and method
 */
export async function resolveDistrict(rawAddress: string): Promise<DistrictResolutionResult> {
  const normalized = normalizeAddress(rawAddress);
  const tokens = extractStructuredTokens(normalized);
  const landmarks = extractLandmarks(normalized);
  const primaryLandmark = landmarks.length > 0 ? landmarks[0] : null;

  const nodes = await getDistrictNodes();

  // -------------------------------------------------------------
  // STEP 1: FAST PATH — Alias & Landmark Direct Substring Match (15ms)
  // -------------------------------------------------------------
  const isLagosAddress = /\b(lagos|lasgidi|eko)\b/i.test(normalized);
  const isAbujaAddress = /\b(abuja|fct)\b/i.test(normalized);

  const allAliases: Array<{ alias: string; node: CachedDistrictNode }> = [];
  for (const node of nodes) {
    for (const alias of node.aliases) {
      allAliases.push({ alias: alias.toLowerCase().trim(), node });
    }
    allAliases.push({ alias: node.displayName.toLowerCase().trim(), node });
  }

  // Prioritize matching by state affinity first, then longer alias length
  allAliases.sort((a, b) => {
    if (isLagosAddress) {
      if (a.node.state === "LA" && b.node.state !== "LA") return -1;
      if (a.node.state !== "LA" && b.node.state === "LA") return 1;
    } else if (isAbujaAddress) {
      if (a.node.state === "FC" && b.node.state !== "FC") return -1;
      if (a.node.state !== "FC" && b.node.state === "FC") return 1;
    }
    return b.alias.length - a.alias.length;
  });

  // Check structured area token first if extracted
  if (tokens.area) {
    const areaLower = tokens.area.toLowerCase();
    const areaMatch = allAliases.find(
      ({ alias, node }) =>
        (alias === areaLower || node.displayName.toLowerCase().includes(areaLower)) &&
        (!isLagosAddress || node.state === "LA")
    );
    if (areaMatch) {
      return {
        districtCode: areaMatch.node.code,
        districtName: areaMatch.node.displayName,
        confidence: "high",
        method: "alias_match",
        extractedLandmark: primaryLandmark,
        tokens,
      };
    }
  }

  for (const { alias, node } of allAliases) {
    if (alias.length < 3) continue;

    // Word boundary or substring match against the normalized address text
    const aliasRegex = new RegExp(`(^|\\b|\\s|,)${alias}(\\b|\\s|,|$)`, "i");
    if (aliasRegex.test(normalized)) {
      return {
        districtCode: node.code,
        districtName: node.displayName,
        confidence: "high",
        method: "alias_match",
        extractedLandmark: primaryLandmark,
        tokens,
      };
    }
  }

  // -------------------------------------------------------------
  // STEP 2: NIPOST NDAPS AUTOCOMPLETE API FALLBACK (500ms)
  // -------------------------------------------------------------
  const searchCandidates = [
    tokens.area,
    tokens.streetName,
    primaryLandmark,
    normalized.slice(0, 40),
  ].filter((s): s is string => Boolean(s && s.length >= 3));

  for (const candidate of searchCandidates) {
    try {
      const apiResult = await nipost.searchAutocomplete(candidate);
      if (apiResult?.results && apiResult.results.length > 0) {
        const topHit = apiResult.results[0];

        // If NIPOST returned a full postcode (e.g. LA-04-A12-DB-01 or LA04A12)
        // Extract the State-LGA-District portion
        let matchedDistrictCode: string | null = null;
        const cleanCode = topHit.code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

        if (cleanCode.length >= 7) {
          const state = cleanCode.slice(0, 2);
          const lga = cleanCode.slice(2, 4);
          const district = cleanCode.slice(4, 7);
          matchedDistrictCode = `${state}-${lga}-${district}`;
        }

        if (matchedDistrictCode) {
          const node = nodes.find((n) => n.code === matchedDistrictCode);
          return {
            districtCode: matchedDistrictCode,
            districtName: node ? node.displayName : topHit.label || matchedDistrictCode,
            confidence: "medium",
            method: "nipost_api",
            extractedLandmark: primaryLandmark,
            tokens,
          };
        }
      }
    } catch {
      // Remote NIPOST API unavailable or timed out; proceed to Tier 3 fuzzy match
      break;
    }
  }

  // -------------------------------------------------------------
  // STEP 3: FUZZY LEVENSHTEIN DISTANCE MATCH (Tolerance: 1 edit for typos)
  // -------------------------------------------------------------
  const GENERIC_STOP_WORDS = new Set([
    "station", "filling", "street", "building", "junction", "enter", "behind",
    "opposite", "beside", "reach", "house", "yellow", "blessing", "mama",
    "baba", "shop", "plaza", "transformer", "close", "roundabout", "market",
    "water", "church", "mosque", "estate", "expressway", "bridge"
  ]);

  // Split normalized text into words with length >= 5
  const words = normalized
    .split(/[\s,.-]+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 5 && !GENERIC_STOP_WORDS.has(w));

  let bestMatch: { node: CachedDistrictNode; distance: number } | null = null;

  for (const word of words) {
    for (const { alias, node } of allAliases) {
      // Only compare single-word aliases or primary word components (length >= 5)
      if (!alias.includes(" ") && alias.length >= 5 && !GENERIC_STOP_WORDS.has(alias)) {
        if (isLagosAddress && node.state !== "LA") continue;
        if (isAbujaAddress && node.state !== "FC") continue;

        const dist = calculateLevenshtein(word, alias);
        if (dist === 1) {
          bestMatch = { node, distance: dist };
          break;
        }
      }
    }
    if (bestMatch) break;
  }

  if (bestMatch) {
    return {
      districtCode: bestMatch.node.code,
      districtName: bestMatch.node.displayName,
      confidence: "low",
      method: "fuzzy_match",
      extractedLandmark: primaryLandmark,
      tokens,
    };
  }

  // -------------------------------------------------------------
  // STEP 4: UNRESOLVED FALLBACK
  // -------------------------------------------------------------
  return {
    districtCode: null,
    districtName: null,
    confidence: "unresolved",
    method: "none",
    extractedLandmark: primaryLandmark,
    tokens,
  };
}

