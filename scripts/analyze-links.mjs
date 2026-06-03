// Internal link-network analyzer. Builds the link graph from the built site and
// reports: orphan pages, weakly-linked pages, dead internal links / broken
// anchors, and OPPORTUNITIES — glossary terms or key pages that are mentioned in
// prose but not linked. Run: `npm run links` (after a build). Also writes
// dist/link-opportunities.json for the link-improvement workflow to act on.
import fs from 'node:fs';
import path from 'node:path';

const DIST = 'dist';

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
const routeOf = (f) => f.replace(/^dist/, '').replace(/index\.html$/, '');
const stripTags = (html) =>
  (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const norm = (h) => {
  h = h.replace(/[#?].*$/, '');
  if (!h.startsWith('/')) return null;
  if (!/\.[a-z0-9]+$/i.test(h) && !h.endsWith('/')) h += '/';
  return h;
};
const isAsset = (h) => /\.(png|svg|jpg|jpeg|webp|ico|xml|txt|json|css|js|woff2?|pdf|mp4|webmanifest)$/i.test(h);

// Pages we treat as "prose" for opportunity scanning + weak-link flags.
const CONTENT = new Set([
  '/start/', '/basics/', '/gender/', '/orientation/', '/dysphoria/', '/transition/',
  '/hrt-effects/', '/hrt-medications/', '/fertility/', '/puberty-blockers/', '/voice/',
  '/presentation/', '/hair-removal/', '/surgery/', '/legal-change/', '/coming-out/',
  '/allies/', '/safety/', '/guidelines/', '/support/', '/about/', '/legal/', '/learn/',
]);
// Distinctive phrases that, when found in another page's prose without a link to
// the target, are good cross-link opportunities.
const PAGE_KEYWORDS = {
  '/guidelines/': ['SOGIガイドライン', '対応ガイドライン', '基本方針とガイドライン'],
  '/support/': ['相談先', '相談窓口', 'ホットライン', 'よりそいホットライン'],
  '/map/': ['地図で探す'],
  '/clinics/': ['医療機関を探す', '医療機関の一覧', '認定施設'],
  '/fertility/': ['妊孕性', '凍結保存'],
  '/surgery/': ['性別適合手術', '移行のための手術'],
  '/legal-change/': ['戸籍', '改名', '特例法'],
  '/safety/': ['安全とこころ', 'アウティング'],
  '/voice/': ['声の手術', '音声外科'],
  '/puberty-blockers/': ['思春期ブロッカー'],
  '/hrt-medications/': ['自己投薬', 'フラホル', '個人輸入'],
  '/glossary/': [],
};

const files = walk(DIST);
const routes = new Set(files.map(routeOf));
const pageExists = (r) => routes.has(r) || fs.existsSync(`dist${r.replace(/\/$/, '')}.html`);

const pages = {};
const anchorIds = {};
for (const f of files) {
  const route = routeOf(f);
  const html = fs.readFileSync(f, 'utf8');
  const allHrefs = new Set();
  for (const m of html.matchAll(/href="(\/[^"]*)"/g)) {
    const h = norm(m[1]);
    // isAsset already drops the /data/*.json dump files; keep the /data/ page.
    if (h && !isAsset(h) && !h.startsWith('/_astro/')) allHrefs.add(h);
  }
  let main = (html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) || [])[1] || '';
  main = main.replace(/<nav class="breadcrumbs"[\s\S]*?<\/nav>/i, ' ').replace(/<a class="back-top"[\s\S]*?<\/a>/i, ' ');
  const contentHrefs = new Set();
  for (const m of main.matchAll(/href="(\/[^"]*)"/g)) {
    const h = norm(m[1]);
    if (h && !isAsset(h)) contentHrefs.add(h);
  }
  pages[route] = {
    route,
    allHrefs,
    contentHrefs,
    glossaryLinks: new Set([...contentHrefs].filter((h) => /^\/glossary\/.+/.test(h))),
    text: stripTags(main),
    fragRefs: [...html.matchAll(/href="#([a-z0-9-]+)"/gi)].map((m) => m[1]),
  };
  anchorIds[route] = new Set([...html.matchAll(/id="([a-z0-9-]+)"/gi)].map((m) => m[1]));
}

// Inbound counts (all, and in-content excluding the sitemap which links everywhere).
const inAll = {}, inContent = {};
for (const r of routes) { inAll[r] = 0; inContent[r] = 0; }
for (const [from, p] of Object.entries(pages)) {
  for (const h of p.allHrefs) if (h !== from && h in inAll) inAll[h]++;
  if (from === '/sitemap/') continue;
  for (const h of p.contentHrefs) if (h !== from && h in inContent) inContent[h]++;
}

const isDetail = (r) => /^\/clinics\/.+\//.test(r) || /^\/glossary\/.+\//.test(r);
const isLegacy = (r) => /^\/articles\//.test(r);

// --- Report ---
const out = (s) => process.stdout.write(s + '\n');
out('\n=== LINK NETWORK ANALYSIS ===\n');

const orphans = [...routes].filter((r) => inAll[r] === 0 && r !== '/' && !isLegacy(r));
out(`Orphan pages (0 inbound links): ${orphans.length}`);
orphans.forEach((r) => out(`  ⚠ ${r}`));
const legacyOrphans = [...routes].filter((r) => inAll[r] === 0 && isLegacy(r));
out(`  (plus ${legacyOrphans.length} intentional /articles/ redirect stubs — ignored)\n`);

const weak = [...routes]
  .filter((r) => !isDetail(r) && !isLegacy(r) && r !== '/' && inContent[r] <= 1)
  .map((r) => ({ r, c: inContent[r] }))
  .sort((a, b) => a.c - b.c);
out(`Weakly-linked pages (≤1 in-content inbound link, i.e. mostly only reachable via global nav):`);
weak.forEach(({ r, c }) => out(`  ${c} in-content ← ${r}`));
out('');

const dead = [];
for (const [from, p] of Object.entries(pages)) {
  for (const h of p.allHrefs) if (!pageExists(h)) dead.push({ from, to: h });
}
out(`Dead internal links: ${dead.length}`);
dead.slice(0, 20).forEach(({ from, to }) => out(`  ✗ ${from} → ${to}`));

let brokenAnchors = 0;
for (const [route, p] of Object.entries(pages)) {
  for (const id of p.fragRefs) if (id !== 'top' && !anchorIds[route].has(id)) { brokenAnchors++; if (brokenAnchors <= 10) out(`  ✗ broken anchor #${id} on ${route}`); }
}
out(`Broken in-page anchors: ${brokenAnchors}\n`);

// --- Opportunities ---
const glossary = JSON.parse(fs.readFileSync('src/data/glossary.json', 'utf8'));
const termMentions = [];
for (const route of CONTENT) {
  const p = pages[route];
  if (!p) continue;
  for (const g of glossary) {
    const target = `/glossary/${g.id}/`;
    if (p.glossaryLinks.has(target)) continue;
    const names = [g.term, g.abbr, ...(g.aliases || [])].filter((n) => n && n.length >= 3);
    const hit = names.find((n) => p.text.includes(n));
    if (hit) termMentions.push({ page: route, termId: g.id, term: g.term, matched: hit });
  }
}
out(`Opportunities — glossary terms mentioned but not linked: ${termMentions.length}`);
const byPage = {};
for (const m of termMentions) (byPage[m.page] = byPage[m.page] || []).push(m.term);
for (const [pg, ts] of Object.entries(byPage).sort((a, b) => b[1].length - a[1].length).slice(0, 12)) {
  out(`  ${pg}: ${ts.slice(0, 8).join('、')}${ts.length > 8 ? ` …他${ts.length - 8}` : ''}`);
}
out('');

const pageMentions = [];
for (const [target, kws] of Object.entries(PAGE_KEYWORDS)) {
  for (const route of CONTENT) {
    if (route === target) continue;
    const p = pages[route];
    if (!p || p.contentHrefs.has(target)) continue;
    const kw = kws.find((k) => p.text.includes(k));
    if (kw) pageMentions.push({ page: route, target, keyword: kw });
  }
}
out(`Opportunities — key pages mentioned but not linked: ${pageMentions.length}`);
const byTarget = {};
for (const m of pageMentions) (byTarget[m.target] = byTarget[m.target] || []).push(m.page);
for (const [t, ps] of Object.entries(byTarget)) out(`  ${t} ← could be linked from: ${ps.join(', ')}`);
out('');

fs.writeFileSync('dist/link-opportunities.json', JSON.stringify({ orphans, weak, dead, termMentions, pageMentions }, null, 2));
out(`(wrote dist/link-opportunities.json — ${termMentions.length} term + ${pageMentions.length} page opportunities)`);
