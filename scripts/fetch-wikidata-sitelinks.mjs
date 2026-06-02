// One-off: add Wikipedia article links (per supported language) to glossary
// entries that have a Wikidata Q-id, using the Wikidata sitelinks API.
// Stores entry.wikipedia = { ja, en, zhHans, zhHant, ko, th, es } (present only).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, 'src/data/glossary.json');
const glossary = JSON.parse(readFileSync(file, 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Map our language keys to Wikipedia editions (wiki dbnames).
const wikis = { ja: 'jawiki', en: 'enwiki', ko: 'kowiki', th: 'thwiki', es: 'eswiki', zh: 'zhwiki' };
const sitefilter = Object.values(wikis).join('|');

// Build a readable Wikipedia URL from a host + article title (spaces -> _,
// percent-encode only the few characters that would break the path).
const enc = (t) => t.replace(/ /g, '_').replace(/\?/g, '%3F').replace(/#/g, '%23').replace(/&/g, '%26');
const url = (host, title) => `https://${host}.wikipedia.org/wiki/${enc(title)}`;

const ids = [...new Set(glossary.filter((e) => e.wikidata).map((e) => e.wikidata))];
const links = {}; // qid -> { ja, en, zhHans, zhHant, ko, th, es }

for (let i = 0; i < ids.length; i += 45) {
  const batch = ids.slice(i, i + 45);
  const api = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${batch.join('|')}&props=sitelinks&sitefilter=${sitefilter}&format=json&origin=*`;
  const res = await fetch(api, { headers: { 'User-Agent': 'transnavi-glossary/1.0 (https://transnavi.jp)' } });
  const data = await res.json();
  for (const [qid, ent] of Object.entries(data.entities ?? {})) {
    const sl = ent.sitelinks ?? {};
    const out = {};
    if (sl.jawiki) out.ja = url('ja', sl.jawiki.title);
    if (sl.enwiki) out.en = url('en', sl.enwiki.title);
    if (sl.kowiki) out.ko = url('ko', sl.kowiki.title);
    if (sl.thwiki) out.th = url('th', sl.thwiki.title);
    if (sl.eswiki) out.es = url('es', sl.eswiki.title);
    if (sl.zhwiki) {
      // One zh article; offer both script variants via the converter path.
      const t = enc(sl.zhwiki.title);
      out.zhHans = `https://zh.wikipedia.org/zh-hans/${t}`;
      out.zhHant = `https://zh.wikipedia.org/zh-hant/${t}`;
    }
    if (Object.keys(out).length) links[qid] = out;
  }
  await sleep(300);
}

let n = 0;
const tally = { ja: 0, en: 0, ko: 0, th: 0, es: 0, zhHans: 0, zhHant: 0 };
for (const e of glossary) {
  if (!e.wikidata || !links[e.wikidata]) continue;
  // Merge, so manually-curated languages Wikidata lacks (e.g. a ja article not
  // sitelinked to this item) are preserved; Wikidata wins where it has a value.
  e.wikipedia = { ...(e.wikipedia || {}), ...links[e.wikidata] };
  n++;
  for (const k of Object.keys(tally)) if (e.wikipedia[k]) tally[k]++;
}

writeFileSync(file, JSON.stringify(glossary, null, 2) + '\n');
console.log(`added wikipedia links to ${n} entries (of ${ids.length} wikidata ids)`);
console.log('per-language:', tally);
