// weather.ts
// These used to route through our own Express backend. They don't anymore:
// Open-Meteo needs no API key, so the proxy added a server to maintain, a
// second thing that could be down, and nothing else. The phone calls the
// public APIs directly.

import { WeatherSnapshot } from '../engines/scheduleEngine';
import { LocationInfo } from '../types';

const TIMEOUT_MS = 10000;

async function getJson(url: string, init?: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Two days of history plus three days of forecast, which is what the schedule
 * and alert engines expect: recent rain trims the weekly target, upcoming rain
 * and heat drive the forward-looking alerts.
 */
export async function fetchWeather(lat: number, lon: number): Promise<WeatherSnapshot> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,precipitation,weather_code&daily=precipitation_sum,temperature_2m_max,temperature_2m_min` +
    `&past_days=2&forecast_days=3&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=auto`;

  const data = await getJson(url);

  const precipArr: (number | null)[] = data?.daily?.precipitation_sum ?? [];
  const tempMaxArr: (number | null)[] = data?.daily?.temperature_2m_max ?? [];
  const tempMinArr: (number | null)[] = data?.daily?.temperature_2m_min ?? [];
  // past_days=2 puts the 2 history days at indices 0-1, so index 2 is today.
  const TODAY_INDEX = 2;

  const recentRainIn = precipArr.slice(0, 2).reduce<number>((a, b) => a + (b ?? 0), 0);
  const upcomingRainIn = precipArr.slice(2).reduce<number>((a, b) => a + (b ?? 0), 0);
  const upcomingTemps = tempMaxArr.slice(2).filter((v): v is number => v !== null && v !== undefined);
  const todayHigh = tempMaxArr[TODAY_INDEX];
  const todayLow = tempMinArr[TODAY_INDEX];
  const tonightLow = tempMinArr[TODAY_INDEX + 1];

  return {
    recentRainIn: Number(recentRainIn.toFixed(2)),
    upcomingRainIn: Number(upcomingRainIn.toFixed(2)),
    tempF: data?.current ? Math.round(data.current.temperature_2m) : null,
    forecastMaxTempF: upcomingTemps.length ? Math.round(Math.max(...upcomingTemps)) : null,
    todayHighF: todayHigh != null ? Math.round(todayHigh) : null,
    todayLowF: todayLow != null ? Math.round(todayLow) : null,
    tonightLowF: tonightLow != null ? Math.round(tonightLow) : null,
    weatherCode: data?.current?.weather_code ?? null,
  };
}

/** Coordinates -> a human-readable place name, for display only. */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const data = await getJson(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    const city = data.city || data.locality || data.principalSubdivision;
    const region = data.principalSubdivisionCode || data.principalSubdivision || '';
    if (!city) return 'Your garden';
    return region && region !== city ? `${city}, ${region}` : city;
  } catch {
    // A missing label is cosmetic — the coordinates are what actually matter.
    return 'Your garden';
  }
}

const NOMINATIM_HEADERS = {
  'User-Agent': 'GardenWise garden app (local-only, no backend) - github.com/darinavoloshina-eng/sprout',
};

/** "92101" or "92101-1234" — a US ZIP, which needs special handling (see
 * geocodeSearch). Exported for tests. */
export function usZip(query: string): string | null {
  const m = query.trim().match(/^(\d{5})(?:-\d{4})?$/);
  return m ? m[1] : null;
}

/** A US ZIP looked up as a ZIP. Zippopotam first (a plain ZIP table, so it
 * also knows PO-box ZIPs like Atlanta's 30301 that OpenStreetMap lacks),
 * then Nominatim's structured postcode search limited to the US. */
async function geocodeUsZip(zip: string): Promise<LocationInfo | null> {
  try {
    const data = await getJson(`https://api.zippopotam.us/us/${zip}`);
    const place = data?.places?.[0];
    if (place) {
      const name: string = place['place name'];
      const state: string = place['state abbreviation'] || place.state || '';
      return { lat: Number(place.latitude), lon: Number(place.longitude), label: state ? `${name}, ${state}` : name };
    }
  } catch {
    // Unknown ZIP (404) or service down: try OpenStreetMap below.
  }
  const data = await getJson(
    `https://nominatim.openstreetmap.org/search?postalcode=${zip}&countrycodes=us&format=json&addressdetails=1&limit=1`,
    { headers: NOMINATIM_HEADERS }
  );
  return toLocation(data?.[0]);
}

function toLocation(top: any): LocationInfo | null {
  if (!top) return null;
  const addr = top.address ?? {};
  const city: string | undefined = addr.city || addr.town || addr.village || addr.hamlet || addr.suburb || addr.county;
  const iso: string = addr['ISO3166-2-lvl4'] || '';
  const region: string = addr.state_code || (iso.startsWith('US-') ? iso.slice(3) : '') || addr.state || '';
  const label = city ? (region && region !== city ? `${city}, ${region}` : city) : top.display_name;
  return { lat: Number(top.lat), lon: Number(top.lon), label };
}

/**
 * Typed address -> coordinates. This is the fallback when GPS is denied (or
 * the user just wants to type instead), so it needs to resolve a full
 * street address, not just a city name — Open-Meteo's geocoder only indexes
 * place names, which would silently mismatch on "123 Main St, Springfield".
 * Nominatim (OpenStreetMap) does real address-level geocoding and needs no
 * API key, matching this file's "no backend" approach — its usage policy
 * just requires a descriptive User-Agent and no bulk/rapid-fire querying,
 * which a single search-on-submit easily satisfies.
 *
 * A bare 5-digit ZIP must NOT go through the free-text search: postcodes
 * aren't unique worldwide, and Nominatim's top hit for "92101" is
 * Klaipėda, Lithuania (10001 → Algeria, 33101 → Finland). A user typing
 * their ZIP got another country's weather and frost dates.
 */
export async function geocodeSearch(query: string): Promise<LocationInfo | null> {
  const zip = usZip(query);
  if (zip) return geocodeUsZip(zip);
  const data = await getJson(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1`,
    { headers: NOMINATIM_HEADERS }
  );
  return toLocation(data?.[0]);
}
