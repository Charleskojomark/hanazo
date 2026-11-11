"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Plus, Users, MapPin, RefreshCw } from "lucide-react";

interface HubItem {
  id: string;
  name: string;
  city: string;
  riderCount: number;
  createdAt: string;
}

export default function HubSelectionPage() {
  const [hubs, setHubs] = useState<HubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New hub modal state
  const [showModal, setShowModal] = useState(false);
  const [newHubName, setNewHubName] = useState("");
  const [newHubCity, setNewHubCity] = useState("Lagos");
  const [creating, setCreating] = useState(false);

  async function fetchHubs() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hubs");
      if (!res.ok) throw new Error("Failed to load hubs");
      const data = await res.json();
      setHubs(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error connecting to server");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHubs();
  }, []);

  async function handleCreateHub(e: React.FormEvent) {
    e.preventDefault();
    if (!newHubName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/hubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newHubName.trim(), city: newHubCity.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create hub");
      const created = await res.json();
      setHubs((prev) => [...prev, created]);
      setNewHubName("");
      setShowModal(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Could not create hub");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 w-full flex-1 flex flex-col justify-center">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white text-balance">
            Select Sorting Hub
          </h1>
          <p className="mt-1 text-sm text-neutral-400 text-pretty">
            Choose a courier station to start parcel scanning and bin allocation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchHubs()}
            aria-label="Refresh hubs list"
            className="inline-flex items-center justify-center size-9 rounded-md border border-neutral-800 bg-neutral-900 text-neutral-300 hover:text-white hover:border-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <RefreshCw className="size-4" />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          >
            <Plus className="size-4" />
            <span>New Hub</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-200">
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 rounded-lg border border-neutral-900 bg-neutral-900/40 animate-pulse p-5"
            />
          ))}
        </div>
      ) : hubs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-800 bg-neutral-900/20 p-12 text-center">
          <div className="size-12 rounded-full bg-neutral-900 flex items-center justify-center text-neutral-400 mb-4 border border-neutral-800">
            <Building2 className="size-6" />
          </div>
          <h2 className="text-lg font-bold text-white text-balance">
            No registered courier hubs yet
          </h2>
          <p className="mt-1 max-w-sm text-sm text-neutral-400 text-pretty">
            Set up your first warehouse or sorting centre to start assigning parcels to bins.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <Plus className="size-4" />
            <span>Register your first hub</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hubs.map((hub) => (
            <Link
              key={hub.id}
              href={`/hub/${hub.id}/sort`}
              className="group relative flex flex-col justify-between rounded-lg border border-neutral-800 bg-neutral-900/70 p-5 hover:border-amber-500/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-bold text-white text-base group-hover:text-amber-400 transition-colors line-clamp-1">
                    {hub.name}
                  </h2>
                  <ArrowRight className="size-4 text-neutral-500 group-hover:text-amber-400 transition-colors shrink-0 mt-1" />
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-400">
                  <MapPin className="size-3.5 text-neutral-500" />
                  <span>{hub.city}</span>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-neutral-800/80 pt-3 text-xs text-neutral-400">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-3.5 text-neutral-500" />
                  <span className="tabular-nums font-medium text-neutral-200">
                    {hub.riderCount}
                  </span>{" "}
                  active {hub.riderCount === 1 ? "rider" : "riders"}
                </span>
                <span className="text-[11px] font-semibold text-amber-500/90 group-hover:underline">
                  Launch Sorter →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Modal for creating a new hub */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg border border-neutral-800 bg-neutral-900 p-6 shadow-xl">
            <h2 className="text-lg font-bold text-white text-balance">
              Register New Courier Hub
            </h2>
            <p className="mt-1 text-xs text-neutral-400 text-pretty">
              Add a delivery sorting station to begin allocating dispatch bins.
            </p>

            <form onSubmit={handleCreateHub} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="hubName"
                  className="block text-xs font-medium text-neutral-300 mb-1"
                >
                  Hub Name
                </label>
                <input
                  id="hubName"
                  type="text"
                  required
                  placeholder="e.g. Ikeja Central Sorting Hub"
                  value={newHubName}
                  onChange={(e) => setNewHubName(e.target.value)}
                  className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label
                  htmlFor="hubCity"
                  className="block text-xs font-medium text-neutral-300 mb-1"
                >
                  City / State
                </label>
                <select
                  id="hubCity"
                  value={newHubCity}
                  onChange={(e) => setNewHubCity(e.target.value)}
                  className="w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="Lagos">Lagos</option>
                  <option value="Abuja">Abuja (FCT)</option>
                  <option value="Ibadan">Ibadan (Oyo)</option>
                  <option value="Port Harcourt">Port Harcourt (Rivers)</option>
                  <option value="Kano">Kano</option>
                  <option value="Enugu">Enugu</option>
                  <option value="Benin City">Benin City (Edo)</option>
                </select>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-md border border-neutral-800 px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newHubName.trim()}
                  className="rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-400 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  {creating ? "Creating..." : "Create Hub"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
