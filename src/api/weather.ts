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

  return {
    recentRainIn: Number(recentRainIn.toFixed(2)),
    upcomingRainIn: Number(upcomingRainIn.toFixed(2)),
    tempF: data?.current ? Math.round(data.current.temperature_2m) : null,
    forecastMaxTempF: upcomingTemps.length ? Math.round(Math.max(...upcomingTemps)) : null,
    todayHighF: todayHigh != null ? Math.round(todayHigh) : null,
    todayLowF: todayLow != null ? Math.round(todayLow) : null,
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

/**
 * Typed address -> coordinates. This is the fallback when GPS is denied (or
 * the user just wants to type instead), so it needs to resolve a full
 * street address, not just a city name — Open-Meteo's geocoder only indexes
 * place names, which would silently mismatch on "123 Main St, Springfield".
 * Nominatim (OpenStreetMap) does real address-level geocoding and needs no
 * API key, matching this file's "no backend" approach — its usage policy
 * just requires a descriptive User-Agent and no bulk/rapid-fire querying,
 * which a single search-on-submit easily satisfies.
 */
export async function geocodeSearch(query: string): Promise<LocationInfo | null> {
  const data = await getJson(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1`,
    { headers: { 'User-Agent': 'Sprout garden app (local-only, no backend) - github.com/darinavoloshina-eng/sprout' } }
  );
  const top = data?.[0];
  if (!top) return null;
  const addr = top.address ?? {};
  const city: string | undefined = addr.city || addr.town || addr.village || addr.hamlet || addr.county;
  const region: string = addr.state_code || addr.state || '';
  const label = city ? (region && region !== city ? `${city}, ${region}` : city) : top.display_name;
  return {
    lat: Number(top.lat),
    lon: Number(top.lon),
    label,
  };
}
