// Geocodes every city and looks up its frost dates with the app's own
// estimateFrostDates, caching both so pages can be rebuilt offline.
// Run: npx tsx scripts/city-pages/fetch.ts
import fs from 'fs';
import path from 'path';
import { CITIES, STATES, COORD_OVERRIDE } from './cities';
import { estimateFrostDates } from '../../src/api/frost';

const DATA = path.join(__dirname, 'data');
const geoPath = path.join(DATA, 'geo.json');
const frostPath = path.join(DATA, 'frost.json');
const load = (p: string) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {});
const geo: Record<string, { lat: number; lon: number }> = load(geoPath);
const frost: Record<string, unknown> = load(frostPath);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function geocode(name: string, st: string) {
  const key = `${name},${st}`;
  if (COORD_OVERRIDE[key]) return { lat: COORD_OVERRIDE[key][0], lon: COORD_OVERRIDE[key][1] };
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=20&countryCode=US&language=en`);
  const data: any = await res.json();
  const hits = (data.results ?? []).filter((r: any) => r.admin1 === STATES[st]);
  hits.sort((a: any, b: any) => (b.population ?? 0) - (a.population ?? 0));
  if (!hits.length) throw new Error(`no geocode for ${key}`);
  return { lat: Math.round(hits[0].latitude * 1e4) / 1e4, lon: Math.round(hits[0].longitude * 1e4) / 1e4 };
}

(async () => {
  for (const [name, st] of CITIES) {
    const key = `${name},${st}`;
    try {
      if (!geo[key]) { geo[key] = await geocode(name, st); await wait(300); }
      if (!(key in frost) || frost[key] === null) {
        frost[key] = await estimateFrostDates(geo[key].lat, geo[key].lon);
        await wait(6000);
      }
      console.log(key, JSON.stringify(frost[key]));
    } catch (e) {
      console.log('FAIL', key, String(e));
    }
    fs.writeFileSync(geoPath, JSON.stringify(geo, null, 1));
    fs.writeFileSync(frostPath, JSON.stringify(frost, null, 1));
  }
})();
