"use client";

import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { syncDistrictNodes, getQueuedOfflineParcels } from "@/lib/offline-store";

export function NetworkStatusIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [syncedNotice, setSyncedNotice] = useState<string | null>(null);

  async function checkQueue() {
    try {
      const queued = await getQueuedOfflineParcels();
      setQueuedCount(queued.length);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    setIsOnline(navigator.onLine);
    checkQueue();

    // Auto-sync reference data on initial load
    if (navigator.onLine) {
      syncDistrictNodes();
    }

    const handleOnline = async () => {
      setIsOnline(true);
      await checkQueue();
      setSyncedNotice("Network restored. Syncing pending scans...");
      setTimeout(() => setSyncedNotice(null), 4000);
    };

    const handleOffline = async () => {
      setIsOnline(false);
      await checkQueue();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Periodic queue check every 15 seconds
    const interval = setInterval(checkQueue, 15000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (syncedNotice) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-800 bg-emerald-950/90 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 animate-pulse">
        <RefreshCw className="size-3 animate-spin text-emerald-400" />
        <span>{syncedNotice}</span>
      </span>
    );
  }

  if (!isOnline) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-800 bg-amber-950/90 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
        <WifiOff className="size-3 text-amber-400" />
        <span>Offline Mode</span>
        {queuedCount > 0 && (
          <span className="rounded bg-amber-500/20 px-1 font-mono text-[10px] text-amber-300">
            {queuedCount} queued
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900/80 px-2.5 py-1 text-[11px] font-medium text-neutral-300">
      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
      <span>NDAPS Live</span>
    </span>
  );
}

