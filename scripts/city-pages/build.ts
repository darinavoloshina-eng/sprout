// Builds docs/planting-calendar/: one page per city with its frost dates
// and planting dates, computed by the app's own engine (plantingGuide.ts)
// from cached frost estimates (fetch.ts). Run: npx tsx scripts/city-pages/build.ts
import fs from 'fs';
import path from 'path';
import { CITIES, STATES, DISPLAY } from './cities';
import { plantingWindowsFor, parseMonthDay } from '../../src/engines/plantingGuide';
import { cropLabel } from '../../src/cropMeta';
import { CropKey } from '../../src/engines/scheduleEngine';
import { FrostEstimate } from '../../src/types';

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'docs', 'planting-calendar');
const SITE = 'https://gardenwise.io';
const APP_URL = 'https://apps.apple.com/us/app/id6817450373';
const YEAR = 2027;

const CROPS: CropKey[] = ['tomatoes', 'peppers', 'eggplant', 'cucumbers', 'zucchini', 'squash', 'pumpkin', 'watermelon',
  'cantaloupe', 'corn', 'beans', 'peas', 'okra', 'sweetpotatoes', 'potatoes', 'lettuce', 'spinach', 'arugula', 'kale',
  'broccoli', 'cabbage', 'cauliflower', 'carrots', 'beets', 'radishes', 'onions', 'garlic', 'basil', 'cilantro', 'strawberries'];

const frostData: Record<string, FrostEstimate | null> = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'frost.json'), 'utf8'));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const md = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;
const mdShort = (d: Date) => `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const lower = (c: CropKey) => cropLabel(c).toLowerCase();
const slugOf = (name: string, st: string) => `${(DISPLAY[name] ?? name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${st.toLowerCase()}`;

interface CropRow { crop: CropKey; indoor: Date | null; outdoor: Date | null; fall: Date | null; fallUntil: Date | null }
interface City { name: string; st: string; slug: string; frost: FrostEstimate; rows: CropRow[]; seasonDays: number | null; mild: boolean }

function rowsFor(fd: FrostEstimate): CropRow[] {
  return CROPS.map((crop) => {
    const wins = plantingWindowsFor(crop, fd, new Date(YEAR, 0, 1));
    const spring = wins.find((w) => w.season === 'spring' && w.outdoorDate.getFullYear() === YEAR);
    const fall = wins.find((w) => w.season === 'fall' && w.outdoorDate.getFullYear() === YEAR);
    return { crop, indoor: spring?.indoorDate ?? null, outdoor: spring?.outdoorDate ?? null, fall: fall?.outdoorDate ?? null, fallUntil: fall?.until ?? null };
  }).filter((r) => r.outdoor || r.fall);
}

const cities: City[] = [];
const skipped: string[] = [];
for (const [name, st] of CITIES) {
  const fd = frostData[`${name},${st}`];
  // Frost-free most years: frost-anchored dates would mislead.
  // Frost-free most years (no frost, only a very early last frost, or a
  // "first" and "last" frost that are really the same rare cold morning):
  // frost-anchored dates would mislead.
  const rare = !fd || fd.lastFrostMonthDay < '01-20' ||
    (fd.firstFrostMonthDay != null && fd.firstFrostMonthDay < '04-01' && fd.firstFrostMonthDay >= fd.lastFrostMonthDay);
  if (rare) { skipped.push(`${name}, ${st}`); continue; }
  const last = parseMonthDay(fd.lastFrostMonthDay, YEAR);
  let first = fd.firstFrostMonthDay ? parseMonthDay(fd.firstFrostMonthDay, YEAR) : null;
  if (first && first < last) first = parseMonthDay(fd.firstFrostMonthDay!, YEAR + 1);
  const seasonDays = first ? Math.round((first.getTime() - last.getTime()) / 86400000) : null;
  const mild = !first || first.getFullYear() > YEAR;
  cities.push({ name: DISPLAY[name] ?? name, st, slug: slugOf(name, st), frost: fd, rows: rowsFor(fd), seasonDays, mild });
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function intro(c: City): string[] {
  const last = parseMonthDay(c.frost.lastFrostMonthDay, YEAR);
  const first = c.frost.firstFrostMonthDay ? parseMonthDay(c.frost.firstFrostMonthDay, YEAR) : null;
  const where = `${c.name}, ${c.st}`;
  const r = (k: CropKey) => c.rows.find((x) => x.crop === k);
  const tom = r('tomatoes'), gar = r('garlic'), pep = r('peppers');
  const firstIndoor = c.rows.filter((x) => x.indoor).sort((a, b) => a.indoor!.getTime() - b.indoor!.getTime())[0];
  const p: string[] = [];
  const frostLine = first
    ? c.mild
      ? `In ${where}, the last spring frost usually comes around <strong>${md(last)}</strong>, and the first frost of winter often holds off until around <strong>${md(first)}</strong>.`
      : `In ${where}, the last spring frost usually comes around <strong>${md(last)}</strong> and the first fall frost around <strong>${md(first)}</strong>, giving you about <strong>${c.seasonDays} frost-free days</strong>.`
    : `In ${where}, the last spring frost usually comes around <strong>${md(last)}</strong>, and a hard frost in fall is rare.`;
  let shape: string;
  if (c.mild) shape = `That's a mild climate, which changes the calendar: frost is brief, so cool-season crops like lettuce, kale and broccoli do their best work in fall and winter, while warm-season crops get a long run from spring into fall.`;
  else if (c.seasonDays! < 140) shape = `That's a short season, so a head start matters. Starting seeds indoors gives slow crops like peppers and tomatoes time to ripen before fall, and faster-maturing varieties are worth choosing when you can.`;
  else if (c.seasonDays! < 200) shape = `That's enough for a full summer of tomatoes, squash and beans, plus a fall round of cool-season crops if you sow them by late summer.`;
  else shape = `That's a long season with room for two gardens: cool-season crops in spring, warm-season crops through summer, and a second planting of greens and roots for fall.`;
  p.push(`${frostLine} ${shape}`);
  const bits: string[] = [];
  if (firstIndoor) bits.push(`Your first seeds go in indoors around <strong>${md(firstIndoor.indoor!)}</strong> (${lower(firstIndoor.crop)})`);
  if (pep?.indoor) bits.push(`peppers follow around ${md(pep.indoor)}`);
  if (tom?.outdoor) bits.push(`tomatoes go outside around <strong>${md(tom.outdoor)}</strong>, once the soil has warmed`);
  let second = bits.length ? `${list(bits)}.` : '';
  if (gar?.fall) second += ` Garlic goes in around ${md(gar.fall)} for next summer's harvest.`;
  p.push(second.trim());
  return p;
}

function table(c: City): string {
  const rows = [...c.rows].sort((a, b) => ((a.indoor ?? a.outdoor ?? a.fall)!.getTime() - (b.indoor ?? b.outdoor ?? b.fall)!.getTime()));
  const td = (d: Date | null, alt = '–') => (d ? mdShort(d) : alt);
  const fallCell = (r: CropRow) => (r.fall ? (r.fallUntil ? `${mdShort(r.fall)} to ${mdShort(r.fallUntil)}` : mdShort(r.fall)) : '–');
  return rows.map((r) => `      <tr><td>${cropLabel(r.crop)}</td><td>${r.indoor ? td(r.indoor) : r.outdoor ? 'Sow outside' : '–'}</td><td>${td(r.outdoor)}</td><td>${fallCell(r)}</td></tr>`).join('\n');
}

function monthly(c: City): string {
  const ev: { d: Date; kind: 'indoor' | 'out' | 'fall'; crop: CropKey }[] = [];
  for (const r of c.rows) {
    if (r.indoor) ev.push({ d: r.indoor, kind: 'indoor', crop: r.crop });
    if (r.outdoor) ev.push({ d: r.outdoor, kind: 'out', crop: r.crop });
    if (r.fall) ev.push({ d: r.fall, kind: 'fall', crop: r.crop });
  }
  const label = { indoor: 'Start indoors', out: 'Plant or sow outside', fall: c.mild ? 'Plant for fall and winter' : 'Plant for fall' };
  const out: string[] = [];
  for (let m = 0; m < 12; m++) {
    const inMonth = ev.filter((e) => e.d.getMonth() === m).sort((a, b) => a.d.getTime() - b.d.getTime());
    if (!inMonth.length) continue;
    const lines = (['indoor', 'out', 'fall'] as const).map((k) => {
      const items = inMonth.filter((e) => e.kind === k);
      if (!items.length) return '';
      return `<li><strong>${label[k]}:</strong> ${items.map((e) => `${lower(e.crop)} (${mdShort(e.d)})`).join(', ')}</li>`;
    }).filter(Boolean).join('');
    out.push(`  <h3>${MONTHS[m]}</h3>\n  <ul>${lines}</ul>`);
  }
  return out.join('\n');
}

function faqs(c: City): { q: string; a: string }[] {
  const where = `${c.name}, ${c.st}`;
  const last = parseMonthDay(c.frost.lastFrostMonthDay, YEAR);
  const first = c.frost.firstFrostMonthDay ? parseMonthDay(c.frost.firstFrostMonthDay, YEAR) : null;
  const tom = c.rows.find((r) => r.crop === 'tomatoes');
  const fallCrops = c.rows.filter((r) => r.fall && r.crop !== 'garlic').sort((a, b) => a.fall!.getTime() - b.fall!.getTime());
  const out = [{ q: `When is the last frost in ${where}?`, a: `Around ${md(last)} on average, based on the last ten years of daily temperature records. Any given year can run a week or two either way, so keep an eye on the forecast before planting frost-tender crops.` }];
  if (first) out.push({ q: `When is the first frost in ${where}?`, a: `Around ${md(first)} on average. Cover or harvest tender crops like tomatoes, peppers and basil before then.` });
  if (tom?.outdoor) out.push({ q: `When should I plant tomatoes in ${where}?`, a: `Start tomato seeds indoors around ${md(tom.indoor ?? tom.outdoor)} and plant them outside around ${md(tom.outdoor)}, after the last frost, when nights stay above about 50°F.` });
  if (fallCrops.length) out.push({ q: `Can I grow a fall garden in ${where}?`, a: `Yes. Cool-season crops do well planted in late summer and fall: ${list(fallCrops.slice(0, 4).map((r) => `${lower(r.crop)} around ${md(r.fall!)}`))}.` });
  return out;
}

const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const blogPage = read('docs/blog/when-to-start-seeds-indoors.html');
const HEAD_ASSETS = blogPage.slice(blogPage.indexOf('<link rel="icon"'), blogPage.indexOf('<script type="application/ld+json">'));
const HEADER = blogPage.slice(blogPage.indexOf('<header class="site-header">'), blogPage.indexOf('</header>') + 9).replace(' aria-current="page"', '');
const FOOTER = blogPage.slice(blogPage.indexOf('<footer class="site-footer">'), blogPage.indexOf('</body>'))
  .replace('<a href="/blog/">Blog</a>', '<a href="/blog/">Blog</a> · <a href="/planting-calendar/">Planting calendars</a>')
  .replace('<div class="copy affiliate">', '<div class="copy">Weather data by <a href="https://open-meteo.com/" rel="noopener">Open-Meteo.com</a></div>\n  <div class="copy affiliate">');

function page(opts: { title: string; desc: string; url: string; jsonld: object[]; body: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="apple-itunes-app" content="app-id=6817450373">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.desc)}">
<link rel="canonical" href="${opts.url}">
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.desc)}">
<meta property="og:type" content="article">
${HEAD_ASSETS}${opts.jsonld.map((j) => `<script type="application/ld+json">\n${JSON.stringify(j)}\n</script>`).join('\n')}
</head>
<body>

${HEADER}
${opts.body}
${FOOTER}</body>
</html>
`;
}

const ctaBox = (where: string) => `  <div class="cta-box">
    <div class="eyebrow">GardenWise</div>
    <h3>Your dates, for your exact backyard</h3>
    <p>These dates are for ${where} as a whole. GardenWise works them out for your exact address, tells you what to plant now, and reminds you when each job is due, from starting seeds to the first harvest.</p>
    <a class="btn-primary" href="${APP_URL}">Download GardenWise free →</a>
  </div>`;

fs.mkdirSync(OUT, { recursive: true });
for (const c of cities) {
  const where = `${c.name}, ${c.st}`;
  const url = `${SITE}/planting-calendar/${c.slug}.html`;
  const last = parseMonthDay(c.frost.lastFrostMonthDay, YEAR);
  const first = c.frost.firstFrostMonthDay ? parseMonthDay(c.frost.firstFrostMonthDay, YEAR) : null;
  const q = faqs(c);
  const neighbors = cities.filter((o) => o.st === c.st && o.slug !== c.slug);
  const title = `When to Plant Vegetables in ${where}: Planting Calendar`;
  const desc = `${c.name}'s last frost is around ${md(last)}. When to start seeds and plant ${c.rows.length} vegetables, herbs and fruits, with dates from local frost history.`;
  const body = `<section class="article-hero">
  <div class="wrap">
    <a class="back-link" href="/planting-calendar/">‹ Planting calendars</a>
    <div class="article-meta">${STATES[c.st].toUpperCase()} · PLANTING CALENDAR</div>
    <h1>When to Plant Vegetables in ${where}</h1>
    <p class="article-dek">Seed-starting and planting dates for ${c.rows.length} vegetables, herbs and fruits, worked out from ${c.name}'s real frost history.</p>
  </div>
</section>

<article class="post-body">
  <div class="frost-facts">
    <div><span>Last spring frost</span><strong>${mdShort(last)}</strong></div>
    <div><span>First ${c.mild ? 'winter' : 'fall'} frost</span><strong>${first ? mdShort(first) : 'Rare'}</strong></div>
    <div><span>Frost-free days</span><strong>${c.seasonDays ?? 'Most of the year'}</strong></div>
  </div>
${intro(c).map((p) => `  <p>${p}</p>`).join('\n')}

  <a class="cta-slim" href="${APP_URL}">
    <span><strong>Never miss a planting date in ${c.name}.</strong> GardenWise reminds you the day each one is due, timed to your exact backyard.</span>
    <span class="cta-slim-btn">Get the free app</span>
  </a>

  <h2>Planting dates for ${c.name}</h2>
  <div class="table-wrap">
  <table class="timing-table city-table">
    <thead><tr><th>Crop</th><th>Start indoors</th><th>Plant outside</th><th>Fall planting</th></tr></thead>
    <tbody>
${table(c)}
    </tbody>
  </table>
  </div>
  <p class="table-note">Dates are targets, not deadlines. A week either way is fine. "Sow outside" means the crop does best sown straight into the garden.</p>

${ctaBox(where)}

  <h2>${c.name} planting calendar, month by month</h2>
${monthly(c)}

  <h2>Common questions</h2>
${q.map((f) => `  <h3>${f.q}</h3>\n  <p>${f.a}</p>`).join('\n')}

  <p class="table-note">How these dates are worked out: the last and first frost are averages over the last ten years of the days the temperature near ${c.name} dropped to 34°F or below, from Open-Meteo's historical weather records. We count 34°F rather than 32°F because frost forms in the coldest spots of a garden before the wider area reads freezing. Each crop's dates count forward or back from those frosts, the same way the GardenWise app does. New to starting seeds? Read <a href="/blog/when-to-start-seeds-indoors.html">When to Start Seeds Indoors</a>.</p>
</article>

<div class="related">
  <h3>${neighbors.length ? `More planting calendars in ${STATES[c.st]}` : 'More planting calendars'}</h3>
  <div class="related-links">
${(neighbors.length ? neighbors : cities.filter((o) => o.slug !== c.slug).slice(0, 4)).map((o) => `    <a href="/planting-calendar/${o.slug}.html">When to plant vegetables in ${o.name}, ${o.st}</a>`).join('\n')}
    <a href="/planting-calendar/">All planting calendars</a>
  </div>
</div>
`;
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: title, datePublished: '2026-11-12', author: { '@type': 'Organization', name: 'GardenWise' } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'GardenWise', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Planting calendars', item: `${SITE}/planting-calendar/` },
      { '@type': 'ListItem', position: 3, name: where, item: url }] },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: q.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ];
  fs.writeFileSync(path.join(OUT, `${c.slug}.html`), page({ title, desc, url, jsonld, body }));
}

// Index, grouped by state.
const byState = Object.keys(STATES).filter((st) => cities.some((c) => c.st === st));
const indexBody = `<section class="article-hero">
  <div class="wrap">
    <div class="article-meta">PLANTING CALENDARS</div>
    <h1>When to Plant Vegetables: Planting Calendars by City</h1>
    <p class="article-dek">Frost dates and planting dates for ${cities.length} US cities, worked out from each city's real frost history instead of a hardiness zone. Find yours below.</p>
  </div>
</section>

<article class="post-body">
  <p>Planting by the calendar month only works if your spring arrives on schedule. These calendars start from each city's average last and first frost, then count forward and back for ${CROPS.length} common crops: when to start seeds indoors, when to plant outside, and what to plant again for fall.</p>
${byState.map((st) => `  <h2 id="${st.toLowerCase()}">${STATES[st]}</h2>\n  <ul class="city-list">${cities.filter((c) => c.st === st).map((c) => `<li><a href="/planting-calendar/${c.slug}.html">${c.name}</a></li>`).join('')}</ul>`).join('\n')}

${ctaBox('each city')}
</article>
`;
fs.writeFileSync(path.join(OUT, 'index.html'), page({
  title: 'Planting Calendars by City: When to Plant Vegetables',
  desc: `When to start seeds and plant vegetables in ${cities.length} US cities, from each city's real frost history.`,
  url: `${SITE}/planting-calendar/`,
  jsonld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Planting calendars by city' }],
  body: indexBody,
}));

// Sitemap: keep existing entries, replace the planting-calendar ones.
const smPath = path.join(ROOT, 'docs', 'sitemap.xml');
const sm = fs.readFileSync(smPath, 'utf8').split('\n').filter((l) => !l.includes('/planting-calendar/'));
const end = sm.findIndex((l) => l.includes('</urlset>'));
sm.splice(end, 0, `  <url><loc>${SITE}/planting-calendar/</loc></url>`, ...cities.map((c) => `  <url><loc>${SITE}/planting-calendar/${c.slug}.html</loc></url>`));
fs.writeFileSync(smPath, sm.join('\n'));

console.log(`built ${cities.length} city pages; skipped (frost-free or no data): ${skipped.join('; ') || 'none'}`);
