"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  WifiOff,
  Layers,
  History,
  Barcode,
  UploadCloud,
  X,
  Building2,
} from "lucide-react";
import { playSuccessBeep, playAlertBeep } from "@/lib/audio";
import { cn } from "@/lib/utils";
import {
  resolveDistrictOffline,
  queueOfflineParcel,
  syncOfflineQueueToServer,
  syncDistrictNodes,
  cacheHubRiders,
} from "@/lib/offline-store";

interface SortResponse {
  parcelId?: string;
  batchId?: string;
  bin: number;
  riderId: string;
  riderName: string;
  districtCode: string;
  districtName: string;
  confidence: "high" | "medium" | "low" | "unresolved";
  extractedLandmark: string | null;
  isOverflow: boolean;
}

interface ScanHistoryItem extends SortResponse {
  rawAddress: string;
  timestamp: Date;
}

interface HubInfo {
  id: string;
  name: string;
  city: string;
}

interface CachedDistrictNode {
  code: string;
  state: string;
  lga: string;
  district: string;
  displayName: string;
  aliases: string[];
}

export default function SorterDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: hubId } = use(params);
  const router = useRouter();

  const [hub, setHub] = useState<HubInfo | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<SortResponse | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [binCounts, setBinCounts] = useState<Record<number, number>>({});
  const [isOffline, setIsOffline] = useState(false);
  const [cachedNodes, setCachedNodes] = useState<CachedDistrictNode[]>([]);

  // Batch paste modal
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchAddressesText, setBatchAddressesText] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input automatically on mount and whenever a scan finishes
  useEffect(() => {
    inputRef.current?.focus();
  }, [currentResult, loading]);

  // Monitor network connectivity status and auto-sync offline queue
  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const handleOnline = async () => {
      setIsOffline(false);
      try {
        const syncRes = await syncOfflineQueueToServer(hubId);
        if (syncRes.syncedCount > 0) {
          playSuccessBeep();
        }
      } catch (err) {
        console.warn("[Hanazo Sort] Auto-sync error:", err);
      }
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [hubId]);

  // Fetch hub details, preload district nodes, and cache riders in IndexedDB for offline fallback
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [hubsRes, nodesRes, ridersRes] = await Promise.all([
          fetch("/api/hubs"),
          fetch("/api/districts"),
          fetch(`/api/hubs/${hubId}/riders`),
        ]);

        if (hubsRes.ok) {
          const hubsData: HubInfo[] = await hubsRes.json();
          const current = hubsData.find((h) => h.id === hubId);
          if (current) setHub(current);
        }

        if (nodesRes.ok) {
          const nodesData = await nodesRes.json();
          setCachedNodes(nodesData);
          syncDistrictNodes();
        }

        if (ridersRes.ok) {
          const ridersData = await ridersRes.json();
          cacheHubRiders(hubId, ridersData);
        }
      } catch {
        // IndexedDB cache serves as the transparent fallback
      }
    }

    loadInitialData();
  }, [hubId]);

  // Handle single barcode / address scan
  async function handleScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = addressInput.trim();
    if (!raw || loading) return;

    setLoading(true);
    setAddressInput("");

    try {
      let result: SortResponse;

      if (isOffline) {
        // Resolve using local IndexedDB postal reference
        const offRes = await resolveDistrictOffline(raw, hubId);
        result = {
          bin: offRes.bin,
          riderId: offRes.riderId,
          riderName: offRes.riderName,
          districtCode: offRes.districtCode || "",
          districtName: offRes.districtName || "",
          confidence: offRes.confidence,
          extractedLandmark: offRes.extractedLandmark,
          isOverflow: offRes.isOverflow,
        };

        // Queue offline parcel for automatic sync when online
        await queueOfflineParcel({
          rawAddress: raw,
          hubId,
          bin: offRes.bin,
          riderId: offRes.riderId,
          riderName: offRes.riderName,
          districtCode: offRes.districtCode,
          districtName: offRes.districtName,
          confidence: offRes.confidence,
          extractedLandmark: offRes.extractedLandmark,
        });
      } else {
        const res = await fetch("/api/sort", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawAddress: raw, hubId }),
        });

        if (!res.ok) {
          throw new Error("Sort API returned error status");
        }
        result = await res.json();
      }

      // Audio feedback
      if (result.isOverflow || result.confidence === "unresolved") {
        playAlertBeep();
      } else {
        playSuccessBeep();
      }

      setCurrentResult(result);

      // Update session statistics
      setBinCounts((prev) => ({
        ...prev,
        [result.bin]: (prev[result.bin] || 0) + 1,
      }));

      // Update scan history
      setHistory((prev) => [
        { ...result, rawAddress: raw, timestamp: new Date() },
        ...prev.slice(0, 9),
      ]);
    } catch {
      // In case of unexpected network failure mid-scan, seamlessly trigger offline resolver & queue
      setIsOffline(true);
      const offRes = await resolveDistrictOffline(raw, hubId);
      const fallbackResult: SortResponse = {
        bin: offRes.bin,
        riderId: offRes.riderId,
        riderName: offRes.riderName,
        districtCode: offRes.districtCode || "",
        districtName: offRes.districtName || "",
        confidence: offRes.confidence,
        extractedLandmark: offRes.extractedLandmark,
        isOverflow: offRes.isOverflow,
      };

      await queueOfflineParcel({
        rawAddress: raw,
        hubId,
        bin: offRes.bin,
        riderId: offRes.riderId,
        riderName: offRes.riderName,
        districtCode: offRes.districtCode,
        districtName: offRes.districtName,
        confidence: offRes.confidence,
        extractedLandmark: offRes.extractedLandmark,
      });

      playAlertBeep();
      setCurrentResult(fallbackResult);
      setBinCounts((prev) => ({
        ...prev,
        [fallbackResult.bin]: (prev[fallbackResult.bin] || 0) + 1,
      }));
    } finally {
      setLoading(false);
      // Ensure keyboard focus stays locked on the input
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  // Handle bulk batch submission
  async function handleBatchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const lines = batchAddressesText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;

    setBatchLoading(true);
    setBatchError(null);

    try {
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: lines, hubId }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Batch processing failed");
      }

      const data = await res.json();
      playSuccessBeep();
      router.push(`/hub/${hubId}/batch/${data.batchId}`);
    } catch (err: unknown) {
      setBatchError(err instanceof Error ? err.message : "Error processing batch");
      setBatchLoading(false);
    }
  }

  const totalScanned = Object.values(binCounts).reduce((a, b) => a + b, 0);
  const sortedBins = Object.keys(binCounts)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="flex-1 flex flex-col mx-auto max-w-7xl px-4 py-6 sm:px-6 w-full">
      {/* Offline Mode Indicator Banner */}
      {isOffline && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-amber-900/60 bg-amber-950/40 px-4 py-2.5 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <WifiOff className="size-4 text-amber-400 shrink-0" />
            <span className="font-semibold">Offline Mode Active</span>
            <span className="text-amber-300/80">
              — Sorting locally via in-browser cached NDAPS district nodes.
            </span>
          </div>
          <span className="text-[11px] font-mono text-amber-400">
            {cachedNodes.length} districts loaded
          </span>
        </div>
      )}

      {/* Top Station Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Back to Hubs"
            className="inline-flex size-9 items-center justify-center rounded-md border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white hover:border-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-amber-500" />
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {hub ? hub.name : "Sorting Station"}
              </h1>
            </div>
            <p className="text-xs text-neutral-400">
              {hub ? `${hub.city} Hub` : "Warehouse Sorter"} • High-Speed Pre-Dispatch Line
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBatchModal(true)}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-neutral-200 hover:border-neutral-700 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <UploadCloud className="size-4 text-amber-500" />
            <span>Batch Paste (50+)</span>
          </button>
        </div>
      </div>

      {/* Barcode Scanner / Text Input Bar */}
      <form onSubmit={handleScanSubmit} className="relative mb-6">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-neutral-500">
            <Barcode className="size-6 text-amber-500" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            disabled={loading}
            placeholder="Scan barcode or paste delivery address (Press Enter to allocate bin)..."
            className="w-full rounded-xl border-2 border-neutral-800 bg-neutral-950 py-4.5 pl-14 pr-28 text-base sm:text-lg text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50"
          />
          <div className="absolute inset-y-0 right-2 flex items-center">
            <button
              type="submit"
              disabled={loading || !addressInput.trim()}
              className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              {loading ? "Sorting..." : "ENTER"}
            </button>
          </div>
        </div>
      </form>

      {/* CORE DISPLAY: MASSIVE BIN CARD */}
      <div className="flex-1 flex flex-col justify-center">
        {currentResult ? (
          <div
            className={cn(
              "relative flex flex-col items-center justify-center rounded-2xl border-2 p-8 sm:p-12 text-center transition-colors shadow-2xl",
              currentResult.isOverflow
                ? "border-amber-600/40 bg-neutral-950"
                : "border-neutral-800 bg-neutral-950"
            )}
          >
            {/* Confidence Badge */}
            <div className="mb-4">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-bold tracking-wide uppercase",
                  currentResult.confidence === "high"
                    ? "border-emerald-800 bg-emerald-950/70 text-emerald-400"
                    : currentResult.confidence === "medium"
                    ? "border-amber-800 bg-amber-950/70 text-amber-400"
                    : "border-rose-800 bg-rose-950/70 text-rose-400"
                )}
              >
                {currentResult.confidence === "high" ? (
                  <CheckCircle2 className="size-3.5" />
                ) : (
                  <AlertTriangle className="size-3.5" />
                )}
                {currentResult.isOverflow
                  ? "Overflow Bin"
                  : `${currentResult.confidence} Confidence`}
              </span>
            </div>

            {/* Huge Bin Number */}
            <div className="flex flex-col items-center justify-center">
              <span className="text-xs uppercase tracking-widest font-bold text-neutral-400 mb-1">
                DISPATCH BIN
              </span>
              <div
                className={cn(
                  "text-8xl sm:text-9xl md:text-[13rem] font-black leading-none tabular-nums tracking-tighter select-all",
                  currentResult.isOverflow ? "text-amber-500" : "text-white"
                )}
              >
                {currentResult.bin}
              </div>
            </div>

            {/* Rider & District Details */}
            <div className="mt-6 max-w-xl">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white text-balance">
                {currentResult.riderName}
              </h2>
              <p className="mt-1 text-base sm:text-lg text-neutral-400 text-pretty font-medium">
                {currentResult.districtName}
                {currentResult.districtCode && (
                  <span className="ml-2 font-mono text-xs text-amber-500/90 font-semibold">
                    [{currentResult.districtCode}]
                  </span>
                )}
              </p>

              {currentResult.extractedLandmark && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900/90 px-3 py-1 text-xs text-neutral-300">
                  <span className="text-amber-500 font-semibold">Landmark:</span>
                  <span className="capitalize">{currentResult.extractedLandmark}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-900 bg-neutral-950/60 p-12 text-center py-20">
            <div className="size-16 rounded-full bg-neutral-900 flex items-center justify-center text-amber-500 mb-4 border border-neutral-800">
              <Barcode className="size-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white text-balance">
              Scan Barcode or Paste Waybill
            </h2>
            <p className="mt-2 max-w-md text-sm text-neutral-400 text-pretty">
              Focus is locked to the scanner. Scan a parcel label or press ENTER to automatically
              calculate the NIPOST district and show the sorting bin.
            </p>
          </div>
        )}
      </div>

      {/* Running Session Stats Bar */}
      <div className="mt-8 rounded-xl border border-neutral-800 bg-neutral-900/80 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-800/80 pb-4">
          <div className="flex items-center gap-3">
            <Layers className="size-4 text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Today&apos;s Shift Metrics
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-400">Total Scanned:</span>
            <span className="tabular-nums font-black text-amber-400 text-sm">
              {totalScanned}
            </span>
          </div>
        </div>

        {/* Parcels per bin badges */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {sortedBins.length === 0 ? (
            <p className="text-xs text-neutral-500 italic">
              No parcels processed in this shift yet.
            </p>
          ) : (
            sortedBins.map((bin) => (
              <div
                key={bin}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold",
                  bin === 99
                    ? "border-amber-900/80 bg-amber-950/30 text-amber-300"
                    : "border-neutral-800 bg-neutral-950 text-neutral-200"
                )}
              >
                <span>{bin === 99 ? "Overflow" : `Bin ${bin}`}:</span>
                <span className="tabular-nums font-black text-white">
                  {binCounts[bin]}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Recent Scan History */}
        {history.length > 0 && (
          <div className="mt-5 border-t border-neutral-800/80 pt-4">
            <div className="flex items-center gap-2 mb-3 text-xs font-medium text-neutral-400">
              <History className="size-3.5" />
              <span>Recent Scans</span>
            </div>
            <div className="space-y-1.5">
              {history.slice(0, 4).map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs py-1 px-2 rounded bg-neutral-950/50 text-neutral-300"
                >
                  <span className="truncate max-w-[60%] font-mono text-[11px] text-neutral-400">
                    {item.rawAddress}
                  </span>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="text-neutral-400 truncate max-w-[120px]">
                      {item.districtName}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 font-bold tabular-nums",
                        item.bin === 99
                          ? "bg-amber-950 text-amber-400 border border-amber-900"
                          : "bg-neutral-800 text-white"
                      )}
                    >
                      Bin {item.bin}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Batch Paste Drawer / Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl flex flex-col max-h-[90dvh]">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-white text-balance">
                  Bulk Batch Parcel Sorting
                </h2>
                <p className="mt-1 text-xs text-neutral-400 text-pretty">
                  Paste up to 200 raw addresses from manifests, WhatsApp, or Excel (one address per line).
                </p>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                aria-label="Close modal"
                className="size-8 rounded-md border border-neutral-800 bg-neutral-950 flex items-center justify-center text-neutral-400 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            {batchError && (
              <div className="mt-4 rounded-md border border-rose-900 bg-rose-950/40 p-3 text-xs text-rose-300">
                {batchError}
              </div>
            )}

            <form onSubmit={handleBatchSubmit} className="mt-4 flex-1 flex flex-col">
              <textarea
                value={batchAddressesText}
                onChange={(e) => setBatchAddressesText(e.target.value)}
                placeholder={`No 14 Admiralty Way, Lekki Phase 1, Lagos\nPlot 10 Allen Avenue, beside Ikeja Bus Stop, Ikeja\nArea 11, Garki, Abuja opposite Federal High Court\n...`}
                rows={12}
                disabled={batchLoading}
                className="w-full flex-1 rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-xs font-mono text-white placeholder-neutral-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
              />

              <div className="mt-4 flex items-center justify-between text-xs text-neutral-400">
                <span className="tabular-nums">
                  {
                    batchAddressesText
                      .split("\n")
                      .filter((l) => l.trim().length > 0).length
                  }{" "}
                  addresses detected
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowBatchModal(false)}
                    className="rounded-md border border-neutral-800 px-4 py-2 font-medium hover:bg-neutral-800 text-neutral-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      batchLoading ||
                      batchAddressesText
                        .split("\n")
                        .filter((l) => l.trim().length > 0).length === 0
                    }
                    className="rounded-md bg-amber-500 px-5 py-2 font-bold text-black hover:bg-amber-400 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    {batchLoading ? "Processing Batch..." : "Run Batch Sort →"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

