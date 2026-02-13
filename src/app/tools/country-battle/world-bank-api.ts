/**
 * World Bank Data API v2 — Client-side fetcher
 *
 * No API key required. One indicator per request.
 * Multiple countries per request via semicolon: KOR;JPN;USA
 */

const BASE = "https://api.worldbank.org/v2";

// Indicator codes
export const INDICATORS = {
  gdp:       "NY.GDP.MKTP.CD",     // GDP current USD
  gdpGrowth: "NY.GDP.MKTP.KD.ZG",  // GDP growth annual %
  population:"SP.POP.TOTL",         // Population
  inflation: "FP.CPI.TOTL.ZG",     // Inflation (CPI annual %)
  unemployment: "SL.UEM.TOTL.ZS",  // Unemployment %
  exports:   "NE.EXP.GNFS.CD",     // Exports (current USD)
  fdi:       "BX.KLT.DINV.CD.WD",  // FDI net inflows (current USD)
  debt:      "GC.DOD.TOTL.GD.ZS",  // Central govt debt (% of GDP)
} as const;

export type IndicatorKey = keyof typeof INDICATORS;

interface WBDataPoint {
  indicator: { id: string; value: string };
  country: { id: string; value: string };
  countryiso3code: string;
  date: string;
  value: number | null;
}

export interface CountryData {
  iso3: string;
  gdp: number | null;
  gdpGrowth: number | null;
  population: number | null;
  inflation: number | null;
  unemployment: number | null;
  exports: number | null;
  fdi: number | null;
  debt: number | null;
}

/** Data for all years for one country: year -> CountryData */
export type CountryTimeSeries = Map<number, CountryData>;

/**
 * Fetch a single indicator for given countries.
 * Returns map of iso3 -> latest non-null value
 */
async function fetchIndicator(
  iso3List: string[],
  indicatorCode: string,
): Promise<Map<string, number>> {
  const countries = iso3List.join(";");
  const url = `${BASE}/country/${countries}/indicator/${indicatorCode}?date=2018:2024&format=json&per_page=500`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`WB API error: ${res.status}`);

  const json = await res.json();
  // Response is [metadata, dataPoints[]] or [{message: ...}]
  if (!Array.isArray(json) || json.length < 2 || !Array.isArray(json[1])) {
    return new Map();
  }

  const data = json[1] as WBDataPoint[];
  const result = new Map<string, number>();

  // Group by country, pick most recent non-null value
  for (const point of data) {
    if (point.value === null) continue;
    const iso = point.countryiso3code;
    const year = parseInt(point.date, 10);
    // Only overwrite if this is a more recent year
    if (!result.has(iso)) {
      result.set(iso, point.value);
    } else {
      // Data comes sorted descending by year, so first non-null is latest
      // but just in case, check year
      const existing = data.find(
        d => d.countryiso3code === iso && d.value !== null && parseInt(d.date, 10) > year
      );
      if (!existing) result.set(iso, point.value);
    }
  }

  return result;
}

/**
 * Fetch all 8 indicators for the given countries in parallel.
 * Returns array of CountryData (one per iso3 code).
 */
export async function fetchAllCountryData(iso3List: string[]): Promise<CountryData[]> {
  const keys = Object.keys(INDICATORS) as IndicatorKey[];
  const codes = Object.values(INDICATORS);

  // Parallel fetch all 8 indicators
  const results = await Promise.allSettled(
    codes.map(code => fetchIndicator(iso3List, code))
  );

  const maps: Map<string, number>[] = results.map(r =>
    r.status === "fulfilled" ? r.value : new Map()
  );

  // Assemble per-country data
  return iso3List.map(iso3 => {
    const data: CountryData = {
      iso3,
      gdp: null, gdpGrowth: null, population: null,
      inflation: null, unemployment: null,
      exports: null, fdi: null, debt: null,
    };

    for (let i = 0; i < keys.length; i++) {
      const val = maps[i].get(iso3);
      if (val !== undefined) {
        data[keys[i]] = val;
      }
    }

    return data;
  });
}

/* ═══════════════════════════════════════════════════════
   TIME SERIES — Fetch multi-year data (2000~2023)
   ═══════════════════════════════════════════════════════ */

const START_YEAR = 2000;
const END_YEAR = 2023;

/**
 * Fetch a single indicator for given countries over full date range.
 * Returns: Map<iso3, Map<year, value>>
 */
async function fetchIndicatorTimeSeries(
  iso3List: string[],
  indicatorCode: string,
): Promise<Map<string, Map<number, number>>> {
  const countries = iso3List.join(";");
  // Need enough per_page for all countries × all years
  const perPage = iso3List.length * (END_YEAR - START_YEAR + 1) + 50;
  const url = `${BASE}/country/${countries}/indicator/${indicatorCode}?date=${START_YEAR}:${END_YEAR}&format=json&per_page=${perPage}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`WB API error: ${res.status}`);

  const json = await res.json();
  if (!Array.isArray(json) || json.length < 2 || !Array.isArray(json[1])) {
    return new Map();
  }

  const data = json[1] as WBDataPoint[];
  const result = new Map<string, Map<number, number>>();

  for (const point of data) {
    if (point.value === null) continue;
    const iso = point.countryiso3code;
    const year = parseInt(point.date, 10);
    if (!result.has(iso)) result.set(iso, new Map());
    result.get(iso)!.set(year, point.value);
  }

  return result;
}

/**
 * Fetch time-series (2000~2023) for all 8 indicators.
 * Returns: Map<iso3, Map<year, CountryData>>
 */
export async function fetchTimeSeriesData(
  iso3List: string[],
): Promise<Map<string, Map<number, CountryData>>> {
  const keys = Object.keys(INDICATORS) as IndicatorKey[];
  const codes = Object.values(INDICATORS);

  // Parallel fetch all 8 indicators as time series
  const results = await Promise.allSettled(
    codes.map(code => fetchIndicatorTimeSeries(iso3List, code))
  );

  const tsMaps: Map<string, Map<number, number>>[] = results.map(r =>
    r.status === "fulfilled" ? r.value : new Map()
  );

  // Assemble per-country per-year data
  const out = new Map<string, Map<number, CountryData>>();

  for (const iso3 of iso3List) {
    const yearMap = new Map<number, CountryData>();

    for (let y = START_YEAR; y <= END_YEAR; y++) {
      const data: CountryData = {
        iso3,
        gdp: null, gdpGrowth: null, population: null,
        inflation: null, unemployment: null,
        exports: null, fdi: null, debt: null,
      };
      for (let i = 0; i < keys.length; i++) {
        const val = tsMaps[i].get(iso3)?.get(y);
        if (val !== undefined) data[keys[i]] = val;
      }
      yearMap.set(y, data);
    }

    // Fill gaps: forward-fill from previous year
    let prev: CountryData | null = null;
    for (let y = START_YEAR; y <= END_YEAR; y++) {
      const cur = yearMap.get(y)!;
      if (prev) {
        for (const k of keys) {
          if (cur[k] === null && prev[k] !== null) {
            cur[k] = prev[k];
          }
        }
      }
      prev = cur;
    }

    out.set(iso3, yearMap);
  }

  return out;
}

/** Get available years list */
export function getYears(): number[] {
  const years: number[] = [];
  for (let y = START_YEAR; y <= END_YEAR; y++) years.push(y);
  return years;
}
