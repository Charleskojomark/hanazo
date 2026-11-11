/**
 * Hanazo 50 Benchmark Nigerian Delivery Addresses
 * A realistic evaluation dataset reflecting Nigerian e-commerce waybills:
 * - Structured street addresses
 * - Landmark-heavy navigation directions
 * - Conversational / phone instructions
 * - Nigerian Pidgin & neighborhood slang
 */

export interface SampleAddressTestCase {
  id: number;
  category: "clean_structured" | "landmark_heavy" | "vague_conversational" | "pidgin_slang";
  rawAddress: string;
  expectedDistrictCode: string | null;
  notes?: string;
}

export const SAMPLE_ADDRESSES: SampleAddressTestCase[] = [
  // =========================================================================
  // CORRIDOR 1: IKEJA / MARYLAND / ALAUSA (Target: LA-02-A01, LA-02-A02, LA-02-B01)
  // =========================================================================
  {
    id: 1,
    category: "clean_structured",
    rawAddress: "No. 12, Allen Avenue, opposite Oshopey Plaza, Ikeja, Lagos State",
    expectedDistrictCode: "LA-02-A01",
    notes: "Direct street + city match",
  },
  {
    id: 2,
    category: "landmark_heavy",
    rawAddress: "Computer Village, beside slot building, enter Otigba street, second floor shop 4B, Ikeja",
    expectedDistrictCode: "LA-02-A01",
    notes: "Landmark match on Computer Village",
  },
  {
    id: 3,
    category: "vague_conversational",
    rawAddress: "Please deliver to Lagos State Secretariat Alausa, Ministry of Finance, call 08023456781 urgent!",
    expectedDistrictCode: "LA-02-A01",
    notes: "Conversational instruction + Alausa Secretariat",
  },
  {
    id: 4,
    category: "clean_structured",
    rawAddress: "24 Isaac John Street, Ikeja GRA, Lagos",
    expectedDistrictCode: "LA-02-A02",
    notes: "Ikeja GRA street address",
  },
  {
    id: 5,
    category: "landmark_heavy",
    rawAddress: "Behind Sheraton Hotel, Oduduwa Crescent, Ikeja GRA, beside the white duplex",
    expectedDistrictCode: "LA-02-A02",
    notes: "Landmark Sheraton + Oduduwa Crescent",
  },
  {
    id: 6,
    category: "clean_structured",
    rawAddress: "Plot 8 Opebi Road, Salvation Bus Stop, Ikeja, Lagos",
    expectedDistrictCode: "LA-02-A01",
    notes: "Opebi street + Salvation bus stop",
  },
  {
    id: 7,
    category: "pidgin_slang",
    rawAddress: "Abeg bring am come Maryland mall, dey inside the cinema side for Maryland",
    expectedDistrictCode: "LA-02-B01",
    notes: "Pidgin words + Maryland",
  },
  {
    id: 8,
    category: "landmark_heavy",
    rawAddress: "Anthony Village, near GTBank, after the pedestrian bridge, Mende road",
    expectedDistrictCode: "LA-02-B01",
    notes: "Anthony Village + Mende",
  },
  {
    id: 9,
    category: "clean_structured",
    rawAddress: "15 Toyin Street, Ikeja, Lagos State",
    expectedDistrictCode: "LA-02-A01",
    notes: "Toyin Street Ikeja",
  },
  {
    id: 10,
    category: "vague_conversational",
    rawAddress: "Call me when you reach Maryland bus stop, my guy go come pick the package 08123456789",
    expectedDistrictCode: "LA-02-B01",
    notes: "Conversational cue + Maryland bus stop",
  },

  // =========================================================================
  // CORRIDOR 2: SURULERE / YABA / EBUTE METTA (Target: LA-04-A01, LA-04-B01, LA-04-B02)
  // =========================================================================
  {
    id: 11,
    category: "clean_structured",
    rawAddress: "No. 14, Ogunlana Drive, Surulere, Lagos",
    expectedDistrictCode: "LA-04-A01",
    notes: "Clean Surulere address",
  },
  {
    id: 12,
    category: "landmark_heavy",
    rawAddress: "Opposite National Stadium, under the bridge by Western Avenue, Surulere",
    expectedDistrictCode: "LA-04-A01",
    notes: "National Stadium Surulere landmark",
  },
  {
    id: 13,
    category: "clean_structured",
    rawAddress: "45 Adeniran Ogunsanya Street, Surulere, Lagos",
    expectedDistrictCode: "LA-04-A01",
    notes: "Adeniran Ogunsanya",
  },
  {
    id: 14,
    category: "clean_structured",
    rawAddress: "Bode Thomas Street, near Eric Moore junction, Surulere",
    expectedDistrictCode: "LA-04-A01",
    notes: "Bode Thomas Surulere",
  },
  {
    id: 15,
    category: "clean_structured",
    rawAddress: "University of Lagos, Faculty of Engineering, Akoka, Yaba, Lagos",
    expectedDistrictCode: "LA-04-B01",
    notes: "Unilag Akoka Yaba",
  },
  {
    id: 16,
    category: "landmark_heavy",
    rawAddress: "Sabo Yaba, beside eTranzact building, Herbert Macaulay Way, Yaba",
    expectedDistrictCode: "LA-04-B01",
    notes: "Sabo Yaba landmark",
  },
  {
    id: 17,
    category: "pidgin_slang",
    rawAddress: "Tejuosho ultramodern market, phase 2 second floor, ask for Iya Bose shop for Yaba side",
    expectedDistrictCode: "LA-04-B01",
    notes: "Tejuosho market Yaba",
  },
  {
    id: 18,
    category: "clean_structured",
    rawAddress: "Commercial Avenue, Sabo Yaba, Lagos",
    expectedDistrictCode: "LA-04-B01",
    notes: "Commercial Avenue Sabo Yaba",
  },
  {
    id: 19,
    category: "landmark_heavy",
    rawAddress: "Ebute Metta, near Oyingbo Market, beside the railway line, Costain side",
    expectedDistrictCode: "LA-04-B02",
    notes: "Ebute Metta + Oyingbo market",
  },
  {
    id: 20,
    category: "vague_conversational",
    rawAddress: "Deliver to Jibowu under bridge, near Chisco transport park, Yaba Lagos call me on arrival 08033333333",
    expectedDistrictCode: "LA-04-B01",
    notes: "Jibowu bus stop Yaba",
  },

  // =========================================================================
  // CORRIDOR 3: VICTORIA ISLAND / IKOYI / LEKKI (Target: LA-01-A02, LA-01-A03, LA-01-B01)
  // =========================================================================
  {
    id: 21,
    category: "clean_structured",
    rawAddress: "No. 14, Admiralty Way, opposite Zenith Bank, Lekki Phase 1, Lagos",
    expectedDistrictCode: "LA-01-B01",
    notes: "Admiralty Way Lekki Phase 1",
  },
  {
    id: 22,
    category: "clean_structured",
    rawAddress: "Plot 22, Fola Osibo Street, Lekki Phase 1, Lagos State",
    expectedDistrictCode: "LA-01-B01",
    notes: "Fola Osibo Lekki 1",
  },
  {
    id: 23,
    category: "landmark_heavy",
    rawAddress: "Lekki tollgate, first turning on your right after Marwa bus stop, Lekki Phase 1",
    expectedDistrictCode: "LA-01-B01",
    notes: "Lekki tollgate + Marwa bus stop",
  },
  {
    id: 24,
    category: "clean_structured",
    rawAddress: "Adeola Odeku Street, Victoria Island, Lagos",
    expectedDistrictCode: "LA-01-A03",
    notes: "Adeola Odeku VI",
  },
  {
    id: 25,
    category: "landmark_heavy",
    rawAddress: "Opposite Eko Hotel and Suites, Adetokunbo Ademola, Victoria Island, Lagos",
    expectedDistrictCode: "LA-01-A03",
    notes: "Eko Hotel VI landmark",
  },
  {
    id: 26,
    category: "clean_structured",
    rawAddress: "10 Bourdillon Road, Ikoyi, Lagos",
    expectedDistrictCode: "LA-01-A02",
    notes: "Bourdillon Ikoyi",
  },
  {
    id: 27,
    category: "landmark_heavy",
    rawAddress: "Banana Island, close 2, plot 5, Ikoyi, Lagos",
    expectedDistrictCode: "LA-01-A02",
    notes: "Banana Island Ikoyi",
  },
  {
    id: 28,
    category: "vague_conversational",
    rawAddress: "Please dispatch to Ozumba Mbadiwe Way, near civic centre, VI Lagos call 09012345678",
    expectedDistrictCode: "LA-01-A03",
    notes: "Ozumba Mbadiwe VI",
  },
  {
    id: 29,
    category: "clean_structured",
    rawAddress: "Parkview Estate, entrance gate, Ikoyi, Lagos",
    expectedDistrictCode: "LA-01-A02",
    notes: "Parkview Estate Ikoyi",
  },
  {
    id: 30,
    category: "pidgin_slang",
    rawAddress: "Drop am for Oniru private beach road, beside that glass plaza for VI side",
    expectedDistrictCode: "LA-01-A03",
    notes: "Oniru VI pidgin",
  },

  // =========================================================================
  // CORRIDOR 4: GBAGADA / SOMOLU / BARIGA (Target: LA-03-A01, LA-03-A02)
  // =========================================================================
  {
    id: 31,
    category: "clean_structured",
    rawAddress: "Plot 15, Diya Street, Gbagada Phase 2, Lagos",
    expectedDistrictCode: "LA-03-A01",
    notes: "Gbagada Phase 2",
  },
  {
    id: 32,
    category: "landmark_heavy",
    rawAddress: "Behind Charly Boy bus stop, Gbagada, near the roundabout, Lagos",
    expectedDistrictCode: "LA-03-A01",
    notes: "Gbagada landmark",
  },
  {
    id: 33,
    category: "clean_structured",
    rawAddress: "Medina Estate, central avenue, Gbagada Phase 1, Lagos",
    expectedDistrictCode: "LA-03-A01",
    notes: "Medina Estate Gbagada Phase 1",
  },
  {
    id: 34,
    category: "pidgin_slang",
    rawAddress: "Pedro road wey dey face Palmgrove, after the police post for Somolu side",
    expectedDistrictCode: "LA-03-A02",
    notes: "Pedro + Somolu + Palmgrove",
  },
  {
    id: 35,
    category: "clean_structured",
    rawAddress: "Bajulaiye Road, Shomolu, Lagos",
    expectedDistrictCode: "LA-03-A02",
    notes: "Bajulaiye Shomolu",
  },
  {
    id: 36,
    category: "landmark_heavy",
    rawAddress: "Bariga market junction, opposite total filling station, Bariga, Lagos",
    expectedDistrictCode: "LA-03-A02",
    notes: "Bariga market junction",
  },
  {
    id: 37,
    category: "clean_structured",
    rawAddress: "Fola Agoro Street, near CMS Grammar School, Bariga",
    expectedDistrictCode: "LA-03-A02",
    notes: "Fola Agoro Bariga",
  },
  {
    id: 38,
    category: "vague_conversational",
    rawAddress: "Call me when you enter Ifako Gbagada by expressway sawmill, urgent 07011112222",
    expectedDistrictCode: "LA-03-A01",
    notes: "Ifako Gbagada sawmill",
  },
  {
    id: 39,
    category: "clean_structured",
    rawAddress: "Onipanu bus stop, Ikorodu road, Somolu, Lagos",
    expectedDistrictCode: "LA-03-A02",
    notes: "Onipanu Somolu",
  },
  {
    id: 40,
    category: "landmark_heavy",
    rawAddress: "Atunrase Estate, beside transformer, Gbagada, Lagos",
    expectedDistrictCode: "LA-03-A01",
    notes: "Gbagada transformer landmark",
  },

  // =========================================================================
  // CORRIDOR 5: EGBEDA / AKOWONJO / IGANDO (Target: LA-06-A01, LA-06-A02)
  // =========================================================================
  {
    id: 41,
    category: "clean_structured",
    rawAddress: "12 Akowonjo Road, MicCom bus stop, Egbeda, Lagos",
    expectedDistrictCode: "LA-06-A01",
    notes: "Akowonjo Road Egbeda",
  },
  {
    id: 42,
    category: "landmark_heavy",
    rawAddress: "Vulcanizer bus stop, opposite Oando filling station, Egbeda, Alimosho, Lagos",
    expectedDistrictCode: "LA-06-A01",
    notes: "Vulcanizer bus stop Egbeda",
  },
  {
    id: 43,
    category: "pidgin_slang",
    rawAddress: "Beside dat yellow house wey dey after the mosque for Egbeda side",
    expectedDistrictCode: "LA-06-A01",
    notes: "Yellow house mosque Egbeda pidgin",
  },
  {
    id: 44,
    category: "clean_structured",
    rawAddress: "Shagari Estate, Sector 3, Mosan, Egbeda, Lagos",
    expectedDistrictCode: "LA-06-A01",
    notes: "Shagari Estate Egbeda",
  },
  {
    id: 45,
    category: "clean_structured",
    rawAddress: "LASU-Iba Expressway, Igando, Lagos",
    expectedDistrictCode: "LA-06-A02",
    notes: "Igando LASU road",
  },
  {
    id: 46,
    category: "landmark_heavy",
    rawAddress: "Opposite Synagogue Church, Ikotun-Idimu Road, Ikotun, Lagos",
    expectedDistrictCode: "LA-06-A02",
    notes: "Synagogue Ikotun landmark",
  },
  {
    id: 47,
    category: "vague_conversational",
    rawAddress: "Council bus stop, enter the street with big transformer, Idimu, call 08098765432",
    expectedDistrictCode: "LA-06-A02",
    notes: "Council bus stop Idimu transformer",
  },
  {
    id: 48,
    category: "pidgin_slang",
    rawAddress: "Oya bring am come Ikotun market, opposite the park, ask for Baba Segun for Ikotun",
    expectedDistrictCode: "LA-06-A02",
    notes: "Ikotun market pidgin",
  },

  // =========================================================================
  // CORRIDOR 6: DELIBERATELY VAGUE / UNRESOLVED (Target: null -> Overflow Bin 99)
  // =========================================================================
  {
    id: 49,
    category: "vague_conversational",
    rawAddress: "Call me when you reach junction, ask for Mama Blessing shop",
    expectedDistrictCode: null,
    notes: "No geographic identifiers - expected fallback to Overflow",
  },
  {
    id: 50,
    category: "landmark_heavy",
    rawAddress: "Opposite Oando filling station, behind MRS, enter the street with big transformer",
    expectedDistrictCode: null,
    notes: "Generic Nigerian landmarks without city/area name - expected fallback to Overflow",
  },
];

