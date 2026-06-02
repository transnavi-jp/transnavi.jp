// One-off: add Korean (ko) and Thai (th) translations to glossary entries that
// have a Wikidata Q-id, by pulling the labels from the Wikidata API.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, 'src/data/glossary.json');
const glossary = JSON.parse(readFileSync(file, 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ids = [...new Set(glossary.filter((e) => e.wikidata).map((e) => e.wikidata))];
const labels = {}; // qid -> { ko, th }

for (let i = 0; i < ids.length; i += 45) {
  const batch = ids.slice(i, i + 45);
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${batch.join('|')}&props=labels&languages=ko|th&format=json&origin=*`;
  const res = await fetch(url, { headers: { 'User-Agent': 'transnavi-glossary/1.0 (https://transnavi.jp)' } });
  const data = await res.json();
  for (const [qid, ent] of Object.entries(data.entities ?? {})) {
    labels[qid] = {
      ko: ent.labels?.ko?.value ?? null,
      th: ent.labels?.th?.value ?? null,
    };
  }
  await sleep(300);
}

let ko = 0, th = 0;
for (const e of glossary) {
  if (!e.wikidata || !labels[e.wikidata]) continue;
  const { ko: k, th: t } = labels[e.wikidata];
  if (k) { e.translations.ko = k; ko++; }
  if (t) { e.translations.th = t; th++; }
}

writeFileSync(file, JSON.stringify(glossary, null, 2) + '\n');
console.log(`added ko to ${ko} entries, th to ${th} entries (of ${ids.length} wikidata ids)`);
