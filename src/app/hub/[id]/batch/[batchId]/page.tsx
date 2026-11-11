"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Package,
  Save,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ParcelItem {
  id: string;
  rawAddress: string;
  extractedLandmark: string | null;
  resolvedDistrictCode: string | null;
  assignedBin: number | null;
  riderId: string | null;
  status: string;
}

interface BinGroup {
  bin: number;
  riderId: string;
  riderName: string;
  riderPhone?: string;
  count: number;
  parcels: ParcelItem[];
}

interface BatchData {
  batch: {
    id: string;
    hubId: string;
    batchDate: string;
    status: string;
    totalParcels: number;
  };
  hub: {
    id: string;
    name: string;
    city: string;
  } | null;
  totalParcels: number;
  bins: BinGroup[];
}

export default function BatchResultsPage({
  params,
}: {
  params: Promise<{ id: string; batchId: string }>;
}) {
  const { id: hubId, batchId } = use(params);

  const [batchData, setBatchData] = useState<BatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Manual bin reassignment inputs: map of parcelId -> bin string
  const [manualBins, setManualBins] = useState<Record<string, string>>({});
  const [savingParcelId, setSavingParcelId] = useState<string | null>(null);
  const [savedSuccessId, setSavedSuccessId] = useState<string | null>(null);

  async function fetchBatch() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/batch/${batchId}`);
      if (!res.ok) throw new Error("Failed to load batch data");
      const data: BatchData = await res.json();
      setBatchData(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching batch details");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBatch();
  }, [batchId]);

  async function handleSaveManualBin(parcelId: string) {
    const rawVal = manualBins[parcelId];
    const binNum = parseInt(rawVal, 10);
    if (isNaN(binNum) || binNum < 1) return;

    setSavingParcelId(parcelId);
    try {
      const res = await fetch(`/api/parcels/${parcelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedBin: binNum, status: "sorted" }),
      });

      if (!res.ok) throw new Error("Failed to update parcel bin");

      setSavedSuccessId(parcelId);
      setTimeout(() => setSavedSuccessId(null), 2000);
      // Refresh batch data to show parcel in newly assigned bin
      await fetchBatch();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error saving bin");
    } finally {
      setSavingParcelId(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 w-full animate-pulse space-y-6">
        <div className="h-8 w-48 bg-neutral-900 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-24 bg-neutral-900 rounded-lg" />
          <div className="h-24 bg-neutral-900 rounded-lg" />
          <div className="h-24 bg-neutral-900 rounded-lg" />
        </div>
        <div className="h-96 bg-neutral-900 rounded-lg" />
      </div>
    );
  }

  if (error || !batchData) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-8 text-red-200">
          <p className="font-semibold">{error || "Batch not found"}</p>
          <Link
            href={`/hub/${hubId}/sort`}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800"
          >
            <ArrowLeft className="size-4" />
            <span>Return to Sorter</span>
          </Link>
        </div>
      </div>
    );
  }

  // Calculate high-level summary counts
  const totalParcels = batchData.totalParcels;
  const overflowGroup = batchData.bins.find((g) => g.bin === 99);
  const unresolvedCount = overflowGroup ? overflowGroup.count : 0;
  const sortedCount = totalParcels - unresolvedCount;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 w-full flex-1">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Link
            href={`/hub/${hubId}/sort`}
            aria-label="Back to Sorter"
            className="inline-flex size-9 items-center justify-center rounded-md border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white hover:border-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Batch Sort Summary
            </h1>
            <p className="text-xs text-neutral-400 font-mono">
              Batch #{batchData.batch.id.slice(0, 8)} • Date: {batchData.batch.batchDate} •{" "}
              {batchData.hub?.name || "Hub"}
            </p>
          </div>
        </div>

        <Link
          href={`/hub/${hubId}/sort`}
          className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <span>Continue Scanning →</span>
        </Link>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-5">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-semibold uppercase tracking-wider">Total Waybills</span>
            <Package className="size-4 text-neutral-500" />
          </div>
          <div className="mt-2 text-3xl font-black text-white tabular-nums">
            {totalParcels}
          </div>
          <p className="mt-1 text-[11px] text-neutral-500">Processed in this batch</p>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-5">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-semibold uppercase tracking-wider">Successfully Binned</span>
            <CheckCircle2 className="size-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-3xl font-black text-emerald-400 tabular-nums">
            {sortedCount}
          </div>
          <p className="mt-1 text-[11px] text-neutral-500">
            Assigned to delivery riders
          </p>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/70 p-5">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-semibold uppercase tracking-wider">Overflow / Review</span>
            <AlertTriangle className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-3xl font-black text-amber-500 tabular-nums">
            {unresolvedCount}
          </div>
          <p className="mt-1 text-[11px] text-neutral-500">
            Needs manual supervisor review
          </p>
        </div>
      </div>

      {/* Parcels Grouped by Bin */}
      <div className="space-y-6">
        {batchData.bins.map((group) => {
          const isOverflow = group.bin === 99;
          return (
            <div
              key={group.bin}
              className={cn(
                "rounded-xl border bg-neutral-900/50 overflow-hidden",
                isOverflow ? "border-amber-900/60" : "border-neutral-800"
              )}
            >
              {/* Bin Header */}
              <div
                className={cn(
                  "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b",
                  isOverflow
                    ? "border-amber-900/60 bg-amber-950/20"
                    : "border-neutral-800 bg-neutral-900/90"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-lg font-black text-lg tabular-nums",
                      isOverflow
                        ? "bg-amber-500 text-black"
                        : "bg-neutral-800 text-white border border-neutral-700"
                    )}
                  >
                    {group.bin}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-base">
                        {isOverflow ? "Overflow / Unassigned Bin" : `Bin ${group.bin}`}
                      </span>
                      <span className="text-xs text-neutral-400">• {group.riderName}</span>
                    </div>
                    <p className="text-xs text-neutral-500">
                      <span className="tabular-nums font-semibold text-neutral-300">
                        {group.count}
                      </span>{" "}
                      parcels in this container
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href={`/hub/${hubId}/manifest/${batchId}/${group.bin}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    <Printer className="size-3.5 text-amber-500" />
                    <span>Print Manifest</span>
                  </Link>
                </div>
              </div>

              {/* Parcels Table / List */}
              <div className="divide-y divide-neutral-800/60">
                {group.parcels.map((parcel, idx) => (
                  <div
                    key={parcel.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-3.5 hover:bg-neutral-900/40 transition-colors text-xs"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="text-neutral-500 font-mono tabular-nums shrink-0 mt-0.5">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white truncate">
                          {parcel.rawAddress}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
                          {parcel.resolvedDistrictCode && (
                            <span className="font-mono text-amber-400 font-medium">
                              [{parcel.resolvedDistrictCode}]
                            </span>
                          )}
                          {parcel.extractedLandmark && (
                            <span className="text-neutral-400">
                              Landmark:{" "}
                              <strong className="text-neutral-200 font-semibold capitalize">
                                {parcel.extractedLandmark}
                              </strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Inline Manual Bin Input for Unresolved / Overflow Parcels */}
                    {isOverflow && (
                      <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-800/60">
                        <span className="text-[11px] text-neutral-400">Assign Bin:</span>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          placeholder="Bin #"
                          value={manualBins[parcel.id] ?? ""}
                          onChange={(e) =>
                            setManualBins((prev) => ({
                              ...prev,
                              [parcel.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleSaveManualBin(parcel.id);
                            }
                          }}
                          className="w-16 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveManualBin(parcel.id)}
                          disabled={
                            savingParcelId === parcel.id || !manualBins[parcel.id]
                          }
                          className="inline-flex size-7 items-center justify-center rounded bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-40 transition-colors"
                          aria-label="Save bin assignment"
                        >
                          {savedSuccessId === parcel.id ? (
                            <Check className="size-3.5 text-black" />
                          ) : (
                            <Save className="size-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

