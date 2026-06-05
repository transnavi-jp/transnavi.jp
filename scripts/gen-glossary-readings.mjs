// Generate hiragana readings for every glossary term + alias, so the search can
// match a kanji entry typed by its reading (e.g. せいどういつせい → 性同一性).
//
// kana-folding in the matchers already lets katakana terms be found by hiragana,
// but a *kanji* term has no kana to fold — its reading must be precomputed. We
// use kuromoji (as gen-furigana does) and store readings keyed by glossary id in
// src/data/glossary-readings.json (committed, regenerated each prebuild) so both
// the in-page filter (data-search) and the /search/ index can include them.
import fs from 'node:fs';
import kuromoji from 'kuromoji';

const DICT = fs.existsSync('node_modules/kuromoji/dict')
  ? 'node_modules/kuromoji/dict'
  : 'node_modules/kuroshiro-analyzer-kuromoji/dict';
const tokenizer = await new Promise((res, rej) =>
  kuromoji.builder({ dicPath: DICT }).build((e, t) => (e ? rej(e) : res(t))));

const kataToHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

// Best-effort hiragana reading of a string. Tokens without a reading (latin,
// digits, symbols) fall back to their surface form so nothing is dropped.
function readingOf(text) {
  let out = '';
  for (const tk of tokenizer.tokenize(text)) {
    const r = tk.reading && tk.reading !== '*' ? tk.reading : tk.surface_form;
    out += r;
  }
  return kataToHira(out);
}

const KANJI = /[㐀-鿿豈-﫿]/;

// Hand-authored readings for compounds kuromoji mis-reads (kuromoji is the
// default; these override it — same policy as scripts/furigana-readings.json).
const OVERRIDES = {
  'エストラジオール半水和物': 'えすとらじおーるはんすいわぶつ',
};

const glossary = JSON.parse(fs.readFileSync('src/data/glossary.json', 'utf8'));
const readings = {};
for (const g of glossary) {
  const set = new Set();
  for (const raw of [g.term, ...(g.aliases || [])].filter(Boolean)) {
    // Drop （商品名）/(...) parentheticals first — otherwise the 商品名 kanji
    // trips the kanji check and leaks「（しょうひんめい）」into the reading.
    const s = raw.replace(/[（(][^）)]*[）)]/g, '').trim();
    // Only compute a reading when kanji remain; pure kana / latin sources are
    // already covered by the matcher's katakana→hiragana folding.
    if (!s || !KANJI.test(s)) continue;
    const r = OVERRIDES[s] ?? readingOf(s);
    // Keep only clean readings: a leftover latin/digit (e.g. WPATH基準,
    // ダイアン-35) means kuromoji couldn't read part of it — skip rather than
    // pollute the index with a string that can never be matched anyway.
    if (!r || r === s || /[a-z0-9]/i.test(r)) continue;
    set.add(r);
  }
  if (set.size) readings[g.id] = [...set].join(' ');
}

fs.writeFileSync('src/data/glossary-readings.json', JSON.stringify(readings, null, 0) + '\n');
console.log(`glossary readings: ${Object.keys(readings).length} entries with kanji readings`);
