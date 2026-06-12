// Furigana layer: annotate the <main> prose of the main reading pages with
// <ruby> readings (kanji only), so a header toggle can reveal ふりがな for younger
// readers. Hidden by default in CSS; the toggle sets data-furigana on <html>.
//
// Uses kuromoji directly (not kuroshiro) and builds the ruby by hand: kuroshiro
// crashes on any token with an undefined reading (HRT, DSD, numbers, ・…) and
// silently drops the whole sentence. Here we skip such tokens and ruby-wrap only
// kanji runs, aligning the reading over the kanji (stripping shared okurigana).
//
// Runs in postbuild (needs dist HTML). Only the <main> fragment is reparsed and
// string-spliced back, so <head> / JSON-LD stay byte-exact.
import fs from 'node:fs';
import { parse, TextNode, HTMLElement } from 'node-html-parser';
import kuromoji from 'kuromoji';

const DICT = fs.existsSync('node_modules/kuromoji/dict')
  ? 'node_modules/kuromoji/dict'
  : 'node_modules/kuroshiro-analyzer-kuromoji/dict';
const tokenizer = await new Promise((res, rej) =>
  kuromoji.builder({ dicPath: DICT }).build((e, t) => (e ? rej(e) : res(t))));

// Every built HTML page (glossary, clinics, library… included), not a curated
// list, so the toggle reveals ふりがな everywhere.
const htmlFiles = fs
  .readdirSync('dist', { recursive: true })
  .filter((f) => typeof f === 'string' && f.endsWith('.html'))
  .map((f) => 'dist/' + f);
// Headings and interactive controls are skipped: their accessible name / text
// identity matters (screen-reader navigation, labels, exact-text tests), and
// ruby would split it. Furigana stays on the body prose, which is the point.
const SKIP = new Set(['SCRIPT', 'STYLE', 'SVG', 'CODE', 'PRE', 'RUBY', 'NOSCRIPT',
  'LABEL', 'BUTTON', 'SELECT', 'OPTION', 'SUMMARY']);
// Navigation chrome (buttons / chips / nav / breadcrumbs): short labels where
// furigana adds little and would split accessible names. Keep ruby in prose only.
// Only skip the live link map and the filter search controls. Pills (nav, chips,
// home buttons) keep furigana — the CSS lays them out inline-block so the ruby
// doesn't break their alignment.
const SKIP_CLASS = ['link-map-legend', 'link-map-toggle', 'filter-bar'];
// Interactive filter lists (clinics / glossary / works / resources): the cards,
// groups and tabs are searchable data, not reading prose. Ruby there would split
// the text that client-side search and tests match. Keep furigana on the page's
// surrounding prose, not inside these.
const SKIP_ATTR = ['data-filter-item', 'data-filter-group', 'data-filter-tabs', 'data-filter-set'];

const KANJI = /[㐀-鿿豈-﫿]/;
const isKanji = (s) => KANJI.test(s);
const isKana = (c) => /[ぁ-ゖァ-ヺ]/.test(c);
const kataToHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Ruby-wrap one token, putting the reading only over its kanji core.
function rubyToken(surface, readingKata) {
  if (!isKanji(surface)) return esc(surface);
  if (!readingKata || !/^[ァ-ーー]+$/.test(readingKata)) return esc(surface);
  let s = surface;
  let r = kataToHira(readingKata);
  let suffix = '';
  while (s.length > 1 && r.length && isKana(s[s.length - 1]) && s[s.length - 1] === r[r.length - 1]) {
    suffix = s[s.length - 1] + suffix; s = s.slice(0, -1); r = r.slice(0, -1);
  }
  let prefix = '';
  while (s.length > 1 && r.length && isKana(s[0]) && s[0] === r[0]) {
    prefix += s[0]; s = s.slice(1); r = r.slice(1);
  }
  if (!isKanji(s) || !r) return esc(surface); // nothing clean to annotate
  // aria-hidden on the reading: screen readers (and Playwright's accessible-name
  // / text locators) use the base kanji, not the hiragana gloss.
  return esc(prefix) + `<ruby>${esc(s)}<rt aria-hidden="true">${esc(r)}</rt></ruby>` + esc(suffix);
}

// Curated meaning-glosses: hard katakana/loanwords whose ruby should be a plain
// Japanese hint of the *meaning* (e.g. サイトマップ → すべてを見る), not a phonetic
// reading. Edited in scripts/furigana-glosses.json; keys starting with _ are
// ignored (comments). Matched longest-first so e.g. a longer term wins over a
// prefix of it.
const loadMap = (file) => {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith('_')));
  } catch (err) {
    console.warn(`furigana: ${file} not loaded (${err.message}) — overrides won't apply`);
    return {};
  }
};
const GLOSSES = loadMap('scripts/furigana-glosses.json');
// Phrase-level reading overrides: { phrase-with-one-kanji-run: correct-reading }.
// For cases kuromoji mis-reads in context (e.g. はじめての方へ → 方 is かた, not ほう).
const READINGS = loadMap('scripts/furigana-readings.json');

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// One combined matcher for both maps, longest key first so a longer phrase wins.
const specialKeys = [...Object.keys(GLOSSES), ...Object.keys(READINGS)].sort((a, b) => b.length - a.length);
const specialRe = specialKeys.length ? new RegExp(specialKeys.map(escapeRe).join('|'), 'g') : null;
const hasSpecial = (t) => specialKeys.some((k) => t.includes(k));

function glossRuby(term) {
  return `<ruby>${esc(term)}<rt aria-hidden="true">${esc(GLOSSES[term])}</rt></ruby>`;
}
const KANJI_RUN = /[㐀-鿿豈-﫿]+/;
// Ruby the single kanji run inside a phrase with an explicit reading; kana stay literal.
function readingRuby(phrase, reading) {
  const m = phrase.match(KANJI_RUN);
  if (!m) return esc(phrase);
  const i = m.index;
  const k = m[0];
  return esc(phrase.slice(0, i))
    + `<ruby>${esc(k)}<rt aria-hidden="true">${esc(reading)}</rt></ruby>`
    + esc(phrase.slice(i + k.length));
}
function renderSpecial(term) {
  return term in GLOSSES ? glossRuby(term) : readingRuby(term, READINGS[term]);
}

// Ruby-wrap the kanji runs in a plain segment (one that holds no curated term).
function kanjiRuby(text) {
  let out = '';
  let changed = false;
  for (const tk of tokenizer.tokenize(text)) {
    const reading = tk.reading && tk.reading !== '*' ? tk.reading : null;
    const piece = rubyToken(tk.surface_form, reading);
    if (piece.includes('<ruby>')) changed = true;
    out += piece;
  }
  return { out, changed };
}

const cache = new Map();
function furigana(text) {
  if (cache.has(text)) return cache.get(text);
  // Nothing to do unless there's kanji to read or a curated phrase to handle.
  if (!isKanji(text) && !(specialRe && hasSpecial(text))) { cache.set(text, null); return null; }
  let out = '';
  let changed = false;
  let last = 0;
  if (specialRe) {
    specialRe.lastIndex = 0;
    let m;
    while ((m = specialRe.exec(text)) !== null) {
      const seg = text.slice(last, m.index);
      if (seg) { const r = kanjiRuby(seg); out += r.out; changed = changed || r.changed; }
      out += renderSpecial(m[0]);
      changed = true;
      last = m.index + m[0].length;
    }
  }
  const tail = text.slice(last);
  if (tail) { const r = kanjiRuby(tail); out += r.out; changed = changed || r.changed; }
  const result = changed ? out : null;
  cache.set(text, result);
  return result;
}

function processChildren(node) {
  const parts = [];
  let changed = false;
  for (const child of node.childNodes) {
    if (child instanceof TextNode) {
      const ruby = furigana(child.text);
      // Wrap the annotated run in a single inline <span class="furi">. This keeps
      // a text node as ONE node even after it sprouts multiple <ruby> elements,
      // so flex/grid buttons (hero buttons, chips…) see one label item instead of
      // one flex item per ruby — which is what made labels stack character by
      // character when furigana was on.
      if (ruby != null) { parts.push(`<span class="furi">${ruby}</span>`); changed = true; } else parts.push(child.toString());
    } else if (child instanceof HTMLElement) {
      const attrs = child.attributes;
      const skip = SKIP.has(child.tagName)
        || SKIP_CLASS.some((c) => child.classList.contains(c))
        || SKIP_ATTR.some((a) => a in attrs);
      if (!skip) changed = processChildren(child) || changed;
      parts.push(child.toString());
    } else {
      parts.push(child.toString());
    }
  }
  if (changed) node.set_content(parts.join(''));
  return changed;
}

// Annotate the header (brand + nav), the main content, and the footer.
const REGIONS = [
  /(<header class="site-header"[^>]*>)([\s\S]*?)(<\/header>)/,
  /(<main id="main-content"[^>]*>)([\s\S]*?)(<\/main>)/,
  /(<footer class="site-footer"[^>]*>)([\s\S]*?)(<\/footer>)/,
];
let n = 0;
let rubies = 0;
for (const file of htmlFiles) {
  let html = fs.readFileSync(file, 'utf8');
  let touched = false;
  for (const RE of REGIONS) {
    const m = html.match(RE);
    if (!m) continue;
    const frag = parse(m[2]);
    processChildren(frag);
    const out = frag.toString();
    rubies += (out.match(/<ruby>/g) || []).length;
    html = html.replace(RE, m[1] + out + m[3]);
    touched = true;
  }
  if (touched) {
    fs.writeFileSync(file, html);
    n++;
  }
}
console.log(`furigana: annotated ${n} pages, ${rubies} ruby (${cache.size} phrases cached)`);
