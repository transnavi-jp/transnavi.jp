// Post-build: publish the site's structured data as downloadable JSON under
// /data/, so anyone can reuse it (within the CC BY-SA 4.0 content license).
// Writes one file per dataset plus a combined transnavi-data.json.
// Runs after gen-llms.mjs via the npm "postbuild" hook. Deterministic (no
// timestamps) so rebuilds don't churn.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = resolve(root, 'src/data');
const outDir = resolve(root, 'dist/data');
mkdirSync(outDir, { recursive: true });

const read = (name) => JSON.parse(readFileSync(resolve(dataDir, name), 'utf8'));

// Public datasets to publish. key = filename under /data/, value = source file.
const datasets = {
  glossary: 'glossary.json',
  clinics: 'clinics.json',
  works: 'works.json',
  bibliography: 'bibliography.json',
  organizations: 'organizations.json',
  'map-pois': 'map-pois.json',
  citations: 'citations.json',
};

const loaded = {};
for (const [key, file] of Object.entries(datasets)) {
  const json = read(file);
  loaded[key] = json;
  writeFileSync(resolve(outDir, `${key}.json`), JSON.stringify(json, null, 2) + '\n');
}

const count = (v) => {
  if (Array.isArray(v)) return v.length;
  if (v && Array.isArray(v.sections)) {
    return v.sections.reduce((n, s) => n + (s.groups || []).reduce((m, g) => m + (g.items || []).length, 0), 0);
  }
  if (v && typeof v === 'object') return Object.keys(v).length;
  return null;
};

const combined = {
  meta: {
    name: 'とらんすナビ / transnavi.jp',
    url: 'https://transnavi.jp',
    description:
      '日本で暮らすトランスジェンダー・ノンバイナリー・ジェンダーに悩む人のための、やさしい情報サイトの構造化データ。',
    license: {
      content: 'CC BY-SA 4.0',
      content_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
      code: 'MIT',
    },
    attribution: 'とらんすナビ (transnavi.jp)',
    source: 'https://github.com/transnavi/transnavi.jp',
    note: '医療・法律・安全に関わる情報は、必ず各機関の最新の公式情報で確認してください。',
    datasets: Object.fromEntries(Object.keys(datasets).map((k) => [k, count(loaded[k])])),
  },
  glossary: loaded.glossary,
  clinics: loaded.clinics,
  works: loaded.works,
  bibliography: loaded.bibliography,
  organizations: loaded.organizations,
  map_pois: loaded['map-pois'],
  citations: loaded.citations,
};
writeFileSync(resolve(outDir, 'transnavi-data.json'), JSON.stringify(combined, null, 2) + '\n');

const files = Object.keys(datasets).length + 1;
console.log(`data dump: ${files} files written to /data/ (${combined.meta.datasets.glossary} glossary, ${combined.meta.datasets.clinics} clinics, ${combined.meta.datasets.works} works)`);
