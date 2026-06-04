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

const cache = new Map();
function furigana(text) {
  if (!isKanji(text)) return null;
  if (cache.has(text)) return cache.get(text);
  let out = '';
  let changed = false;
  for (const tk of tokenizer.tokenize(text)) {
    const reading = tk.reading && tk.reading !== '*' ? tk.reading : null;
    const piece = rubyToken(tk.surface_form, reading);
    if (piece.includes('<ruby>')) changed = true;
    out += piece;
  }
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
      if (ruby != null) { parts.push(ruby); changed = true; } else parts.push(child.toString());
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
