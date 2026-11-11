/**
 * Hanazo Demo Data Seeder
 * Creates "Yaba Central Hub" and 5 demo riders covering core Lagos delivery corridors.
 * Runs on both PostgreSQL (online) and SQLite (offline) via the unified Drizzle client.
 *
 * Usage:
 * npx tsx src/db/demo-seed.ts
 */

import "dotenv/config";
import { db, hubs, riders } from "./index";
import { eq } from "drizzle-orm";
import { clearRiderCache } from "../lib/sorter";

export const DEMO_HUB_NAME = "Yaba Central Hub";
export const DEMO_HUB_CITY = "Lagos";

export const DEMO_RIDERS = [
  {
    name: "Tunde Bakare",
    phone: "+2348031112233",
    assignedBin: 1,
    assignedDistricts: ["LA-02-A01", "LA-02-A02", "LA-02-B01"], // Ikeja, Alausa, Ikeja GRA, Maryland
    active: true,
  },
  {
    name: "Emeka Okonkwo",
    phone: "+2348023334455",
    assignedBin: 2,
    assignedDistricts: ["LA-04-A01", "LA-04-A02", "LA-04-B01", "LA-04-B02"], // Surulere, Yaba, Ebute Metta
    active: true,
  },
  {
    name: "Ibrahim Garba",
    phone: "+2348055556677",
    assignedBin: 3,
    assignedDistricts: ["LA-01-A02", "LA-01-A03", "LA-01-B01"], // Ikoyi, Victoria Island, Lekki Phase 1
    active: true,
  },
  {
    name: "Femi Adeyemi",
    phone: "+2348087778899",
    assignedBin: 4,
    assignedDistricts: ["LA-03-A01", "LA-03-A02"], // Gbagada, Somolu, Bariga
    active: true,
  },
  {
    name: "Chika Eze",
    phone: "+2348149990011",
    assignedBin: 5,
    assignedDistricts: ["LA-06-A01", "LA-06-A02"], // Alimosho, Egbeda, Akowonjo, Igando
    active: true,
  },
];

export async function seedDemoData(): Promise<string> {
  console.log("🚚 [Hanazo Demo] Checking for existing demo hub...");

  // 1. Find or create Yaba Central Hub
  const existingHubs = await db.select().from(hubs);
  let demoHub = existingHubs.find((h) => h.name === DEMO_HUB_NAME);

  if (!demoHub) {
    const hubId = crypto.randomUUID();
    console.log(`🏢 [Hanazo Demo] Creating "${DEMO_HUB_NAME}" (ID: ${hubId})...`);
    await db.insert(hubs).values({
      id: hubId,
      name: DEMO_HUB_NAME,
      city: DEMO_HUB_CITY,
      createdAt: new Date(),
    } as any);
    demoHub = { id: hubId, name: DEMO_HUB_NAME, city: DEMO_HUB_CITY, createdAt: new Date() };
  } else {
    console.log(`🏢 [Hanazo Demo] Found existing "${DEMO_HUB_NAME}" (ID: ${demoHub.id})`);
  }

  // 2. Clear existing riders for clean demo state if needed
  const existingRiders = await db
    .select()
    .from(riders)
    .where(eq(riders.hubId, demoHub.id));

  const existingNames = new Set(existingRiders.map((r) => r.name));

  // 3. Insert the 5 demo riders
  console.log(`🛵 [Hanazo Demo] Seeding ${DEMO_RIDERS.length} demo riders with bin assignments...`);

  for (const r of DEMO_RIDERS) {
    if (existingNames.has(r.name)) {
      console.log(`   • Rider "${r.name}" already registered for Bin ${r.assignedBin}`);
      continue;
    }

    const riderId = crypto.randomUUID();
    await db.insert(riders).values({
      id: riderId,
      hubId: demoHub.id,
      name: r.name,
      phone: r.phone,
      assignedBin: r.assignedBin,
      assignedDistricts: r.assignedDistricts,
      active: r.active,
    } as any);

    console.log(`   ✓ Registered "${r.name}" -> Bin ${r.assignedBin} [${r.assignedDistricts.join(", ")}]`);
  }

  // Invalidate in-memory cache
  clearRiderCache(demoHub.id);
  console.log(`\n🎉 [Hanazo Demo] Setup Complete! Demo Hub ID: ${demoHub.id}`);
  return demoHub.id;
}

// Execute directly if run as main script
if (require.main === module || process.argv[1]?.includes("demo-seed")) {
  seedDemoData()
    .then((hubId) => {
      console.log(`Ready for warehouse sorting test at /hub/${hubId}/sort`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Demo seeding failed:", err);
      process.exit(1);
    });
}

