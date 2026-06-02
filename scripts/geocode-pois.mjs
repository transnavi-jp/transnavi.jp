// Geocode a curated set of community centers and events (the "links" and
// "events" map layers) via the GSI address API → src/data/map-pois.json.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// type: 'org' (community centre / trans group) | 'event' (pride event)
const POIS = [
  { name: 'プライドハウス東京レガシー', type: 'org', q: '東京都新宿区新宿1丁目', url: 'https://pridehouse.jp/' },
  { name: 'SHIP（横浜）', type: 'org', q: '神奈川県横浜市', url: 'https://ship.or.jp/' },
  { name: 'L-Port（札幌）', type: 'org', q: '北海道札幌市中央区', url: 'https://l-port.net/' },
  { name: 'PROUD LIFE（名古屋）', type: 'org', q: '愛知県名古屋市', url: 'https://proudlife.org/' },
  { name: 'QWRC（大阪）', type: 'org', q: '大阪府大阪市', url: 'https://qwrc.org/' },
  { name: 'プライドセンター大阪', type: 'org', q: '大阪府大阪市北区天満橋', url: 'https://pridecenter.jp/' },
  { name: 'ピンクドット沖縄', type: 'org', q: '沖縄県那覇市', url: 'https://pinkdot-okinawa.com/' },
  { name: 'G-Front関西 トランスサロン', type: 'org', q: '大阪府大阪市', url: 'http://www5e.biglobe.ne.jp/~gfront/' },
  { name: 'きんきトランス・ミーティング', type: 'org', q: '大阪府大阪市', url: 'https://x.com/kintoramtg' },
  { name: '東京レインボープライド', type: 'event', q: '東京都渋谷区代々木', url: 'https://tokyorainbowpride.com/' },
  { name: '関西レインボーフェスタ', type: 'event', q: '大阪府大阪市', url: '/pride/' },
  { name: 'K.G. Rainbow Week（関西学院大学）', type: 'event', q: '兵庫県西宮市', url: '/pride/' },
];

async function geocode(q) {
  const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'transnavi-geocode/1.0' } });
  if (!res.ok) return null;
  const data = await res.json();
  if (Array.isArray(data) && data[0]?.geometry?.coordinates) {
    const [lng, lat] = data[0].geometry.coordinates;
    return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
  }
  return null;
}

const out = [];
for (const p of POIS) {
  const hit = await geocode(p.q);
  await sleep(150);
  if (hit) out.push({ name: p.name, type: p.type, url: p.url, lat: hit.lat, lng: hit.lng });
  else console.log('FAIL', p.name, p.q);
}
writeFileSync(resolve(root, 'src/data/map-pois.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${out.length} POIs of ${POIS.length}`);
