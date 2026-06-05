// Shared, DOM-free core of the site search: normalisation, the Japanese-aware
// fuzzy matcher, synonym expansion, and the ranking function. It is imported by
// the browser (public/search.js, as a module) AND by the Node evaluation harness
// (scripts/eval-search.mjs), so the offline relevance evaluation scores results
// with the exact same code that ships — no drift between "what we measure" and
// "what users get".

export function norm(s) {
  if (!s) return '';
  s = s.normalize('NFKC').toLowerCase();
  s = s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)); // kana -> hira
  s = s.replace(/[ー゛゜・･\s　.,、。!?！？"'「」『』（）()\[\]【】〜~_\-/]/g, '');
  return s;
}

export function bigrams(s) {
  if (!s) return [];
  if (s.length < 2) return [s];
  const out = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

export function dice(grams, set) {
  if (!grams.length || !set.size) return 0;
  let hit = 0;
  for (const g of grams) if (set.has(g)) hit++;
  return (2 * hit) / (grams.length + set.size);
}

// Query-vocabulary bridges (keys are NFKC+lowercased; values get normalised).
export const SYN = {
  gid: ['性同一性障害', '性別違和', '性別不合'],
  mtf: ['トランス女性', '男性から女性', 'male to female'],
  ftm: ['トランス男性', '女性から男性', 'female to male'],
  srs: ['性別適合手術', '手術', '陰茎反転'],
  hrt: ['ホルモン療法', 'ホルモン'],
  ホルモン: ['hrt', 'エストロゲン', 'テストステロン'],
  トランス: ['トランスジェンダー'],
  ノンバイナリー: ['xジェンダー', 'エックスジェンダー'],
  xジェンダー: ['ノンバイナリー'],
  カミングアウト: ['打ち明け', '告白', 'coming out'],
  ブロッカー: ['思春期ブロッカー', '二次性徴'],
  声: ['ボイス', '音声', 'voice'],
  名前: ['改名', '名の変更'],
  戸籍: ['性別変更', '特例法', '戸籍変更'],
  脱毛: ['ヒゲ', '医療脱毛'],
  病院: ['クリニック', '医療機関'],
  クリニック: ['病院', '医療機関'],
  相談: ['相談先', '窓口', 'ホットライン'],
};

// Synonyms loaded at runtime (the glossary alias cliques from
// dist/search-synonyms.json), merged with the hand-curated SYN above. Lets a
// search for any name of a concept (性自認) also match pages that use another
// (性同一性), so synonymous queries return essentially the same result set.
const EXTRA_SYN = Object.create(null);

export function addSynonyms(map) {
  if (!map) return;
  for (const k of Object.keys(map)) {
    const key = k.normalize('NFKC').toLowerCase();
    EXTRA_SYN[key] = [...new Set([...(EXTRA_SYN[key] || []), ...map[k]])];
  }
}

export function expand(rawTerms) {
  const ex = new Set();
  for (const raw of rawTerms) {
    const key = raw.normalize('NFKC').toLowerCase();
    for (const list of [SYN[key], EXTRA_SYN[key]]) {
      if (list) for (const s of list) ex.add(norm(s));
    }
  }
  return [...ex].filter(Boolean);
}

// Trailing interrogative / boilerplate suffixes people append to a search
// ("性自認とは", "SRSって", "戸籍変更 やり方") that carry no matchable content.
// Stripping them recovers the real keyword. Longest-first so the fullest suffix
// is removed. Tunable + measured by scripts/eval-search.mjs.
const TRAIL = [
  'とはどういう意味',
  'とはなにか',
  'とは何か',
  'ってなに',
  'ってなんですか',
  'とはなに',
  'とは何',
  'の意味は',
  'の意味',
  'の違い',
  'のやり方',
  'やり方',
  'とは',
  'って',
  'ですか',
  'です',
  'なに',
  'まとめ',
  '一覧',
];

// Build the list of normalised query terms, optionally stripping trailing
// boilerplate suffixes (keeping BOTH the original and the trimmed form, so this
// only ever adds recall). Used by search() when { trim: true }.
export function queryTerms(rawTerms, { trim = false } = {}) {
  const set = new Set();
  for (const raw of rawTerms) {
    set.add(raw);
    if (!trim) continue;
    let t = raw;
    let changed = true;
    while (changed) {
      changed = false;
      for (const suf of TRAIL) {
        if (t.length > suf.length + 1 && t.endsWith(suf)) {
          t = t.slice(0, -suf.length);
          set.add(t);
          changed = true;
          break;
        }
      }
    }
  }
  return [...set].map(norm).filter(Boolean);
}

// Pre-normalise the raw search index once into the shape run() scores against.
export function prepare(index) {
  return index.map((e) => {
    const tn = norm(e.t);
    const an = norm(e.a || ''); // entry's own keywords (aliases/readings); high signal
    const xn = norm(e.x);
    return { e, tn, an, xn, tg: new Set(bigrams(tn)), ag: new Set(bigrams(an)), xg: new Set(bigrams(xn)) };
  });
}

// The query-independent importance prior (link-graph PageRank, field `r` on each
// entry). Measured offline (scripts/eval-search.mjs) against the labelled set,
// and the verdict is that it does NOT help this corpus: multiplicatively it is
// inert (steep relevance tiers + a hub-concentrated PageRank), and once glossary
// synonym expansion is added it is net-negative even as a tie-break (it trades
// hit@1 / MRR for a little hit@10). So importance is OFF by default (prWeight 0,
// tieEps 0). The signal (`r`) and both code paths are kept so the eval can keep
// A/B-ing it and we can re-check if the link graph grows. The wins that shipped
// were query trimming (above) and synonym expansion (expand / addSynonyms).
export const PR_WEIGHT = 0.35; // eval-only A/B knob; not applied in production
export const TIE_EPS = 0.05; // eval-only A/B knob; not applied in production

// Rank the prepared index against a query. Options (all overridable so the
// offline eval can A/B them): prWeight = importance-prior strength; trim = strip
// trailing boilerplate suffixes; tieEps = if >0, apply importance as a strict
// tie-break (reorder only results whose relevance scores are within tieEps of
// each other) instead of multiplicatively.
export function search(prep, query, { prWeight = 0, trim = true, tieEps = 0, limit = 50 } = {}) {
  const rawTerms = String(query).trim().split(/[\s　]+/).filter(Boolean);
  if (!rawTerms.length) return [];
  const terms = queryTerms(rawTerms, { trim });
  if (!terms.length) return [];
  const synTerms = expand(rawTerms);

  const out = [];
  for (const p of prep) {
    let rel = 0;
    let matchedTerms = 0;
    for (const t of terms) {
      const tg = bigrams(t);
      let s = 0;
      if (p.tn.includes(t)) s = 120 + t.length * 2;
      else if (p.an.includes(t)) s = 80 + t.length; // alias / reading match beats a body mention
      else if (p.xn.includes(t)) s = 45 + t.length;
      else {
        const dt = dice(tg, p.tg);
        const da = dice(tg, p.ag);
        const dx = dice(tg, p.xg);
        if (dt >= 0.5) s = 34 * dt;
        else if (da >= 0.5) s = 26 * da;
        else if (dx >= 0.5) s = 16 * dx;
        else if (dt >= 0.34 || da >= 0.34 || dx >= 0.34) s = 8 * Math.max(dt, da, dx);
      }
      if (s > 0) matchedTerms++;
      rel += s;
    }
    for (const st of synTerms) {
      if (p.tn.includes(st)) rel += 22;
      else if (p.an.includes(st)) rel += 14;
      else if (p.xn.includes(st)) rel += 9;
    }
    // For multi-word queries, prefer entries matching more of the terms.
    if (terms.length > 1) rel += matchedTerms * 6;
    if (rel > 0) {
      const r = p.e.r || 0;
      // Importance prior: as a soft multiplicative lift (default), or — when
      // tieEps is set — kept separate so it only breaks near-ties.
      const score = tieEps > 0 ? rel : rel * (1 + prWeight * r);
      out.push({ e: p.e, score, rel, r });
    }
  }
  if (tieEps > 0) {
    out.sort((a, b) => (Math.abs(a.rel - b.rel) <= tieEps * Math.max(a.rel, b.rel) ? b.r - a.r : b.rel - a.rel));
  } else {
    out.sort((a, b) => b.score - a.score);
  }
  return out.slice(0, limit);
}
