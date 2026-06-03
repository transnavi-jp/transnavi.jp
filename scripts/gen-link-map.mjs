// Builds dist/link-map.json: the internal-link graph between the site's main
// pages (excludes the many clinic/glossary detail pages). Runs in postbuild so
// it can read the in-content links out of the rendered HTML. The /sitemap/ page
// fetches this and draws an interactive force-directed map (see link-map.js).
import fs from 'node:fs';

// Curated nodes: route -> { label, group }. Pages not listed are left off the
// map (detail pages, legacy redirects) to keep it readable.
const NODES = {
  '/': { label: 'ホーム', group: 'start' },
  '/start/': { label: 'はじめての方へ', group: 'start' },
  '/basics/': { label: '基本のことば', group: 'start' },
  '/gender/': { label: '性別の多様性', group: 'start' },
  '/orientation/': { label: '性的指向', group: 'start' },
  '/dysphoria/': { label: '性別違和', group: 'start' },
  '/learn/': { label: '知る・学ぶ', group: 'start' },
  '/transition/': { label: '性別移行', group: 'medical' },
  '/puberty-blockers/': { label: '思春期ブロッカー', group: 'medical' },
  '/hrt-effects/': { label: 'ホルモンの効果', group: 'medical' },
  '/hrt-medications/': { label: 'ホルモンの薬', group: 'medical' },
  '/fertility/': { label: '妊孕性', group: 'medical' },
  '/voice/': { label: '声', group: 'medical' },
  '/presentation/': { label: '見た目', group: 'medical' },
  '/hair-removal/': { label: '脱毛', group: 'medical' },
  '/surgery/': { label: '手術', group: 'medical' },
  '/support/': { label: '相談先', group: 'support' },
  '/clinics/': { label: '医療機関', group: 'support' },
  '/map/': { label: '地図', group: 'support' },
  '/coming-out/': { label: 'カミングアウト', group: 'society' },
  '/allies/': { label: '周囲の人へ', group: 'society' },
  '/guidelines/': { label: 'SOGIガイドライン', group: 'society' },
  '/safety/': { label: '安全とこころ', group: 'society' },
  '/legal-change/': { label: '戸籍と名前', group: 'society' },
  '/flags/': { label: 'フラッグ', group: 'society' },
  '/pride/': { label: '記念日', group: 'society' },
  '/search/': { label: '検索', group: 'reference' },
  '/glossary/': { label: '用語集', group: 'reference' },
  '/works/': { label: '文芸作品', group: 'reference' },
  '/bibliography/': { label: '文献', group: 'reference' },
  '/resources/': { label: 'リンク', group: 'reference' },
  '/library/': { label: '資料集', group: 'reference' },
  '/about/': { label: 'このサイト', group: 'site' },
  '/data/': { label: 'データ', group: 'site' },
  '/legal/': { label: '掲載方針', group: 'site' },
  '/edit/': { label: '情報を送る', group: 'site' },
  '/sitemap/': { label: 'サイトマップ', group: 'site' },
};

const norm = (h) => {
  h = h.replace(/[#?].*$/, '');
  if (!h.startsWith('/')) return null;
  if (!/\.[a-z0-9]+$/i.test(h) && !h.endsWith('/')) h += '/';
  return h;
};

const pairs = new Set();
for (const route of Object.keys(NODES)) {
  const file = route === '/' ? 'dist/index.html' : `dist${route}index.html`;
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  // Links in the page body (drop the global header/footer and breadcrumb/back-top).
  let main = (html.match(/<main[^>]*>([\s\S]*?)<\/main>/) || [])[1] || '';
  main = main.replace(/<nav class="breadcrumbs"[\s\S]*?<\/nav>/, '').replace(/<a class="back-top"[\s\S]*?<\/a>/, '');
  // The sitemap itself links everywhere; its edges would drown the map.
  if (route === '/sitemap/') continue;
  for (const m of main.matchAll(/href="(\/[^"]*)"/g)) {
    const t = norm(m[1]);
    if (!t || t === route || !NODES[t]) continue;
    // Undirected: store a canonical ordered key so A->B and B->A collapse.
    const key = route < t ? `${route}|${t}` : `${t}|${route}`;
    pairs.add(key);
  }
}

const nodes = Object.entries(NODES).map(([id, n]) => ({ id, label: n.label, group: n.group }));
const links = [...pairs].map((k) => {
  const [source, target] = k.split('|');
  return { source, target };
});

// Optional glossary layer: a small node per term, linked to the article(s) that
// actually reference it in content (the /glossary/ index listing is ignored, or
// it would link every term). Unreferenced terms hang off the /glossary/ hub.
const glossary = JSON.parse(fs.readFileSync('src/data/glossary.json', 'utf8'));
const termLabel = {};
for (const g of glossary) termLabel[`/glossary/${g.id}/`] = g.term;

const termRefs = new Map();
for (const route of Object.keys(NODES)) {
  if (route === '/sitemap/' || route === '/glossary/') continue;
  const file = route === '/' ? 'dist/index.html' : `dist${route}index.html`;
  if (!fs.existsSync(file)) continue;
  let main = (fs.readFileSync(file, 'utf8').match(/<main[^>]*>([\s\S]*?)<\/main>/) || [])[1] || '';
  main = main.replace(/<nav class="breadcrumbs"[\s\S]*?<\/nav>/, '').replace(/<a class="back-top"[\s\S]*?<\/a>/, '');
  for (const m of main.matchAll(/href="(\/glossary\/[^"/]+\/)"/g)) {
    const t = norm(m[1]);
    if (!termLabel[t]) continue;
    if (!termRefs.has(t)) termRefs.set(t, new Set());
    termRefs.get(t).add(route);
  }
}

const terms = [];
const termLinks = [];
for (const [route, label] of Object.entries(termLabel)) {
  const file = `dist${route}index.html`;
  if (!fs.existsSync(file)) continue;
  terms.push({ id: route, label });
  const refs = termRefs.get(route);
  if (refs && refs.size) for (const p of refs) termLinks.push({ source: route, target: p });
  else termLinks.push({ source: route, target: '/glossary/' });
}

fs.writeFileSync('dist/link-map.json', JSON.stringify({ nodes, links, terms, termLinks }));
console.log(`link-map.json: ${nodes.length} nodes, ${links.length} links, ${terms.length} terms, ${termLinks.length} term-links`);
