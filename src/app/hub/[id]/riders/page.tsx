"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Users,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RiderItem {
  id: string;
  hubId: string;
  name: string;
  phone: string;
  assignedBin: number;
  assignedDistricts: string[];
  active: boolean;
}

interface HubItem {
  id: string;
  name: string;
  city: string;
}

interface DistrictNodeItem {
  code: string;
  state: string;
  lga: string;
  district: string;
  displayName: string;
  aliases: string[];
}

export default function RiderManagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: hubId } = use(params);

  const [hub, setHub] = useState<HubItem | null>(null);
  const [riders, setRiders] = useState<RiderItem[]>([]);
  const [districts, setDistricts] = useState<DistrictNodeItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add / Edit Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingRider, setEditingRider] = useState<RiderItem | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [assignedBin, setAssignedBin] = useState(1);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [districtFilter, setDistrictFilter] = useState("");

  // Deletion state
  const [deleteCandidate, setDeleteCandidate] = useState<RiderItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [hubsRes, ridersRes, distRes] = await Promise.all([
        fetch("/api/hubs"),
        fetch(`/api/hubs/${hubId}/riders`),
        fetch("/api/district-nodes"),
      ]);

      if (hubsRes.ok) {
        const hubsData: HubItem[] = await hubsRes.json();
        const current = hubsData.find((h) => h.id === hubId);
        if (current) setHub(current);
      }

      if (ridersRes.ok) {
        const ridersData = await ridersRes.json();
        setRiders(ridersData);
      }

      if (distRes.ok) {
        const distData = await distRes.json();
        setDistricts(distData);
      }
    } catch (err) {
      console.error("Error loading rider management data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [hubId]);

  function openAddModal() {
    setEditingRider(null);
    setName("");
    setPhone("");
    // Default to the next unused bin between 1 and 10
    const usedBins = new Set(riders.map((r) => r.assignedBin));
    let nextBin = 1;
    while (usedBins.has(nextBin) && nextBin <= 10) nextBin++;
    setAssignedBin(nextBin > 10 ? 1 : nextBin);
    setSelectedDistricts([]);
    setShowModal(true);
  }

  function openEditModal(rider: RiderItem) {
    setEditingRider(rider);
    setName(rider.name);
    setPhone(rider.phone);
    setAssignedBin(rider.assignedBin);
    setSelectedDistricts(rider.assignedDistricts);
    setShowModal(true);
  }

  function toggleDistrict(code: string) {
    setSelectedDistricts((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  async function handleSaveRider(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;

    setSaving(true);
    try {
      const payload = {
        id: editingRider?.id,
        name: name.trim(),
        phone: phone.trim(),
        assignedBin,
        assignedDistricts: selectedDistricts,
        active: true,
      };

      const res = await fetch(`/api/hubs/${hubId}/riders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save rider");

      setShowModal(false);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error saving rider");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteCandidate) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/hubs/${hubId}/riders?riderId=${deleteCandidate.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete rider");
      setDeleteCandidate(null);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error deleting rider");
    } finally {
      setDeleting(false);
    }
  }

  // Filter districts relevant to this city (or show all if city not matching LA/FC)
  const isLagos = hub?.city.toLowerCase().includes("lagos");
  const isAbuja =
    hub?.city.toLowerCase().includes("abuja") ||
    hub?.city.toLowerCase().includes("fct");

  const relevantDistricts = districts.filter((d) => {
    if (isLagos) return d.state === "LA";
    if (isAbuja) return d.state === "FC";
    return true;
  });

  // Calculate district coverage map
  const coveredDistrictsMap = new Map<string, RiderItem>();
  for (const rider of riders) {
    if (rider.active) {
      for (const dCode of rider.assignedDistricts) {
        coveredDistrictsMap.set(dCode.toUpperCase(), rider);
      }
    }
  }

  const totalDistrictsCount = relevantDistricts.length;
  let coveredCount = 0;
  for (const d of relevantDistricts) {
    if (coveredDistrictsMap.has(d.code.toUpperCase())) {
      coveredCount++;
    }
  }
  const coveragePercent =
    totalDistrictsCount > 0
      ? Math.round((coveredCount / totalDistrictsCount) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 w-full flex-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Link
            href={`/hub/${hubId}`}
            aria-label="Back to Hub Dashboard"
            className="inline-flex size-9 items-center justify-center rounded-md border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white hover:border-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-amber-500" />
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                {hub ? hub.name : "Hub"} • Rider Fleet
              </h1>
            </div>
            <p className="text-xs text-neutral-400">
              Manage delivery riders, assign physical sort bins, and configure district routes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/hub/${hubId}/sort`}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-neutral-300 hover:text-white hover:border-neutral-700 transition-colors"
          >
            <span>Open Sorter Screen →</span>
          </Link>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <Plus className="size-4" />
            <span>Add Rider</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Riders List + Visual District Coverage Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Riders List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">
              Active Dispatch Riders ({riders.length})
            </h2>
            <span className="text-xs text-neutral-500">
              Bins 1 through 10 assigned to riders
            </span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-lg border border-neutral-900 bg-neutral-900/40 animate-pulse"
                />
              ))}
            </div>
          ) : riders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/30 p-8 text-center">
              <Users className="mx-auto size-10 text-neutral-600 mb-3" />
              <h3 className="text-base font-bold text-white">No riders registered yet</h3>
              <p className="mt-1 text-xs text-neutral-400 max-w-sm mx-auto">
                Add dispatch riders and assign them physical bin numbers to start sorting parcels.
              </p>
              <button
                onClick={openAddModal}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400 transition-colors"
              >
                <Plus className="size-4" />
                <span>Add First Rider</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {riders.map((rider) => (
                <div
                  key={rider.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-900/70 p-5 hover:border-neutral-700 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="flex size-11 items-center justify-center rounded-lg bg-neutral-800 border border-neutral-700 font-black text-lg text-white tabular-nums shrink-0">
                      {rider.assignedBin}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-base">
                          {rider.name}
                        </h3>
                        <span className="text-xs font-mono text-neutral-400">
                          {rider.phone}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {rider.assignedDistricts.length === 0 ? (
                          <span className="text-[11px] text-amber-500 font-medium">
                            ⚠️ No districts assigned
                          </span>
                        ) : (
                          rider.assignedDistricts.map((dCode) => (
                            <span
                              key={dCode}
                              className="rounded border border-neutral-800 bg-neutral-950 px-2 py-0.5 font-mono text-[11px] font-semibold text-neutral-300"
                            >
                              {dCode}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-neutral-800 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => openEditModal(rider)}
                      aria-label={`Edit ${rider.name}`}
                      className="inline-flex size-8 items-center justify-center rounded border border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white hover:border-neutral-700 transition-colors"
                    >
                      <Edit2 className="size-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteCandidate(rider)}
                      aria-label={`Delete ${rider.name}`}
                      className="inline-flex size-8 items-center justify-center rounded border border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-rose-400 hover:border-rose-900 transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Visual District Coverage Map */}
        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                  District Coverage
                </h2>
                <p className="text-[11px] text-neutral-400">
                  {hub?.city} Postal Resolution Zones
                </p>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-amber-500 tabular-nums">
                  {coveragePercent}%
                </span>
                <span className="block text-[10px] text-neutral-500 tabular-nums">
                  {coveredCount} of {totalDistrictsCount} zones
                </span>
              </div>
            </div>

            {/* Coverage Legend */}
            <div className="flex items-center gap-4 py-3 text-[11px] text-neutral-400 border-b border-neutral-800/60">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" />
                Covered by Rider
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500" />
                Uncovered Zone
              </span>
            </div>

            {/* Districts List Grid */}
            <div className="mt-4 max-h-[500px] overflow-y-auto space-y-2 pr-1">
              {relevantDistricts.map((d) => {
                const assignedRider = coveredDistrictsMap.get(d.code.toUpperCase());
                const isCovered = Boolean(assignedRider);

                return (
                  <div
                    key={d.code}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-2.5 text-xs transition-colors",
                      isCovered
                        ? "border-neutral-800/80 bg-neutral-950/60 text-neutral-300"
                        : "border-amber-900/60 bg-amber-950/20 text-amber-300"
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[11px]">
                          {d.code}
                        </span>
                        <span className="font-medium text-white truncate max-w-[130px]">
                          {d.displayName}
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-500">
                        {d.lga} LGA
                      </span>
                    </div>

                    <div className="shrink-0 text-right">
                      {isCovered ? (
                        <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                          <CheckCircle2 className="size-3" />
                          <span>Bin {assignedRider?.assignedBin}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px] text-amber-500 font-semibold">
                          <AlertCircle className="size-3" />
                          <span>Unassigned</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Rider Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl max-h-[90dvh] flex flex-col">
            <div className="flex items-start justify-between border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  {editingRider ? "Edit Dispatch Rider" : "Add New Dispatch Rider"}
                </h3>
                <p className="text-xs text-neutral-400">
                  Assign bin number and delivery districts for automatic routing.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                aria-label="Close modal"
                className="size-8 rounded border border-neutral-800 bg-neutral-950 flex items-center justify-center text-neutral-400 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRider} className="mt-4 space-y-4 flex-1 flex flex-col min-h-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Rider Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Babatunde Alao"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+234 803 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  Physical Sort Bin (1–10)
                </label>
                <select
                  value={assignedBin}
                  onChange={(e) => setAssignedBin(Number(e.target.value))}
                  className="w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((b) => (
                    <option key={b} value={b}>
                      Bin {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* District Multi-Select */}
              <div className="flex-1 flex flex-col min-h-0 pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-neutral-300">
                    Assigned Districts ({selectedDistricts.length} selected)
                  </label>
                  <input
                    type="text"
                    placeholder="Search districts..."
                    value={districtFilter}
                    onChange={(e) => setDistrictFilter(e.target.value)}
                    className="w-40 rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-[11px] text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="flex-1 overflow-y-auto rounded border border-neutral-800 bg-neutral-950 p-2 space-y-1 max-h-48">
                  {relevantDistricts
                    .filter((d) =>
                      d.displayName.toLowerCase().includes(districtFilter.toLowerCase()) ||
                      d.code.toLowerCase().includes(districtFilter.toLowerCase())
                    )
                    .map((d) => {
                      const isSelected = selectedDistricts.includes(d.code);
                      return (
                        <button
                          key={d.code}
                          type="button"
                          onClick={() => toggleDistrict(d.code)}
                          className={cn(
                            "w-full flex items-center justify-between rounded px-2.5 py-1.5 text-xs transition-colors text-left",
                            isSelected
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : "hover:bg-neutral-900 text-neutral-300 border border-transparent"
                          )}
                        >
                          <span className="font-mono font-bold text-[11px]">
                            {d.code} — {d.displayName}
                          </span>
                          <span className="text-[11px]">{isSelected ? "✓" : "+"}</span>
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded border border-neutral-800 px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="rounded bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving..." : "Save Rider"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Alert Dialog */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              Delete Rider Confirmation
            </h3>
            <p className="mt-2 text-xs text-neutral-400">
              Are you sure you want to remove <strong className="text-white">{deleteCandidate.name}</strong> (Bin {deleteCandidate.assignedBin}) from this hub? Any parcels assigned to this rider will route to the overflow bin.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteCandidate(null)}
                className="rounded border border-neutral-800 px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Rider"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

