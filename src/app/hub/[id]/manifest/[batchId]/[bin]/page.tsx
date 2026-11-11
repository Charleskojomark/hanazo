"use client";

import { use, useEffect, useState } from "react";
import { Printer, ArrowLeft } from "lucide-react";

interface ManifestData {
  manifestId: string;
  batchId: string;
  batchDate: string;
  hub: {
    id: string;
    name: string;
    city: string;
  };
  bin: number;
  rider: {
    id: string;
    name: string;
    phone: string;
  };
  totalParcels: number;
  generatedAt: string;
  parcels: Array<{
    id: string;
    sequenceNumber: number;
    rawAddress: string;
    extractedLandmark: string | null;
    districtCode: string | null;
    districtName: string | null;
    status: string;
  }>;
}

// Regex to extract Nigerian phone numbers for display on delivery sheet
const PHONE_PATTERN = /(?:\+?234|0)[789][01]\d{8}\b/;

export default function ManifestPrintView({
  params,
}: {
  params: Promise<{ id: string; batchId: string; bin: string }>;
}) {
  const { id: _hubId, batchId, bin } = use(params);

  const [manifest, setManifest] = useState<ManifestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadManifest() {
      try {
        const res = await fetch(`/api/manifest/${batchId}/${bin}`);
        if (!res.ok) throw new Error("Manifest could not be loaded");
        const data = await res.json();
        setManifest(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error generating manifest");
      } finally {
        setLoading(false);
      }
    }

    loadManifest();
  }, [batchId, bin]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-neutral-400">
        Generating printable rider manifest...
      </div>
    );
  }

  if (error || !manifest) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center text-red-400">
        <p>{error || "Manifest not found"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white text-black p-6 sm:p-10 font-sans print:p-0">
      {/* Top Controls (Hidden when printed) */}
      <div className="no-print mb-8 flex items-center justify-between border-b pb-4">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1.5 text-xs text-neutral-600 hover:text-black font-medium"
        >
          <ArrowLeft className="size-4" />
          <span>Back</span>
        </button>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded bg-black px-4 py-2 text-xs font-bold text-white hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <Printer className="size-4" />
          <span>Print Manifest (Ctrl + P)</span>
        </button>
      </div>

      {/* Printable Sheet Content */}
      <div className="max-w-4xl mx-auto">
        {/* Manifest Header */}
        <div className="border-b-2 border-black pb-4 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest font-black text-neutral-500">
                HANAZO DISPATCH MANIFEST
              </div>
              <h1 className="text-2xl font-black tracking-tight text-black mt-1">
                {manifest.hub.name}
              </h1>
              <p className="text-xs text-neutral-600">
                {manifest.hub.city} Sorting Centre • Batch Date: {manifest.batchDate}
              </p>
            </div>

            <div className="text-right">
              <div className="text-xs font-mono font-bold text-neutral-500">
                {manifest.manifestId}
              </div>
              <div className="text-4xl font-black text-black tabular-nums mt-1">
                BIN #{manifest.bin}
              </div>
              <div className="text-xs font-semibold text-neutral-800 uppercase tracking-wide">
                {manifest.bin === 99 ? "Overflow Container" : "Active Delivery Route"}
              </div>
            </div>
          </div>

          {/* Rider & Route Meta */}
          <div className="mt-4 grid grid-cols-3 gap-4 bg-neutral-100 p-3 rounded text-xs border border-neutral-300">
            <div>
              <span className="text-neutral-500 block text-[10px] uppercase font-bold">
                Assigned Rider
              </span>
              <strong className="text-sm font-bold text-black">
                {manifest.rider.name}
              </strong>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px] uppercase font-bold">
                Rider Contact
              </span>
              <span className="font-mono text-sm font-bold text-neutral-800">
                {manifest.rider.phone || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px] uppercase font-bold">
                Total Parcels
              </span>
              <span className="text-sm font-black tabular-nums text-black">
                {manifest.totalParcels} stops
              </span>
            </div>
          </div>
        </div>

        {/* Parcels Table */}
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-black text-[11px] uppercase tracking-wider font-bold">
              <th className="py-2.5 w-12 text-center">Stop</th>
              <th className="py-2.5 px-3">Delivery Address & Landmark</th>
              <th className="py-2.5 px-3 w-36">Customer Phone</th>
              <th className="py-2.5 px-3 w-28">NIPOST Code</th>
              <th className="py-2.5 w-24 text-center">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {manifest.parcels.map((parcel) => {
              const matchedPhone = parcel.rawAddress.match(PHONE_PATTERN);
              const phoneText = matchedPhone ? matchedPhone[0] : "—";

              return (
                <tr key={parcel.id} className="break-inside-avoid">
                  <td className="py-3 text-center font-black tabular-nums text-neutral-700">
                    {parcel.sequenceNumber}
                  </td>
                  <td className="py-3 px-3">
                    <p className="font-bold text-black text-xs">
                      {parcel.rawAddress}
                    </p>
                    {parcel.extractedLandmark && (
                      <p className="text-[11px] text-neutral-600 mt-0.5">
                        Landmark:{" "}
                        <span className="font-semibold capitalize text-neutral-900">
                          {parcel.extractedLandmark}
                        </span>
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono text-xs font-semibold text-neutral-800">
                    {phoneText}
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] font-bold text-neutral-700">
                    {parcel.districtCode || "—"}
                  </td>
                  <td className="py-3 text-center">
                    <div className="inline-block size-4 border border-neutral-400 rounded-xs" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer */}
        <div className="mt-8 border-t-2 border-black pt-4 flex items-center justify-between text-xs text-neutral-600">
          <div>
            <span>Generated: {new Date(manifest.generatedAt).toLocaleString()}</span>
            <span className="ml-3 font-mono text-[10px]">Powered by Hanazo • NDAPS</span>
          </div>
          <div className="font-bold text-black">
            Total Manifest Count: {manifest.totalParcels} Parcels
          </div>
        </div>
      </div>
    </div>
  );
}

