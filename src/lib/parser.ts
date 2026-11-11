/**
 * Hanazo Nigerian Address Text Parser
 * Cleans unstructured Nigerian delivery addresses, extracts landmarks, and identifies spatial tokens.
 */

export interface StructuredAddressTokens {
  houseNumber?: string;
  streetName?: string;
  area?: string;
  city?: string;
  landmarks: string[];
}

/**
 * Common Nigerian noise words and delivery instructions that clutter addresses.
 */
const NOISE_PHRASES: RegExp[] = [
  /\bplease\s+deliver\s+to\b/gi,
  /\bdeliver\s+to\b/gi,
  /\bdispatch\s+to\b/gi,
  /\battention\s+to\b/gi,
  /\battn?\s*:\b/gi,
  /\bcall\s+me\s+when\s+you\s+reach\b/gi,
  /\bcall\s+me\s+on\s+arrival\b/gi,
  /\bcall\s+when\s+you\s+get\s+there\b/gi,
  /\bcall\s+when\s+you\s+reach\b/gi,
  /\bdrop\s+(?:am\s+)?with\b/gi,
  /\bdrop\s+(?:it\s+)?at\b/gi,
  /\bbring\s+(?:am\s+)?come\b/gi,
  /\burgent\s+delivery\b/gi,
  /\burgent\b/gi,
  /\babeg\b/gi,
  /\boya\b/gi,
  /\basap\b/gi,
];

/**
 * Common phone number patterns in Nigeria (+234..., 080..., 090..., 070..., 081...)
 */
const PHONE_PATTERN = /(?:\+?234|0)[789][01]\d{8}\b/g;

/**
 * Common Nigerian landmark cue words and prefixes.
 */
const LANDMARK_PREFIX_PATTERN =
  /\b(?:opposite|opp\.?|beside|behind|near|after|before|close\s+to|next\s+to|adjacent\s+to|by)\s+([^,.;\n]+)/gi;

const LANDMARK_KEYWORD_PATTERN =
  /\b[A-Za-z0-9\s'-]+?\s+(?:junction|jnc\.?|bus\s*stop|b\/stop|bustop|filling\s+station|petrol\s+station|transformer|mosque|church|police\s+station|roundabout|rd\/abt|estate\s+gate|shopping\s+complex|plaza|market|mall|hotel|hospital|clinic|first\s+bank|gtbank|zenith|access\s+bank)\b/gi;

/**
 * Street name suffixes recognized in Nigerian addresses.
 */
const STREET_SUFFIX_PATTERN =
  /\b([A-Za-z0-9\s'-]+?\s+(?:street|st\.?|road|rd\.?|close|cl\.?|crescent|cres\.?|cr\.?|avenue|ave\.?|way|drive|dr\.?|lane|ln\.?|expressway|express))\b/gi;

/**
 * House / Plot / Block / Flat number patterns.
 */
const HOUSE_NUMBER_PATTERN =
  /\b(?:no\.?\s*\d+[a-zA-Z]?|plot\s*\d+[a-zA-Z]?|block\s*[a-zA-Z0-9]+|flat\s*[a-zA-Z0-9]+|suite\s*[a-zA-Z0-9]+|shop\s*[a-zA-Z0-9]+|house\s*\d+[a-zA-Z]?|\b\d+[a-zA-Z]?(?=\s*,?\s+[A-Za-z]+(?:\s+(?:street|road|close|crescent|avenue|way|drive))))\b/i;

/**
 * Major Nigerian cities commonly referenced in courier waybills.
 */
const KNOWN_CITIES = [
  "lagos",
  "abuja",
  "fct",
  "ibadan",
  "port harcourt",
  "kano",
  "benin city",
  "enugu",
  "abeokuta",
  "asaba",
  "warri",
  "calabar",
  "ilorin",
  "kaduna",
];

/**
 * Normalizes an unstructured Nigerian delivery address:
 * - Strips delivery noise and conversational instructions
 * - Removes standalone phone numbers
 * - Cleans excess punctuation and collapses whitespace
 *
 * @param raw - Raw customer input string from waybill or checkout
 * @returns Cleaned, lowercase normalized address string
 */
export function normalizeAddress(raw: string): string {
  if (!raw || typeof raw !== "string") return "";

  let cleaned = raw.trim();

  // 1. Remove phone numbers
  cleaned = cleaned.replace(PHONE_PATTERN, " ");

  // 2. Remove noise instructions
  for (const pattern of NOISE_PHRASES) {
    cleaned = cleaned.replace(pattern, " ");
  }

  // 3. Normalize quotes, slashes, and redundant punctuation
  cleaned = cleaned
    .replace(/["'’]/g, "")
    .replace(/[!?;]+/g, ",")
    .replace(/\s*,\s*/g, ", ")
    .replace(/,+/g, ",")
    .replace(/\s+/g, " ");

  return cleaned.trim().toLowerCase();
}

/**
 * Detects and extracts landmarks from an address using Nigerian vernacular cues
 * (e.g., "opposite First Bank", "after the transformer", "Agip bus stop").
 *
 * @param normalized - Pre-normalized address text
 * @returns Array of unique extracted landmark strings
 */
export function extractLandmarks(normalized: string): string[] {
  if (!normalized) return [];

  const landmarks = new Set<string>();

  // Extract landmarks using prefix cues ("opposite X", "beside Y")
  let match: RegExpExecArray | null;
  const prefixRegex = new RegExp(LANDMARK_PREFIX_PATTERN.source, "gi");
  while ((match = prefixRegex.exec(normalized)) !== null) {
    if (match[1]) {
      const landmark = match[1].trim();
      if (landmark.length > 2 && !KNOWN_CITIES.includes(landmark)) {
        landmarks.add(landmark);
      }
    }
  }

  // Extract landmarks using keyword cues ("X bus stop", "Y junction")
  const keywordRegex = new RegExp(LANDMARK_KEYWORD_PATTERN.source, "gi");
  while ((match = keywordRegex.exec(normalized)) !== null) {
    const landmark = match[0].trim();
    if (landmark.length > 3) {
      landmarks.add(landmark);
    }
  }

  return Array.from(landmarks);
}

/**
 * Extracts structured tokens (house number, street name, area, and city)
 * from a normalized address string.
 *
 * @param normalized - Pre-normalized address text
 * @returns Structured token object
 */
export function extractStructuredTokens(normalized: string): StructuredAddressTokens {
  if (!normalized) {
    return { landmarks: [] };
  }

  const tokens: StructuredAddressTokens = {
    landmarks: extractLandmarks(normalized),
  };

  // 1. Extract House / Plot Number
  const houseMatch = normalized.match(HOUSE_NUMBER_PATTERN);
  if (houseMatch) {
    tokens.houseNumber = houseMatch[0].trim();
  }

  // 2. Extract Street Name
  const streetMatch = normalized.match(STREET_SUFFIX_PATTERN);
  if (streetMatch && streetMatch[0]) {
    tokens.streetName = streetMatch[0].trim();
  }

  // 3. Extract City
  for (const city of KNOWN_CITIES) {
    const cityRegex = new RegExp(`\\b${city}\\b`, "i");
    if (cityRegex.test(normalized)) {
      tokens.city = city === "fct" ? "abuja" : city;
      break;
    }
  }

  // 4. Candidate Area Extraction
  // Split by comma and pick segments that are not street name, city, or house number
  const segments = normalized
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const seg of segments) {
    if (
      tokens.streetName &&
      seg.toLowerCase().includes(tokens.streetName.toLowerCase())
    ) {
      continue;
    }
    if (tokens.city && seg.toLowerCase() === tokens.city.toLowerCase()) {
      continue;
    }
    if (tokens.houseNumber && seg.toLowerCase() === tokens.houseNumber.toLowerCase()) {
      continue;
    }
    // Found candidate area segment
    if (seg.length > 2) {
      tokens.area = seg;
      break;
    }
  }

  return tokens;
}

