// Offline relevance evaluation for the site search. Runs the SHIPPED matcher
// (public/search-core.js) over a labelled query→ideal-page set
// (scripts/search-eval-set.json) and reports ranking metrics, sweeping the
// importance-prior weight so we can see whether folding link-graph PageRank into
// the score actually improves alignment with user intent.
//
//   node scripts/eval-search.mjs            # sweep weights, print table
//   node scripts/eval-search.mjs 0.35       # detail (per-query) at one weight vs baseline
//
// Requires a prior `npm run build` so dist/search-index.json carries the `r`
// (PageRank) field. Grades: idealUrl = 3 (the one best page), alsoGood = 1.
import fs from 'node:fs';
import { prepare, search } from '../public/search-core.js';

const index = JSON.parse(fs.readFileSync('dist/search-index.json', 'utf8'));
const judged = JSON.parse(fs.readFileSync('scripts/search-eval-set.json', 'utf8'));
const prep = prepare(index);
const K = 10;

const relOf = (url, q) => (url === q.idealUrl ? 3 : (q.alsoGood || []).includes(url) ? 1 : 0);

function evalQuery(q, opts) {
  const ranked = search(prep, q.query, { ...opts, limit: 50 }).map((r) => r.e.u);
  const idealRank = ranked.indexOf(q.idealUrl) + 1; // 1-based, 0 = not found
  // graded DCG@K vs ideal DCG@K
  let dcg = 0;
  for (let i = 0; i < Math.min(K, ranked.length); i++) {
    const rel = relOf(ranked[i], q);
    if (rel) dcg += (2 ** rel - 1) / Math.log2(i + 2);
  }
  const idealRels = [3, ...(q.alsoGood || []).map(() => 1)].slice(0, K);
  let idcg = 0;
  idealRels.forEach((rel, i) => (idcg += (2 ** rel - 1) / Math.log2(i + 2)));
  return {
    idealRank,
    rr: idealRank ? 1 / idealRank : 0,
    hit1: idealRank === 1 ? 1 : 0,
    hit3: idealRank >= 1 && idealRank <= 3 ? 1 : 0,
    hit10: idealRank >= 1 && idealRank <= 10 ? 1 : 0,
    ndcg: idcg ? dcg / idcg : 0,
  };
}

function aggregate(name, opts) {
  const rows = judged.map((q) => evalQuery(q, opts));
  const n = rows.length;
  const mean = (k) => rows.reduce((s, r) => s + r[k], 0) / n;
  return { name, MRR: mean('rr'), NDCG: mean('ndcg'), hit1: mean('hit1'), hit3: mean('hit3'), hit10: mean('hit10') };
}

const pct = (x) => (x * 100).toFixed(1).padStart(5);

// Configurations to compare. Baseline = the original ranker (no importance, no
// query trimming); the rest layer in the two levers the eval is testing.
const CONFIGS = [
  { name: 'baseline', opts: { prWeight: 0, trim: false, tieEps: 0 } },
  { name: '+trim', opts: { prWeight: 0, trim: true, tieEps: 0 } },
  { name: '+PR(.35)', opts: { prWeight: 0.35, trim: false, tieEps: 0 } },
  { name: '+PR+trim', opts: { prWeight: 0.35, trim: true, tieEps: 0 } },
  { name: 'tie+trim', opts: { prWeight: 0, trim: true, tieEps: 0.05 } },
];

// Sanity: top importance pages.
const top = [...index].filter((e) => e.r != null).sort((a, b) => b.r - a.r).slice(0, 8);
console.log(`Index: ${index.length} entries, ${index.filter((e) => e.r != null).length} with importance prior.`);
console.log(`Top importance (r): ${top.map((e) => `${e.t}=${e.r}`).join('  ')}`);
console.log(`Judged queries: ${judged.length}\n`);

console.log('config   |  MRR  | NDCG@10 | hit@1 | hit@3 | hit@10');
console.log('---------+-------+---------+-------+-------+-------');
for (const c of CONFIGS) {
  const a = aggregate(c.name, c.opts);
  console.log(
    `${c.name.padEnd(8)} | ${pct(a.MRR)} | ${pct(a.NDCG).padStart(7)} | ${pct(a.hit1)} | ${pct(a.hit3)} | ${pct(a.hit10)}`,
  );
}

// Per-query before/after detail: baseline → last config (default +PR+trim).
const detail = CONFIGS.find((c) => c.name === (process.argv[2] || '+PR+trim')) || CONFIGS[3];
console.log(`\nPer-query: ideal-page rank  baseline → ${detail.name}  (lower = better; ∞ = not in top 50)`);
const fmt = (r) => (r ? String(r) : '∞');
const moved = [];
for (const q of judged) {
  const a = evalQuery(q, CONFIGS[0].opts).idealRank;
  const b = evalQuery(q, detail.opts).idealRank;
  const tag = a === b ? '   ' : b && (!a || b < a) ? ' ↑ ' : ' ↓ ';
  if (a !== b) moved.push({ tag });
  if (a !== b) console.log(`  ${tag} ${fmt(a).padStart(2)} → ${fmt(b).padStart(2)}  [${q.kind}] ${q.query}  (→ ${q.idealUrl})`);
}
const up = moved.filter((m) => m.tag === ' ↑ ').length;
const down = moved.filter((m) => m.tag === ' ↓ ').length;
console.log(`\nChanged: ${moved.length}  (improved ${up}, regressed ${down})`);
