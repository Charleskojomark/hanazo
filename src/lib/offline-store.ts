/**
 * Hanazo Offline IndexedDB Store & Synchronization Engine
 * Enables fully autonomous parcel sorting on warehouse tablets and handheld scanners
 * even when cellular/Wi-Fi connection drops in Nigerian industrial hubs.
 */

import { normalizeAddress, extractStructuredTokens, extractLandmarks } from "./parser";

const DB_NAME = "hanazo_offline_store";
const DB_VERSION = 1;

export interface OfflineDistrictNode {
  code: string;
  state: string;
  lga: string;
  district: string;
  displayName: string;
  aliases: string[];
}

export interface OfflineRider {
  id: string;
  hubId: string;
  name: string;
  phone: string;
  assignedBin: number;
  assignedDistricts: string[];
  active: boolean;
}

export interface QueuedOfflineParcel {
  id?: number;
  rawAddress: string;
  hubId: string;
  bin: number;
  riderId: string;
  riderName: string;
  districtCode: string | null;
  districtName: string | null;
  confidence: "high" | "medium" | "low" | "unresolved";
  extractedLandmark: string | null;
  createdAt: string;
}

export interface OfflineResolutionResult {
  districtCode: string | null;
  districtName: string | null;
  bin: number;
  riderId: string;
  riderName: string;
  confidence: "high" | "medium" | "low" | "unresolved";
  method: "alias_match" | "fuzzy_match" | "overflow_fallback";
  extractedLandmark: string | null;
  isOverflow: boolean;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Initializes or retrieves the IndexedDB instance for Hanazo offline storage.
 */
export async function getOfflineDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in browser environments.");
  }

  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. District reference nodes
      if (!db.objectStoreNames.contains("district_nodes")) {
        db.createObjectStore("district_nodes", { keyPath: "code" });
      }

      // 2. Local riders cache
      if (!db.objectStoreNames.contains("riders")) {
        const riderStore = db.createObjectStore("riders", { keyPath: "id" });
        riderStore.createIndex("hubId", "hubId", { unique: false });
      }

      // 3. Offline queued parcels awaiting sync
      if (!db.objectStoreNames.contains("offline_queue")) {
        const queueStore = db.createObjectStore("offline_queue", {
          keyPath: "id",
          autoIncrement: true,
        });
        queueStore.createIndex("hubId", "hubId", { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Synchronizes official NIPOST district reference data from the server into IndexedDB.
 * Called automatically on page load when online.
 *
 * @returns Number of district nodes synced
 */
export async function syncDistrictNodes(): Promise<number> {
  if (typeof window === "undefined" || !navigator.onLine) return 0;

  try {
    const res = await fetch("/api/districts");
    if (!res.ok) return 0;

    const nodes: OfflineDistrictNode[] = await res.json();
    if (!Array.isArray(nodes) || nodes.length === 0) return 0;

    const db = await getOfflineDb();
    const tx = db.transaction("district_nodes", "readwrite");
    const store = tx.objectStore("district_nodes");

    for (const node of nodes) {
      store.put({
        code: node.code,
        state: node.state,
        lga: node.lga,
        district: node.district,
        displayName: node.displayName,
        aliases: Array.isArray(node.aliases) ? node.aliases : [],
      });
    }

    return new Promise((resolve) => {
      tx.oncomplete = () => {
        resolve(nodes.length);
      };
      tx.onerror = () => {
        resolve(0);
      };
    });
  } catch (error) {
    console.warn("[Hanazo PWA] District node sync failed:", error);
    return 0;
  }
}

/**
 * Caches active hub riders into IndexedDB for local offline bin routing.
 */
export async function cacheHubRiders(hubId: string, riders: OfflineRider[]): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const db = await getOfflineDb();
    const tx = db.transaction("riders", "readwrite");
    const store = tx.objectStore("riders");

    for (const rider of riders) {
      store.put(rider);
    }
  } catch (error) {
    console.warn(`[Hanazo PWA] Failed to cache riders for hub ${hubId}:`, error);
  }
}

/**
 * Fetches all district nodes stored locally in IndexedDB.
 */
export async function getCachedDistrictNodes(): Promise<OfflineDistrictNode[]> {
  try {
    const db = await getOfflineDb();
    const tx = db.transaction("district_nodes", "readonly");
    const store = tx.objectStore("district_nodes");
    const req = store.getAll();

    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Fetches active riders for a specific hub from IndexedDB.
 */
export async function getCachedHubRiders(hubId: string): Promise<OfflineRider[]> {
  try {
    const db = await getOfflineDb();
    const tx = db.transaction("riders", "readonly");
    const store = tx.objectStore("riders");
    const index = store.index("hubId");
    const req = index.getAll(hubId);

    return new Promise((resolve) => {
      req.onsuccess = () => resolve((req.result || []).filter((r) => r.active));
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Resolves an unstructured raw address to a district code completely offline
 * using the parser and alias matching against local IndexedDB data.
 *
 * @param rawAddress - Raw waybill string
 * @param hubId - Target courier hub ID
 * @returns Offline resolution and bin allocation result
 */
export async function resolveDistrictOffline(
  rawAddress: string,
  hubId: string
): Promise<OfflineResolutionResult> {
  const normalized = normalizeAddress(rawAddress);
  const landmarks = extractLandmarks(normalized);
  const primaryLandmark = landmarks.length > 0 ? landmarks[0] : null;

  const [nodes, riders] = await Promise.all([
    getCachedDistrictNodes(),
    getCachedHubRiders(hubId),
  ]);

  let matchedNode: OfflineDistrictNode | null = null;
  let confidence: "high" | "medium" | "low" | "unresolved" = "unresolved";
  let method: "alias_match" | "fuzzy_match" | "overflow_fallback" = "overflow_fallback";

  // Step 1: Direct alias and district name substring match
  for (const node of nodes) {
    const candidateAliases = [node.displayName, ...(node.aliases || [])];

    for (const alias of candidateAliases) {
      if (alias && alias.length >= 3) {
        const regex = new RegExp(`(^|\\b|\\s|,)${alias.toLowerCase()}(\\b|\\s|,|$)`, "i");
        if (regex.test(normalized)) {
          matchedNode = node;
          confidence = "high";
          method = "alias_match";
          break;
        }
      }
    }
    if (matchedNode) break;
  }

  // Step 2: Fallback to token matching
  if (!matchedNode) {
    const tokens = extractStructuredTokens(normalized);
    if (tokens.area) {
      const areaLower = tokens.area.toLowerCase();
      matchedNode =
        nodes.find(
          (n) =>
            n.displayName.toLowerCase().includes(areaLower) ||
            n.district.toLowerCase().includes(areaLower)
        ) || null;

      if (matchedNode) {
        confidence = "medium";
        method = "alias_match";
      }
    }
  }

  const districtCode = matchedNode ? matchedNode.code : null;
  const districtName = matchedNode ? matchedNode.displayName : "Unresolved Address (Offline)";

  // Step 3: Match rider bin
  let bin = 99;
  let riderId = "overflow";
  let riderName = "Overflow / Unassigned";
  let isOverflow = true;

  if (districtCode && riders.length > 0) {
    const targetClean = districtCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

    for (const rider of riders) {
      const assigned = rider.assignedDistricts.some((d) => {
        const dClean = d.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        return (
          d.toUpperCase() === districtCode.toUpperCase() ||
          (dClean.length >= 4 && targetClean.startsWith(dClean))
        );
      });

      if (assigned) {
        bin = rider.assignedBin;
        riderId = rider.id;
        riderName = rider.name;
        isOverflow = false;
        break;
      }
    }
  }

  return {
    districtCode,
    districtName,
    bin,
    riderId,
    riderName,
    confidence,
    method,
    extractedLandmark: primaryLandmark,
    isOverflow,
  };
}

/**
 * Appends a parcel sorted while offline to the IndexedDB sync queue.
 */
export async function queueOfflineParcel(
  parcel: Omit<QueuedOfflineParcel, "id" | "createdAt">
): Promise<number> {
  try {
    const db = await getOfflineDb();
    const tx = db.transaction("offline_queue", "readwrite");
    const store = tx.objectStore("offline_queue");

    const item: QueuedOfflineParcel = {
      ...parcel,
      createdAt: new Date().toISOString(),
    };

    const req = store.add(item);
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(Number(req.result));
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.error("[Hanazo PWA] Failed to queue offline parcel:", error);
    return 0;
  }
}

/**
 * Retrieves all parcels currently queued in the offline store.
 */
export async function getQueuedOfflineParcels(hubId?: string): Promise<QueuedOfflineParcel[]> {
  try {
    const db = await getOfflineDb();
    const tx = db.transaction("offline_queue", "readonly");
    const store = tx.objectStore("offline_queue");

    if (hubId) {
      const index = store.index("hubId");
      const req = index.getAll(hubId);
      return new Promise((resolve) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    }

    const req = store.getAll();
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Automatically synchronizes queued offline parcels to the server via POST /api/batch
 * when network connectivity is restored.
 *
 * @param hubId - Target courier hub ID
 * @returns Sync summary with number of uploaded parcels and batch ID
 */
export async function syncOfflineQueueToServer(
  hubId: string
): Promise<{ syncedCount: number; batchId?: string }> {
  if (typeof window === "undefined" || !navigator.onLine) {
    return { syncedCount: 0 };
  }

  const queued = await getQueuedOfflineParcels(hubId);
  if (queued.length === 0) return { syncedCount: 0 };

  try {
    const addresses = queued.map((p) => p.rawAddress);

    const res = await fetch("/api/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresses, hubId }),
    });

    if (!res.ok) {
      throw new Error(`Sync request failed with status ${res.status}`);
    }

    const batchData = await res.json();

    // Clear synced items from IndexedDB
    const db = await getOfflineDb();
    const tx = db.transaction("offline_queue", "readwrite");
    const store = tx.objectStore("offline_queue");

    for (const item of queued) {
      if (item.id) {
        store.delete(item.id);
      }
    }

    return {
      syncedCount: queued.length,
      batchId: batchData.batchId,
    };
  } catch (error) {
    console.error("[Hanazo PWA] Failed to synchronize offline queue:", error);
    return { syncedCount: 0 };
  }
}

