// Builds dist/search-index.json: a compact, client-fetchable index of every
// page, glossary term, clinic, work and resource. Runs in postbuild (after
// `astro build`) so it can read the rendered prose out of the built HTML.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const DIST = 'dist';
const entries = [];

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    if (st.isDirectory()) out.push(...walk(fp));
    else if (name === 'index.html') out.push(fp);
  }
  return out;
}

const stripTags = (html) =>
  (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const routeOf = (file) => file.replace(/^dist/, '').replace(/index\.html$/, '');

const sectionLabel = (route) => {
  if (route === '/') return 'ホーム';
  if (route.startsWith('/clinics')) return '医療機関';
  if (route.startsWith('/glossary')) return '用語集';
  if (route.startsWith('/library')) return '資料';
  if (route.startsWith('/resources')) return 'リンク集';
  if (route.startsWith('/map')) return '地図';
  if (route.startsWith('/support')) return '相談先';
  if (route.startsWith('/works') || route.startsWith('/bibliography')) return '文芸・文献';
  return '解説';
};

// 1. Page entries from built HTML (skip the per-item detail pages — clinics and
//    glossary terms are added below from data, with cleaner titles).
const skip = (route) =>
  route === '/search/' || /^\/clinics\/.+\//.test(route) || /^\/glossary\/.+\//.test(route);

for (const file of walk(DIST)) {
  const route = routeOf(file);
  if (skip(route)) continue;
  const html = fs.readFileSync(file, 'utf8');
  const main = ((html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) || [])[1] || '')
    .replace(/<nav class="breadcrumbs"[\s\S]*?<\/nav>/i, ' ') // drop the breadcrumb echo
    .replace(/<a class="back-top"[\s\S]*?<\/a>/i, ' '); // drop the back-to-top link
  const h1 = stripTags((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');
  const title =
    h1 || stripTags((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/ - とらんすナビ.*$/, '');
  if (!title) continue;
  let text = stripTags(main).replace(/↑\s*ページの先頭へ\s*$/, '').trim();
  entries.push({ u: route, t: title, k: sectionLabel(route), x: text.slice(0, 1600) });
}

// 2. Glossary terms. The entry's own keywords (abbr, aliases, English, and the
//    kanji readings) go in a dedicated `a` field that the matcher scores ABOVE a
//    body-text mention — so searching an alias (性自認) ranks 性同一性 above the
//    pages that merely mention the word in prose. The definition stays in `x`
//    for the result snippet.
const glossary = JSON.parse(fs.readFileSync('src/data/glossary.json', 'utf8'));
const glossaryReadings = JSON.parse(fs.readFileSync('src/data/glossary-readings.json', 'utf8'));
for (const g of glossary) {
  const keywords = [g.abbr, ...(g.aliases || []), g.translations?.en, g.translations?.zhHans, g.term, glossaryReadings[g.id]]
    .filter(Boolean)
    .join(' ');
  entries.push({ u: `/glossary/${g.id}/`, t: g.term, k: '用語', a: keywords, x: (g.notes || '').slice(0, 400) });
}

// 3. Clinics
const clinics = JSON.parse(fs.readFileSync('src/data/clinics.json', 'utf8'));
for (const c of clinics) {
  entries.push({
    u: `/clinics/${c.id}/`,
    t: c.displayName || c.name,
    k: '医療機関',
    x: [c.prefecture, c.city, c.address, (c.services || []).join(' ')].filter(Boolean).join(' '),
  });
}

// 4. Works (link to the work itself; external)
const works = JSON.parse(fs.readFileSync('src/data/works.json', 'utf8'));
for (const w of works) {
  if (!w.url || !w.title) continue;
  entries.push({ u: w.url, t: w.title, k: '文芸作品', x: (w.tags || []).join(' '), ext: true });
}

// 5. Resources (external links, from markdown frontmatter)
for (const f of fs.readdirSync('src/content/resources')) {
  if (!f.endsWith('.md')) continue;
  const raw = fs.readFileSync(`src/content/resources/${f}`, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) continue;
  let fm;
  try {
    fm = yaml.load(m[1]) || {};
  } catch {
    continue;
  }
  if (!fm.url || !fm.title) continue;
  entries.push({
    u: fm.url,
    t: fm.title,
    k: 'リンク',
    x: [fm.description, ...(fm.tags || [])].filter(Boolean).join(' '),
    ext: true,
  });
}

// Attach a query-independent IMPORTANCE prior `r` (0..1) from the link-graph
// PageRank built in gen-link-map (which runs first in postbuild). Normalised by
// the max so the most central page/term is 1.0; entries not in the graph
// (clinics, works, external links) get no `r` and so receive no boost. The
// matcher folds this in multiplicatively, see public/search-core.js.
try {
  const { pagerank } = JSON.parse(fs.readFileSync(`${DIST}/link-map.json`, 'utf8'));
  if (pagerank && Object.keys(pagerank).length) {
    const maxPr = Math.max(...Object.values(pagerank));
    for (const e of entries) {
      const pr = pagerank[e.u];
      if (pr) e.r = Math.round((pr / maxPr) * 1000) / 1000;
    }
  }
} catch (err) {
  console.warn(`search-index: no PageRank prior attached (${err.message})`);
}

fs.writeFileSync(`${DIST}/search-index.json`, JSON.stringify(entries));
const kb = (fs.statSync(`${DIST}/search-index.json`).size / 1024).toFixed(0);
const withR = entries.filter((e) => e.r != null).length;
console.log(`search-index.json: ${entries.length} entries (${withR} with importance prior), ${kb}KB`);
