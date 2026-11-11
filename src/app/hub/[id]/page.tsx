"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Users,
  Barcode,
  Package,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Calendar,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HubStatsResponse {
  hub: {
    id: string;
    name: string;
    city: string;
    createdAt: string;
  };
  activeRidersCount: number;
  todayBatch: {
    id: string;
    hubId: string;
    batchDate: string;
    status: string;
    totalParcels: number;
    createdAt: string;
  } | null;
  stats: {
    totalParcelsToday: number;
    avgConfidencePct: number;
    unresolvedCount: number;
    activeBatchesCount: number;
  };
  dailyVolume: Array<{
    date: string;
    label: string;
    count: number;
  }>;
}

export default function HubDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: hubId } = use(params);

  const [data, setData] = useState<HubStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/hubs/${hubId}/stats`);
        if (!res.ok) throw new Error("Failed to load hub overview");
        const json = await res.json();
        setData(json);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error connecting to server");
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [hubId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 w-full animate-pulse space-y-6">
        <div className="h-10 w-64 bg-neutral-900 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-neutral-900 rounded-lg" />
          ))}
        </div>
        <div className="h-64 bg-neutral-900 rounded-lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-6 text-red-200">
          <p>{error || "Hub not found"}</p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center gap-2 rounded bg-neutral-900 px-4 py-2 text-xs text-white"
          >
            <ArrowLeft className="size-4" />
            <span>Return to Hubs</span>
          </Link>
        </div>
      </div>
    );
  }

  const { hub, activeRidersCount, todayBatch, stats, dailyVolume } = data;
  const maxVolume = Math.max(...dailyVolume.map((d) => d.count), 10);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 w-full flex-1">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
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
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                {hub.name}
              </h1>
            </div>
            <p className="text-xs text-neutral-400">
              {hub.city} Hub • Station Operations & Fleet Dispatch Control
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={`/hub/${hubId}/riders`}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-neutral-300 hover:text-white hover:border-neutral-700 transition-colors"
          >
            <Users className="size-3.5 text-amber-500" />
            <span>Manage Riders ({activeRidersCount})</span>
          </Link>

          {todayBatch && (
            <Link
              href={`/hub/${hubId}/batch/${todayBatch.id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-neutral-300 hover:text-white hover:border-neutral-700 transition-colors"
            >
              <Layers className="size-3.5 text-neutral-400" />
              <span>View Today&apos;s Batches</span>
            </Link>
          )}

          <Link
            href={`/hub/${hubId}/sort`}
            className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <Barcode className="size-4" />
            <span>Start Sorting →</span>
          </Link>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-semibold uppercase tracking-wider">Parcels Today</span>
            <Package className="size-4 text-neutral-500" />
          </div>
          <div className="mt-2 text-3xl font-black text-white tabular-nums">
            {stats.totalParcelsToday}
          </div>
          <p className="mt-1 text-[11px] text-neutral-500">
            Waybills clustered across bins
          </p>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-semibold uppercase tracking-wider">Avg. Confidence</span>
            <CheckCircle2 className="size-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-3xl font-black text-emerald-400 tabular-nums">
            {stats.avgConfidencePct}%
          </div>
          <p className="mt-1 text-[11px] text-neutral-500">
            Direct district & alias matches
          </p>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-semibold uppercase tracking-wider">Unresolved Count</span>
            <AlertTriangle className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-3xl font-black text-amber-500 tabular-nums">
            {stats.unresolvedCount}
          </div>
          <p className="mt-1 text-[11px] text-neutral-500">
            In overflow bin awaiting review
          </p>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-semibold uppercase tracking-wider">Active Fleet</span>
            <Users className="size-4 text-neutral-500" />
          </div>
          <div className="mt-2 text-3xl font-black text-white tabular-nums">
            {activeRidersCount}
          </div>
          <p className="mt-1 text-[11px] text-neutral-500">
            Assigned riders across bins
          </p>
        </div>
      </div>

      {/* 2-Column Section: Active Batch Summary & 7-Day Mini Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Today's Batch Summary Card */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="size-4 text-amber-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  Today&apos;s Active Batch
                </h2>
              </div>
              <span className="inline-flex items-center rounded-full bg-emerald-950/80 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-800">
                {todayBatch ? todayBatch.status.toUpperCase() : "READY"}
              </span>
            </div>

            {todayBatch ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-neutral-500 block">Batch Reference</span>
                    <strong className="font-mono text-sm text-neutral-200">
                      #{todayBatch.id.slice(0, 8)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Date</span>
                    <strong className="text-sm text-neutral-200">
                      {todayBatch.batchDate}
                    </strong>
                  </div>
                </div>

                <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-neutral-400">Total Binned:</span>
                    <span className="tabular-nums font-bold text-white">
                      {stats.totalParcelsToday} parcels
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400">Unresolved / Overflow:</span>
                    <span className="tabular-nums font-bold text-amber-400">
                      {stats.unresolvedCount} parcels
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-neutral-500">
                No active sorting batch created today yet. Scan a waybill on the sorter
                screen to automatically initialize today&apos;s batch.
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-neutral-800 flex items-center justify-between">
            <span className="text-xs text-neutral-400">
              Ready to process morning packages?
            </span>
            <Link
              href={`/hub/${hubId}/sort`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
            >
              <span>Open Sorter Screen</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>

        {/* Last 7 Days Mini Chart */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-amber-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  7-Day Sorting Volume
                </h2>
              </div>
              <span className="text-xs text-neutral-400">Daily Parcels</span>
            </div>

            {/* Pure SVG / CSS Bar Chart */}
            <div className="mt-6 flex items-end justify-between gap-3 h-44 pt-4 px-2">
              {dailyVolume.map((item, idx) => {
                const heightPct = Math.max(
                  Math.round((item.count / maxVolume) * 100),
                  6
                );
                const isToday = idx === dailyVolume.length - 1;

                return (
                  <div
                    key={item.date}
                    className="flex-1 flex flex-col items-center gap-2 group h-full justify-end"
                  >
                    <span className="text-[10px] font-mono tabular-nums text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.count}
                    </span>
                    <div className="w-full flex justify-center items-end h-32">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={cn(
                          "w-full max-w-[36px] rounded-t transition-all",
                          isToday
                            ? "bg-amber-500 hover:bg-amber-400"
                            : "bg-neutral-800 hover:bg-neutral-700"
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-[11px] font-medium",
                        isToday ? "text-amber-400 font-bold" : "text-neutral-500"
                      )}
                    >
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-neutral-800 text-[11px] text-neutral-500 flex items-center justify-between">
            <span>Hover bars to inspect parcel volume</span>
            <span className="text-amber-500/90 font-medium">NIPOST Live Sync</span>
          </div>
        </div>
      </div>
    </div>
  );
}

