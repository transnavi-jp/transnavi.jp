// Citation coverage report: for each article that has a References list, show
// how many references are defined, how many inline <Cite> ranges/points exist,
// which references are cited inline vs. orphaned, and any broken Cite keys.
// Run: node scripts/citation-coverage.mjs   (or: npm run coverage)
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const citations = JSON.parse(readFileSync(resolve(root, 'src/data/citations.json'), 'utf8'));
const pagesDir = resolve(root, 'src/pages');

// route ("/dysphoria/") -> .astro file that renders it.
const routeFile = {};
function walk(dir, base = '') {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, `${base}/${e.name}`);
    else if (e.name.endsWith('.astro')) {
      const name = e.name.replace(/\.astro$/, '');
      const route = name === 'index' ? `${base}/` : `${base}/${name}/`;
      routeFile[route] = p;
    }
  }
}
walk(pagesDir);

// Pull inline citation keys/numbers from a page's source.
function inlineCites(src, refs) {
  const cited = new Set(); // resolved 1-based numbers
  let count = 0, ranges = 0, dynamic = 0, broken = [];
  const idIndex = new Map(refs.map((r, i) => [r.id, i + 1]));
  const addKey = (k) => (idIndex.has(k) ? cited.add(idIndex.get(k)) : broken.push(k));
  for (const m of src.matchAll(/<Cite\b([^>]*?)(\/>|>)/g)) {
    count++;
    const attrs = m[1];
    const isRange = m[2] === '>'; // has children (wrapping a span)
    if (isRange) ranges++;
    // src="key" | src={['a','b']} | src={item.cite} (data-driven)
    const srcM = attrs.match(/\bsrc=(?:"([^"]+)"|\{([^}]+)\})/);
    if (srcM) {
      if (srcM[1] != null) addKey(srcM[1]); // src="key" — always a literal
      else {
        const quoted = srcM[2].match(/['"]([^'"]+)['"]/g)?.map((s) => s.slice(1, -1));
        if (quoted) quoted.forEach(addKey);
        else dynamic++; // src={item.cite} — keys live in the page's data literals
      }
    }
    const nM = attrs.match(/\bn=\{?\s*\[?([0-9,\s]+)\]?\s*\}?/);
    if (nM) for (const num of nM[1].split(',').map((s) => Number(s.trim())).filter(Boolean)) cited.add(num);
  }
  // A dynamic src (e.g. <Cite src={item.cite} />) means the keys are declared in
  // the page's own data literals — resolve `cite: ['a', 'b']` / `cite: 'a'` there.
  if (dynamic) {
    for (const m of src.matchAll(/\bcite:\s*(\[[^\]]*\]|'[^']*'|"[^"]*")/g)) {
      for (const k of m[1].match(/['"]([^'"]+)['"]/g)?.map((s) => s.slice(1, -1)) ?? []) addKey(k);
    }
  }
  return { count, ranges, cited, broken };
}

const rows = [];
for (const [route, refs] of Object.entries(citations)) {
  const file = routeFile[route];
  const src = file ? readFileSync(file, 'utf8') : '';
  const { count, ranges, cited, broken } = inlineCites(src, refs);
  const unused = refs.map((r, i) => i + 1).filter((n) => !cited.has(n));
  rows.push({ route, defined: refs.length, cites: count, ranges, citedCount: cited.size, unused, broken });
}
rows.sort((a, b) => a.citedCount / (a.defined || 1) - b.citedCount / (b.defined || 1));

const pad = (s, n) => String(s).padEnd(n);
console.log('\n  Citation coverage (inline <Cite> vs. references defined)\n');
console.log(`  ${pad('route', 22)}${pad('refs', 6)}${pad('cites', 7)}${pad('ranges', 8)}${pad('refs cited', 11)}cover`);
console.log('  ' + '-'.repeat(62));
for (const r of rows) {
  const cover = r.defined ? Math.round((r.citedCount / r.defined) * 100) : 0;
  const bar = cover === 0 ? '·· none' : `${cover}%`;
  console.log(`  ${pad(r.route, 22)}${pad(r.defined, 6)}${pad(r.cites, 7)}${pad(r.ranges, 8)}${pad(r.citedCount, 11)}${bar}`);
  if (r.broken.length) console.log(`  ${pad('', 22)}⚠ broken keys: ${r.broken.join(', ')}`);
}
const noInline = rows.filter((r) => r.cites === 0).map((r) => r.route);
const totalRefs = rows.reduce((n, r) => n + r.defined, 0);
const totalCited = rows.reduce((n, r) => n + r.citedCount, 0);
console.log('\n  Summary');
console.log(`  - articles with references: ${rows.length}`);
console.log(`  - articles with inline citations: ${rows.length - noInline.length}`);
console.log(`  - references inline-cited: ${totalCited}/${totalRefs} (${Math.round((totalCited / totalRefs) * 100)}%)`);
if (noInline.length) console.log(`  - still page-level only (no inline cites yet): ${noInline.join(', ')}`);
const anyBroken = rows.flatMap((r) => r.broken);
if (anyBroken.length) console.log(`  - ⚠ broken Cite keys: ${anyBroken.length}`);
console.log('');
