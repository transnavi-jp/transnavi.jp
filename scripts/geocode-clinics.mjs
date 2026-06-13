// Incremental geocoder: fill/upgrade { lat, lng, geoSource } on clinics in
// clinics.json using the GSI (Geospatial Information Authority of Japan) free
// address API. Tries the full address, then prefecture+city, then prefecture.
//
// Safe to re-run: OVERSEAS clinics (a `country` field) are skipped entirely —
// GSI only resolves Japanese addresses and would otherwise wipe their coords.
// Domestic clinics already at street-level ('address') are also skipped unless
// `--force`, so a normal run only fills gaps and upgrades centroid pins.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, 'src/data/clinics.json');
const clinics = JSON.parse(readFileSync(file, 'utf8'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Resilient single query: retry a few times on transient network/HTTP errors
// with backoff, so one hiccup doesn't abort a whole --force run. Returns null
// when the address can't be resolved (distinct from a thrown error).
async function geocode(q) {
  const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'transnavi-geocode/1.0' } });
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) { await sleep(800 * (attempt + 1)); continue; }
        return null;
      }
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.geometry?.coordinates) {
        const [lng, lat] = data[0].geometry.coordinates;
        return { lat, lng, title: data[0].properties?.title ?? '' };
      }
      return null;
    } catch {
      await sleep(800 * (attempt + 1)); // transient network error — back off and retry
    }
  }
  return null;
}

// Strip building/floor noise that can confuse the geocoder, keep up to the
// chome-banchi number run.
function cleanAddress(addr) {
  if (!addr) return '';
  // Drop a leading 〒postal-code (e.g. 「〒543-0031 」) first — otherwise the
  // number-run matcher below grabs the postal code instead of the 丁目・番地.
  const body = addr.replace(/^\s*〒?\s*[0-9０-９]{3}[-‐－ー−]?[0-9０-９]{4}\s*/, '');
  const m = body.match(/^.*?[0-9０-９]+(?:[-‐－ー−]?[0-9０-９]+)*(?:番地?|号|丁目)?/);
  return (m ? m[0] : body).replace(/\s+/g, '');
}

const force = process.argv.includes('--force');
let ok = 0, fallback = 0, fail = 0, skipped = 0;
for (const c of clinics) {
  // Never geocode overseas facilities with the Japan-only GSI API.
  if (c.country) { skipped++; continue; }
  // Skip clinics already pinned to a street address unless forced.
  if (!force && c.geoSource === 'address') { skipped++; continue; }

  const candidates = [
    cleanAddress(c.address),
    c.address,
    [c.prefecture, c.city].filter(Boolean).join(''),
    c.prefecture,
  ].filter(Boolean);

  let hit = null, level = '';
  for (const [i, q] of candidates.entries()) {
    hit = await geocode(q);
    await sleep(120);
    if (hit) { level = i <= 1 ? 'address' : i === 2 ? 'city' : 'prefecture'; break; }
  }

  const hadCoords = typeof c.lat === 'number' && typeof c.lng === 'number';
  // Only upgrade to street-level, or fill a clinic that had no pin at all —
  // never downgrade an existing city pin to a (re-resolved) coarser one.
  if (hit && (level === 'address' || !hadCoords)) {
    c.lat = Number(hit.lat.toFixed(6));
    c.lng = Number(hit.lng.toFixed(6));
    c.geoSource = level;
    if (level === 'address') ok++; else fallback++;
  } else if (!hit && !hadCoords) {
    fail++;
    console.log('FAIL', c.id, c.prefecture, c.city, c.address);
  } else {
    skipped++; // kept existing pin (no better result)
  }
}

writeFileSync(file, JSON.stringify(clinics, null, 2) + '\n');
console.log(`done: ${ok} upgraded to address-level, ${fallback} centroid-filled, ${fail} failed, ${skipped} skipped/kept, of ${clinics.length}`);
