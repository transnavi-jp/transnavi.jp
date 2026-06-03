// Pre-build: generate src/data/citations.json (the shape References.astro and
// Cite.astro consume) from the editable Hayagriva source:
//   references.yml      — central bibliography, keyed by citation key
//   citation-pages.yml  — route -> ordered citation keys (order = [n])
// Runs via the npm "prebuild" hook. Edit the YAML, not citations.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import yaml from 'js-yaml';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');
const references = yaml.load(readFileSync(resolve(dir, 'references.yml'), 'utf8'));
const pages = yaml.load(readFileSync(resolve(dir, 'citation-pages.yml'), 'utf8'));

const out = {};
for (const [route, keys] of Object.entries(pages)) {
  out[route] = (keys || []).map((k) => {
    const r = references[k];
    if (!r) throw new Error(`citation-pages.yml: unknown reference key "${k}" on ${route}`);
    return { title: r.title, url: r.url, publisher: r.publisher, lang: r.lang, id: k };
  });
}

writeFileSync(resolve(dir, 'citations.json'), JSON.stringify(out, null, 2) + '\n');
const n = Object.values(out).reduce((a, b) => a + b.length, 0);
console.log(`citations.json: ${Object.keys(out).length} pages, ${n} citations from ${Object.keys(references).length} references`);
