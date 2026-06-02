// One-time geocoder: add { lat, lng, geoSource } to each clinic in clinics.json
// using the GSI (Geospatial Information Authority of Japan) free address API.
// Tries the full address, then prefecture+city, then prefecture.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, 'src/data/clinics.json');
const clinics = JSON.parse(readFileSync(file, 'utf8'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocode(q) {
  const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'transnavi-geocode/1.0' } });
  if (!res.ok) return null;
  const data = await res.json();
  if (Array.isArray(data) && data[0]?.geometry?.coordinates) {
    const [lng, lat] = data[0].geometry.coordinates;
    return { lat, lng, title: data[0].properties?.title ?? '' };
  }
  return null;
}

// Strip building/floor noise that can confuse the geocoder, keep up to the
// chome-banchi number run.
function cleanAddress(addr) {
  if (!addr) return '';
  const m = addr.match(/^.*?[0-9０-９]+(?:[-‐－ー−]?[0-9０-９]+)*(?:番地?|号|丁目)?/);
  return (m ? m[0] : addr).replace(/\s+/g, '');
}

let ok = 0, fallback = 0, fail = 0;
for (const c of clinics) {
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

  if (hit) {
    c.lat = Number(hit.lat.toFixed(6));
    c.lng = Number(hit.lng.toFixed(6));
    c.geoSource = level;
    if (level === 'address') ok++; else fallback++;
  } else {
    fail++;
    console.log('FAIL', c.id, c.prefecture, c.city, c.address);
  }
}

writeFileSync(file, JSON.stringify(clinics, null, 2) + '\n');
console.log(`done: ${ok} address-level, ${fallback} fallback, ${fail} failed, of ${clinics.length}`);
