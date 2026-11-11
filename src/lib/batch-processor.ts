/**
 * Hanazo Bulk Morning Batch Processor
 * High-throughput pre-dispatch parcel sorting engine for Nigerian courier hubs.
 * Runs bulk address arrays through normalizeAddress -> resolveDistrict -> allocateBin
 * with controlled concurrency (max 5 simultaneous external API calls) and full error isolation.
 */

import { normalizeAddress } from "./parser";
import { resolveDistrict, ResolutionConfidence, ResolutionMethod } from "./resolver";
import { allocateBin, BinAllocationResult, OVERFLOW_BIN_NUMBER, OVERFLOW_RIDER_ID, OVERFLOW_RIDER_NAME } from "./sorter";

/**
 * Result of sorting an individual parcel in a batch.
 */
export interface SortResult {
  index: number;
  rawAddress: string;
  normalizedAddress: string;
  extractedLandmark: string | null;
  districtCode: string | null;
  districtName: string | null;
  bin: number;
  riderId: string;
  riderName: string;
  confidence: ResolutionConfidence;
  method: ResolutionMethod;
  isFlaggedForReview: boolean;
  isOverflow: boolean;
  error?: string;
}

/**
 * High-level summary metrics of a completed batch sort.
 */
export interface BatchProcessSummary {
  total: number;
  sorted: number;
  overflow: number;
  unresolved: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  flaggedCount: number;
  durationMs: number;
  results: SortResult[];
}

/**
 * Configuration options for the batch processor.
 */
export interface BatchProcessorOptions {
  /**
   * Maximum concurrent parcels being processed through the resolution engine.
   * Defaults to 5 to strictly respect NIPOST API rate limits and avoid socket exhaustion.
   */
  concurrency?: number;
}

/**
 * Controlled concurrency mapper using worker pool.
 * Guarantees that at most `limit` asynchronous workers run simultaneously.
 */
async function runWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      try {
        results[index] = await fn(items[index], index);
      } catch (err: any) {
        // Individual item level error recovery
        console.error(`[Hanazo Batch] Unhandled error at index ${index}:`, err);
        throw err;
      }
    }
  }

  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.allSettled(workers);
  return results;
}

/**
 * Processes an individual parcel address through the complete Hanazo pipeline:
 * 1. Text normalization & noise stripping
 * 2. Multi-tier district resolution (Alias -> NIPOST API -> Levenshtein)
 * 3. Physical bin & rider allocation
 *
 * @param rawAddress - Raw input address string from waybill / CSV
 * @param hubId - Target courier hub UUID
 * @param index - Index of the item in the batch
 * @returns Fully populated SortResult
 */
export async function processSingleAddress(
  rawAddress: string,
  hubId: string,
  index = 0
): Promise<SortResult> {
  const trimmed = (rawAddress || "").trim();
  const normalized = normalizeAddress(trimmed);

  if (!trimmed) {
    return {
      index,
      rawAddress: "",
      normalizedAddress: "",
      extractedLandmark: null,
      districtCode: null,
      districtName: null,
      bin: OVERFLOW_BIN_NUMBER,
      riderId: OVERFLOW_RIDER_ID,
      riderName: OVERFLOW_RIDER_NAME,
      confidence: "unresolved",
      method: "none",
      isFlaggedForReview: true,
      isOverflow: true,
      error: "Empty address provided",
    };
  }

  try {
    // Step 1 & 2 & 3: Resolve District Code
    const resolution = await resolveDistrict(trimmed);

    // Step 4: Allocate to Physical Sorting Bin and Rider
    const allocation: BinAllocationResult = await allocateBin(
      resolution.districtCode,
      hubId
    );

    const isFlagged =
      resolution.confidence === "unresolved" ||
      resolution.confidence === "low" ||
      allocation.isOverflow;

    return {
      index,
      rawAddress: trimmed,
      normalizedAddress: normalized,
      extractedLandmark: resolution.extractedLandmark,
      districtCode: resolution.districtCode,
      districtName: allocation.districtName || resolution.districtName,
      bin: allocation.bin,
      riderId: allocation.riderId,
      riderName: allocation.riderName,
      confidence: resolution.confidence,
      method: resolution.method,
      isFlaggedForReview: isFlagged,
      isOverflow: allocation.isOverflow,
    };
  } catch (error: any) {
    return {
      index,
      rawAddress: trimmed,
      normalizedAddress: normalized,
      extractedLandmark: null,
      districtCode: null,
      districtName: null,
      bin: OVERFLOW_BIN_NUMBER,
      riderId: OVERFLOW_RIDER_ID,
      riderName: OVERFLOW_RIDER_NAME,
      confidence: "unresolved",
      method: "none",
      isFlaggedForReview: true,
      isOverflow: true,
      error: error?.message || "Internal processing error",
    };
  }
}

/**
 * Processes a bulk batch of raw delivery addresses for morning hub dispatch.
 * Concurrently resolves districts and allocates sorting bins with max 5 concurrent requests.
 *
 * @param addresses - Array of raw address strings (e.g. pasted from Excel / waybill manifests)
 * @param hubId - Target courier hub UUID
 * @param options - Optional concurrency settings
 * @returns Array of SortResult objects corresponding to each input address
 */
export async function processBatch(
  addresses: string[],
  hubId: string,
  options?: BatchProcessorOptions
): Promise<SortResult[]> {
  const concurrency = options?.concurrency ?? 5;

  return runWithConcurrencyLimit(addresses, concurrency, (address, index) =>
    processSingleAddress(address, hubId, index)
  );
}

/**
 * Processes a bulk batch of delivery addresses and aggregates operational metrics.
 *
 * @param addresses - Array of raw address strings
 * @param hubId - Target courier hub UUID
 * @param options - Optional concurrency settings
 * @returns BatchProcessSummary with counts, duration, and detailed results
 */
export async function processBatchWithSummary(
  addresses: string[],
  hubId: string,
  options?: BatchProcessorOptions
): Promise<BatchProcessSummary> {
  const startTime = Date.now();
  const results = await processBatch(addresses, hubId, options);
  const durationMs = Date.now() - startTime;

  let sorted = 0;
  let overflow = 0;
  let unresolved = 0;
  let highConfidence = 0;
  let mediumConfidence = 0;
  let lowConfidence = 0;
  let flaggedCount = 0;

  for (const r of results) {
    if (r.isOverflow) overflow++;
    else sorted++;

    if (r.confidence === "high") highConfidence++;
    else if (r.confidence === "medium") mediumConfidence++;
    else if (r.confidence === "low") lowConfidence++;
    else unresolved++;

    if (r.isFlaggedForReview) flaggedCount++;
  }

  return {
    total: addresses.length,
    sorted,
    overflow,
    unresolved,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    flaggedCount,
    durationMs,
    results,
  };
}

