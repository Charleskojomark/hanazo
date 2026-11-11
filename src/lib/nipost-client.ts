/**
 * Hanazo NIPOST NDAPS Typed Client
 * Official portal: https://api.postcode.gov.ng
 */

export interface NipostAutocompleteItem {
  code: string;
  label: string;
  state?: string;
  lga?: string;
  district?: string;
  area?: string;
}

export interface NipostAutocompleteResponse {
  results: NipostAutocompleteItem[];
}

export interface NipostLookupResponse {
  valid: boolean;
  code: string;
  level: number;
  state?: string;
  lga?: string;
  district?: string;
  area?: string;
  locality?: string;
  zone?: string;
  streetAddress?: string;
  buildingUse?: string;
  buildingInfo?: Record<string, unknown>;
  geometry?: {
    latitude: number;
    longitude: number;
  };
}

export interface NipostDisassembleResponse {
  state: string;
  lga: string;
  district: string;
  area: string;
  unit: string;
}

export interface NipostStateRef {
  code: string; // e.g. "LA", "FC"
  name: string; // e.g. "Lagos", "Federal Capital Territory"
}

export interface NipostLgaRef {
  code: string; // e.g. "04"
  name: string; // e.g. "Surulere"
  stateCode: string;
}

export interface NipostDistrictRef {
  code: string; // e.g. "A12"
  name: string; // e.g. "Egbeda / Akowonjo"
  stateCode: string;
  lgaCode: string;
}

export interface NipostApiError {
  status: number;
  message: string;
  details?: unknown;
}

/**
 * Sliding window rate limiter to enforce max requests per second.
 */
class RateLimiter {
  private timestamps: number[] = [];
  private maxRequests: number;
  private timeWindowMs: number;

  constructor(maxRequests = 10, timeWindowMs = 1000) {
    this.maxRequests = maxRequests;
    this.timeWindowMs = timeWindowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    // Evict timestamps older than window
    this.timestamps = this.timestamps.filter((t) => now - t < this.timeWindowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldest = this.timestamps[0];
      const waitTime = this.timeWindowMs - (now - oldest) + 10;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.acquire();
    }

    this.timestamps.push(Date.now());
  }
}

export class NipostClient {
  private baseUrl: string;
  private apiKey: string;
  private rateLimiter: RateLimiter;
  private timeoutMs: number;

  constructor(options?: { baseUrl?: string; apiKey?: string; timeoutMs?: number }) {
    this.baseUrl = options?.baseUrl || process.env.NIPOST_API_URL || "https://api.postcode.gov.ng";
    this.apiKey = options?.apiKey || process.env.NIPOST_API_KEY || "";
    this.timeoutMs = options?.timeoutMs || 5000;
    this.rateLimiter = new RateLimiter(10, 1000);
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    await this.rateLimiter.acquire();

    const url = `${this.baseUrl.replace(/\/$/, "")}${endpoint}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string>),
    };

    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorBody: unknown;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = await response.text();
        }
        const error: NipostApiError = {
          status: response.status,
          message: `NIPOST API Error [HTTP ${response.status}]: ${response.statusText}`,
          details: errorBody,
        };
        throw error;
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") {
        throw {
          status: 408,
          message: `NIPOST API request timed out after ${this.timeoutMs}ms for ${endpoint}`,
        } as NipostApiError;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Autocomplete segment-aware address or postcode search
   * GET /v1/search/autocomplete?q={query}
   */
  async searchAutocomplete(query: string): Promise<NipostAutocompleteResponse> {
    const encoded = encodeURIComponent(query.trim());
    return this.request<NipostAutocompleteResponse>(`/v1/search/autocomplete?q=${encoded}`);
  }

  /**
   * Look up postcode attributes graded across Levels 1 through 5
   * Level 1: validity (free)
   * Level 2: administrative address
   * Level 3: recent house address & building use
   * Level 4: building details
   * Level 5: point geometry coordinates (latitude, longitude)
   * GET /v1/lookup?code={code}&level={level}
   */
  async lookupPostcode(code: string, level: 1 | 2 | 3 | 4 | 5 = 1): Promise<NipostLookupResponse> {
    const encoded = encodeURIComponent(code.trim().toUpperCase());
    return this.request<NipostLookupResponse>(`/v1/lookup?code=${encoded}&level=${level}`);
  }

  /**
   * Disassemble an 11/12-character postcode into its 5 structural segments
   * GET /v1/assembly/disassemble?code={code}
   */
  async disassemble(code: string): Promise<NipostDisassembleResponse> {
    const encoded = encodeURIComponent(code.trim().toUpperCase());
    return this.request<NipostDisassembleResponse>(`/v1/assembly/disassemble?code=${encoded}`);
  }

  /**
   * List all 36 States + FCT
   * GET /v1/reference/states
   */
  async listStates(): Promise<NipostStateRef[]> {
    return this.request<NipostStateRef[]>("/v1/reference/states");
  }

  /**
   * List all Local Government Areas (LGAs) within a state
   * GET /v1/reference/lgas?state={state}
   */
  async listLGAs(state: string): Promise<NipostLgaRef[]> {
    const encoded = encodeURIComponent(state.trim().toUpperCase());
    return this.request<NipostLgaRef[]>(`/v1/reference/lgas?state=${encoded}`);
  }

  /**
   * List all Districts within a State and LGA
   * GET /v1/reference/districts?state={state}&lga={lga}
   */
  async listDistricts(state: string, lga: string): Promise<NipostDistrictRef[]> {
    const stateEncoded = encodeURIComponent(state.trim().toUpperCase());
    const lgaEncoded = encodeURIComponent(lga.trim());
    return this.request<NipostDistrictRef[]>(
      `/v1/reference/districts?state=${stateEncoded}&lga=${lgaEncoded}`
    );
  }
}

// Export singleton instance for app-wide use
export const nipost = new NipostClient();

