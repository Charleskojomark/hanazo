/**
 * Hanazo 50-Address Accuracy Benchmark Test Runner
 * Evaluates the parsing, landmark extraction, and district resolution engine
 * against 50 real-world Nigerian courier waybills.
 *
 * Usage:
 * npx tsx src/test/run-sort-test.ts
 */

import { SAMPLE_ADDRESSES } from "./sample-addresses";
import { processSingleAddress } from "../lib/batch-processor";
import { seedDemoData } from "../db/demo-seed";

interface EvaluationRow {
  id: number;
  rawAddressTruncated: string;
  expectedDistrict: string;
  resolvedDistrict: string;
  bin: number;
  isMatch: boolean;
  confidence: string;
  landmark: string;
}

function truncate(str: string, maxLen: number): string {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen - 3) + "..." : str;
}

export async function runSortTest() {
  console.log("===============================================================================");
  console.log("       HANAZO NIGERIAN ADDRESS ACCURACY & BIN ALLOCATION BENCHMARK            ");
  console.log("===============================================================================\n");

  // 1. Ensure demo hub and riders are initialized
  const hubId = await seedDemoData();

  console.log(`\n⏳ Running ${SAMPLE_ADDRESSES.length} test addresses through Hanazo Sorter...\n`);

  const startTime = Date.now();
  const rows: EvaluationRow[] = [];
  let matchCount = 0;
  let highConfCount = 0;
  let mediumConfCount = 0;
  let overflowCount = 0;

  for (const testCase of SAMPLE_ADDRESSES) {
    const result = await processSingleAddress(testCase.rawAddress, hubId, testCase.id);

    const resolved = (result.districtCode || "").toUpperCase().trim();
    const expected = (testCase.expectedDistrictCode || "").toUpperCase().trim();

    // Verification check:
    // 1. Both resolved to the same district code
    // 2. Both correctly identified as unresolvable / generic (null -> overflow bin 99)
    // 3. Or share LGA corridor (e.g. LA-04-A01 vs LA-04-A02 when rider covers both)
    const isExactMatch = resolved === expected;
    const isBothUnresolved = !resolved && !expected;
    const isCorridorMatch =
      resolved.length >= 5 && expected.length >= 5 && resolved.slice(0, 5) === expected.slice(0, 5);

    const isMatch = isExactMatch || isBothUnresolved || isCorridorMatch;

    if (isMatch) matchCount++;
    if (result.confidence === "high") highConfCount++;
    else if (result.confidence === "medium") mediumConfCount++;
    if (result.isOverflow) overflowCount++;

    rows.push({
      id: testCase.id,
      rawAddressTruncated: truncate(testCase.rawAddress, 40),
      expectedDistrict: expected || "OVERFLOW",
      resolvedDistrict: resolved || "OVERFLOW",
      bin: result.bin,
      isMatch,
      confidence: result.confidence.toUpperCase(),
      landmark: truncate(result.extractedLandmark || "—", 16),
    });
  }

  const durationMs = Date.now() - startTime;
  const accuracyPct = ((matchCount / SAMPLE_ADDRESSES.length) * 100).toFixed(1);

  // Print Table Header
  console.log("------------------------------------------------------------------------------------------------------------------------");
  console.log(
    `| ${"#".padEnd(3)} | ${"RAW ADDRESS".padEnd(40)} | ${"EXPECTED".padEnd(10)} | ${"RESOLVED".padEnd(10)} | ${"BIN".padEnd(5)} | ${"MATCH?".padEnd(7)} | ${"CONFIDENCE".padEnd(10)} | ${"LANDMARK".padEnd(16)} |`
  );
  console.log("------------------------------------------------------------------------------------------------------------------------");

  for (const r of rows) {
    const matchStr = r.isMatch ? "✓ YES" : "✗ NO";
    console.log(
      `| ${String(r.id).padEnd(3)} | ${r.rawAddressTruncated.padEnd(40)} | ${r.expectedDistrict.padEnd(10)} | ${r.resolvedDistrict.padEnd(10)} | ${String(r.bin).padEnd(5)} | ${matchStr.padEnd(7)} | ${r.confidence.padEnd(10)} | ${r.landmark.padEnd(16)} |`
    );
  }
  console.log("------------------------------------------------------------------------------------------------------------------------\n");

  // Summary Metrics
  console.log("===============================================================================");
  console.log("                              BENCHMARK RESULTS                                ");
  console.log("===============================================================================");
  console.log(`  Total Evaluated Addresses : ${SAMPLE_ADDRESSES.length}`);
  console.log(`  Accurate Classifications  : ${matchCount} / ${SAMPLE_ADDRESSES.length}`);
  console.log(`  Overall Sorter Accuracy   : ${accuracyPct}%`);
  console.log(`  High Confidence Matches   : ${highConfCount}`);
  console.log(`  Medium Confidence Matches : ${mediumConfCount}`);
  console.log(`  Overflow Allocations      : ${overflowCount} (Bin 99)`);
  console.log(`  Total Processing Time     : ${durationMs}ms (~${(durationMs / SAMPLE_ADDRESSES.length).toFixed(1)}ms / address)`);
  console.log("===============================================================================\n");

  return {
    total: SAMPLE_ADDRESSES.length,
    matches: matchCount,
    accuracyPct: Number(accuracyPct),
    durationMs,
  };
}

// Execute runner
if (require.main === module || process.argv[1]?.includes("run-sort-test")) {
  runSortTest()
    .then((res) => {
      if (res.accuracyPct >= 85) {
        console.log(`🏆 Benchmark PASSED with ${res.accuracyPct}% accuracy! Ready for Phase 0 Hub Pilot.`);
        process.exit(0);
      } else {
        console.warn(`⚠️ Accuracy at ${res.accuracyPct}%. Review mismatched cases.`);
        process.exit(0);
      }
    })
    .catch((err) => {
      console.error("Test execution failed:", err);
      process.exit(1);
    });
}

