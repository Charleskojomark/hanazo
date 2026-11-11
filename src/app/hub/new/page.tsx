"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";

export default function NewHubPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [city, setCity] = useState("Lagos");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/hubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), city }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to create hub");
      }

      const createdHub = await res.json();
      router.push(`/hub/${createdHub.id}/riders`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error creating hub");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 w-full flex-1 flex flex-col justify-center">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Hubs</span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <Building2 className="size-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight text-balance">
              Register New Courier Hub
            </h1>
            <p className="text-xs text-neutral-400 text-pretty">
              Set up a delivery station to start assigning dispatch bins and riders.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 sm:p-8">
        {error && (
          <div className="mb-6 rounded-md border border-red-900 bg-red-950/40 p-3.5 text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="hubName"
              className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-2"
            >
              Hub Name
            </label>
            <input
              id="hubName"
              type="text"
              required
              placeholder="e.g. Ikeja Central Sorting Hub"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <label
              htmlFor="hubCity"
              className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-2"
            >
              City
            </label>
            <select
              id="hubCity"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="Lagos">Lagos</option>
              <option value="Abuja">Abuja</option>
              <option value="Port Harcourt">Port Harcourt</option>
              <option value="Ibadan">Ibadan</option>
              <option value="Kano">Kano</option>
            </select>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full rounded-lg bg-amber-500 py-3 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              {loading ? "Registering..." : "Create Hub & Add Riders →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

