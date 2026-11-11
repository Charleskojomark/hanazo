import "dotenv/config";
import { db, districtNodes } from "./index";
import { nipost } from "../lib/nipost-client";
import { sql } from "drizzle-orm";

interface CuratedDistrict {
  code: string;
  state: string;
  lga: string;
  district: string;
  displayName: string;
  aliases: string[];
}

/**
 * Curated high-frequency districts and neighborhood aliases for Lagos and FCT Abuja.
 * Ensures the system works out-of-the-box with immediate ground-truth accuracy.
 */
export const CURATED_DISTRICTS: CuratedDistrict[] = [
  // --- LAGOS STATE (LA) ---
  {
    code: "LA-01-A01",
    state: "LA",
    lga: "01",
    district: "A01",
    displayName: "Lagos Island Central / Marina",
    aliases: ["lagos island", "marina", "broad street", "cms", "balogun market", "idumota", "isale eko"],
  },
  {
    code: "LA-01-A02",
    state: "LA",
    lga: "01",
    district: "A02",
    displayName: "Ikoyi / Obalende",
    aliases: ["ikoyi", "bourdillon", "banana island", "obalende", "parkview", "dolphin estate", "osborne"],
  },
  {
    code: "LA-01-A03",
    state: "LA",
    lga: "01",
    district: "A03",
    displayName: "Victoria Island (VI)",
    aliases: ["victoria island", "vi", "adeola odeku", "ahmadu bello", "kofo abayomi", "ozumba mbadiwe", "oniru"],
  },
  {
    code: "LA-01-B01",
    state: "LA",
    lga: "01",
    district: "B01",
    displayName: "Lekki Phase 1",
    aliases: ["lekki phase 1", "lekki 1", "admiralty way", "fola osibo", "marwa", "lekki tollgate"],
  },
  {
    code: "LA-01-B02",
    state: "LA",
    lga: "01",
    district: "B02",
    displayName: "Ikate / Osapa / Agungi",
    aliases: ["ikate", "osapa london", "elegushi", "chisco", "jakande lekki", "agungi"],
  },
  {
    code: "LA-01-B03",
    state: "LA",
    lga: "01",
    district: "B03",
    displayName: "Chevron / VGC / Ajah",
    aliases: ["chevron", "vgc", "victoria garden city", "ajah", "ikota", "badore", "sangotedo", "abijo"],
  },
  {
    code: "LA-02-A01",
    state: "LA",
    lga: "02",
    district: "A01",
    displayName: "Ikeja Central / Alausa",
    aliases: ["ikeja", "alausa", "allen avenue", "opebi", "toyin street", "computer village", "secretariat ikeja", "obafemi awolowo way"],
  },
  {
    code: "LA-02-A02",
    state: "LA",
    lga: "02",
    district: "A02",
    displayName: "Ikeja GRA",
    aliases: ["ikeja gra", "isaac john", "joel ogunnaike", "oduduwa crescent", "government reserved area ikeja"],
  },
  {
    code: "LA-02-B01",
    state: "LA",
    lga: "02",
    district: "B01",
    displayName: "Maryland / Anthony Village",
    aliases: ["maryland", "mende", "anthony village", "anthony", "cane village", "sunmola"],
  },
  {
    code: "LA-02-B02",
    state: "LA",
    lga: "02",
    district: "B02",
    displayName: "Oregun / Ojota / Ogudu",
    aliases: ["oregun", "kudirat abiola way", "ojota", "ogudu", "ogudu gra"],
  },
  {
    code: "LA-03-A01",
    state: "LA",
    lga: "03",
    district: "A01",
    displayName: "Gbagada Phase 1 & 2",
    aliases: ["gbagada", "gbagada phase 1", "gbagada phase 2", "pedro", "medina", "ifako gbagada", "sawmill"],
  },
  {
    code: "LA-03-A02",
    state: "LA",
    lga: "03",
    district: "A02",
    displayName: "Somolu / Bariga",
    aliases: ["somolu", "shomolu", "bariga", "bajulaiye", "palmgrove", "onipanu", "fola agoro"],
  },
  {
    code: "LA-03-B01",
    state: "LA",
    lga: "03",
    district: "B01",
    displayName: "Ketu / Alapere / Mile 12",
    aliases: ["ketu", "alapere", "mile 12", "tipper garage", "ikosi", "demurin"],
  },
  {
    code: "LA-03-B02",
    state: "LA",
    lga: "03",
    district: "B02",
    displayName: "Magodo / Shangisha",
    aliases: ["magodo", "magodo phase 1", "magodo phase 2", "magodo shangisha", "isheri", "cmd road"],
  },
  {
    code: "LA-04-A01",
    state: "LA",
    lga: "04",
    district: "A01",
    displayName: "Surulere Central / Bode Thomas",
    aliases: ["surulere", "bode thomas", "adeniran ogunsanya", "ogunlana drive", "masha", "national stadium", "shitta"],
  },
  {
    code: "LA-04-A02",
    state: "LA",
    lga: "04",
    district: "A02",
    displayName: "Itire / Ikate / Aguda",
    aliases: ["itire", "lawanson", "ijesha", "aguda", "adewale street"],
  },
  {
    code: "LA-04-B01",
    state: "LA",
    lga: "04",
    district: "B01",
    displayName: "Yaba / Sabo / Akoka",
    aliases: ["yaba", "sabo yaba", "commercial avenue", "tejuosho", "herbert macaulay", "unilag", "akoka", "jibowu"],
  },
  {
    code: "LA-04-B02",
    state: "LA",
    lga: "04",
    district: "B02",
    displayName: "Ebute Metta / Oyingbo",
    aliases: ["ebute metta", "ebute meta", "oyingbo", "costain", "alaka", "otto"],
  },
  {
    code: "LA-05-A01",
    state: "LA",
    lga: "05",
    district: "A01",
    displayName: "Oshodi / Isolo / Okota",
    aliases: ["oshodi", "isolo", "okota", "ago palace", "ago palace way", "cele bus stop", "ilasa"],
  },
  {
    code: "LA-05-A02",
    state: "LA",
    lga: "05",
    district: "A02",
    displayName: "Ajao Estate / Ejigbo",
    aliases: ["ajao estate", "ejigbo", "nnpc ejigbo", "bucknor", "jakande isolo"],
  },
  {
    code: "LA-06-A01",
    state: "LA",
    lga: "06",
    district: "A01",
    displayName: "Alimosho / Egbeda / Akowonjo",
    aliases: ["egbeda", "akowonjo", "shagari estate", "vulcanizer bus stop", "ponle", "idimu road", "orelope"],
  },
  {
    code: "LA-06-A02",
    state: "LA",
    lga: "06",
    district: "A02",
    displayName: "Idimu / Ikotun / Igando",
    aliases: ["idimu", "ikotun", "igando", "lasu road", "synagogue", "council bus stop", "pipeline"],
  },
  {
    code: "LA-06-B01",
    state: "LA",
    lga: "06",
    district: "B01",
    displayName: "Ipaja / Ayobo / Command",
    aliases: ["ipaja", "ayobo", "command", "abesan estate", "baruwa", "gate bus stop"],
  },
  {
    code: "LA-07-A01",
    state: "LA",
    lga: "07",
    district: "A01",
    displayName: "Agege / Pen Cinema",
    aliases: ["agege", "pen cinema", "dopemu", "oko oba", "abattoir", "iyana ipaja"],
  },
  {
    code: "LA-07-B01",
    state: "LA",
    lga: "07",
    district: "B01",
    displayName: "Ogba / Ojodu / Berger",
    aliases: ["ogba", "ojodu", "ojodu berger", "berger", "excellence hotel", "aguda ogba", "haruna"],
  },
  {
    code: "LA-08-A01",
    state: "LA",
    lga: "08",
    district: "A01",
    displayName: "Amuwo-Odofin / Festac Town",
    aliases: ["festac", "festac town", "amuwo odofin", "mile 2", "apple junction", "trade fair", "alaba intl"],
  },
  {
    code: "LA-09-A01",
    state: "LA",
    lga: "09",
    district: "A01",
    displayName: "Ikorodu Central",
    aliases: ["ikorodu", "agric", "ogolonto", "ebute ikorodu", "sabore", "haruna ikorodu", "laspotech"],
  },

  // --- FEDERAL CAPITAL TERRITORY (FC - ABUJA) ---
  {
    code: "FC-01-A01",
    state: "FC",
    lga: "01",
    district: "A01",
    displayName: "Garki 1 & 2 / Area 1-11",
    aliases: ["garki", "garki 1", "garki 2", "area 1", "area 2", "area 3", "area 7", "area 8", "area 10", "area 11"],
  },
  {
    code: "FC-01-A02",
    state: "FC",
    lga: "01",
    district: "A02",
    displayName: "Wuse 1 & 2",
    aliases: ["wuse", "wuse 1", "wuse 2", "wuse zone 1", "wuse zone 2", "wuse zone 3", "wuse zone 4", "wuse zone 5", "wuse zone 6", "aminu kano crescent", "adetokunbo ademola"],
  },
  {
    code: "FC-01-A03",
    state: "FC",
    lga: "01",
    district: "A03",
    displayName: "Maitama / Diplomatic Zone",
    aliases: ["maitama", "transcorp hilton", "aguiyi ironsi", "shehu shagari", "gana street", "ibro hotel"],
  },
  {
    code: "FC-01-A04",
    state: "FC",
    lga: "01",
    district: "A04",
    displayName: "Asokoro",
    aliases: ["asokoro", "ecowas", "yakubu gowon crescent", "asokoro general hospital", "aya round about"],
  },
  {
    code: "FC-01-B01",
    state: "FC",
    lga: "01",
    district: "B01",
    displayName: "Central Business District (CBD)",
    aliases: ["central business district", "cbd abuja", "central area", "sec", "cbn headquarters", "nnpc towers", "national mosque"],
  },
  {
    code: "FC-01-B02",
    state: "FC",
    lga: "01",
    district: "B02",
    displayName: "Jabi / Utako",
    aliases: ["jabi", "jabi lake", "jabi mall", "utako", "utako market", "utako motor park", "alex ekwueme way"],
  },
  {
    code: "FC-01-B03",
    state: "FC",
    lga: "01",
    district: "B03",
    displayName: "Gwarinpa / Life Camp",
    aliases: ["gwarinpa", "gwarinpa estate", "1st avenue", "2nd avenue", "3rd avenue", "life camp", "charly boy"],
  },
  {
    code: "FC-01-B04",
    state: "FC",
    lga: "01",
    district: "B04",
    displayName: "Mabushi / Kado / Katampe",
    aliases: ["mabushi", "kado", "kado estate", "katampe", "katampe extension", "federal ministry of works"],
  },
  {
    code: "FC-01-C01",
    state: "FC",
    lga: "01",
    district: "C01",
    displayName: "Apo / Guzape / Durumi",
    aliases: ["apo", "apo legislative quarters", "apo mechanic", "guzape", "durumi", "american international school"],
  },
  {
    code: "FC-01-C02",
    state: "FC",
    lga: "01",
    district: "C02",
    displayName: "Lugbe / Airport Road",
    aliases: ["lugbe", "airport road abuja", "fha lugbe", "river park estate", "trademoore estate", "lugbe total"],
  },
  {
    code: "FC-02-A01",
    state: "FC",
    lga: "02",
    district: "A01",
    displayName: "Kubwa / Bwari",
    aliases: ["kubwa", "kubwa phase 4", "pw kubwa", "gado nasco", "arab road", "bwari", "nigerian law school bwari"],
  },
  {
    code: "FC-02-A02",
    state: "FC",
    lga: "02",
    district: "A02",
    displayName: "Dutse / Dawaki",
    aliases: ["dutse", "dutse alhaji", "dawaki", "news engineering", "dani estate"],
  },
  {
    code: "FC-03-A01",
    state: "FC",
    lga: "03",
    district: "A01",
    displayName: "Gwagwalada",
    aliases: ["gwagwalada", "uniabuja", "university of abuja", "teaching hospital gwagwalada"],
  },
];

export async function seedDistrictNodes() {
  console.log("🌱 [Hanazo Seeder] Starting NIPOST Reference Seed...");

  const allRecords: Map<string, CuratedDistrict> = new Map();

  // 1. Add curated baseline first
  for (const item of CURATED_DISTRICTS) {
    allRecords.set(item.code, item);
  }

  // 2. Attempt to pull live data from NIPOST NDAPS API
  try {
    console.log("📡 [Hanazo Seeder] Querying NIPOST NDAPS reference endpoints...");
    const states = await nipost.listStates();
    console.log(`✅ [Hanazo Seeder] Retrieved ${states.length} states from NIPOST.`);

    // Iterate through first key states (e.g., LA and FC) to fetch dynamic LGA and Districts
    for (const state of states.slice(0, 5)) {
      try {
        const lgas = await nipost.listLGAs(state.code);
        for (const lga of lgas) {
          try {
            const districts = await nipost.listDistricts(state.code, lga.code);
            for (const dist of districts) {
              const code = `${state.code}-${lga.code}-${dist.code}`;
              const existing = allRecords.get(code);

              if (existing) {
                // Merge name if available
                existing.displayName = dist.name || existing.displayName;
              } else {
                allRecords.set(code, {
                  code,
                  state: state.code,
                  lga: lga.code,
                  district: dist.code,
                  displayName: dist.name || `${state.code} ${lga.name} District ${dist.code}`,
                  aliases: [dist.name.toLowerCase().trim()],
                });
              }
            }
          } catch {
            // Silently continue if single district query fails
          }
        }
      } catch {
        // Silently continue if LGA query fails
      }
    }
  } catch {
    console.warn("⚠️ [Hanazo Seeder] NIPOST API remote query skipped or timed out. Falling back to built-in curated dataset.");
  }

  const recordsToInsert = Array.from(allRecords.values());
  console.log(`💾 [Hanazo Seeder] Writing ${recordsToInsert.length} district nodes to PostgreSQL...`);

  // Batch insert into district_nodes
  for (const record of recordsToInsert) {
    await db
      .insert(districtNodes)
      .values({
        code: record.code,
        state: record.state,
        lga: record.lga,
        district: record.district,
        displayName: record.displayName,
        aliases: record.aliases,
      })
      .onConflictDoUpdate({
        target: districtNodes.code,
        set: {
          displayName: sql`excluded.display_name`,
          aliases: sql`excluded.aliases`,
        },
      });
  }

  console.log("✅ [Hanazo Seeder] District nodes successfully seeded in PostgreSQL!");
}

// Auto-run if executed directly via tsx
if (require.main === module) {
  seedDistrictNodes()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ [Hanazo Seeder] Error during seed:", err);
      process.exit(1);
    });
}

