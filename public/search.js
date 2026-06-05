// Client-side site search UI: fetches the index, runs the shared matcher
// (public/search-core.js), and renders results with kana/alias/synonym-aware
// highlighting. The normalisation, fuzzy matching and ranking live in
// search-core.js so the offline relevance evaluation (scripts/eval-search.mjs)
// scores with the exact same code that ships here.
import { norm, bigrams, expand, prepare, search, addSynonyms } from '/search-core.js';

(function () {
  'use strict';

  let PREP = null;

  async function load() {
    if (PREP) return PREP;
    const [idxRes, synRes] = await Promise.all([fetch('/search-index.json'), fetch('/search-synonyms.json')]);
    addSynonyms(await synRes.json().catch(() => null)); // glossary alias synonyms (best-effort)
    PREP = prepare(await idxRes.json());
    return PREP;
  }

  function run(query) {
    return search(PREP, query);
  }

  const esc = (s) =>
    (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Normalise per-character, keeping a map from each normalised UTF-16 code unit
  // back to its SOURCE code-point index — so a match found in normalised space
  // (kana-folded, NFKC, punctuation-stripped) can be highlighted on the ORIGINAL
  // text. The map is pushed per code UNIT of the normalised output (not per code
  // point) so it stays aligned with String#indexOf, which counts in UTF-16; this
  // keeps astral characters (rare kanji, emoji) from skewing the offsets.
  function normMapped(text) {
    const chars = [...text];
    let n = '';
    const map = [];
    for (let i = 0; i < chars.length; i++) {
      let c = chars[i].normalize('NFKC').toLowerCase();
      c = c.replace(/[ァ-ヶ]/g, (k) => String.fromCharCode(k.charCodeAt(0) - 0x60));
      c = c.replace(/[ー゛゜・･\s　.,、。!?！？"'「」『』（）()\[\]【】〜~_\-/]/g, '');
      for (let u = 0; u < c.length; u++) map.push(i);
      n += c;
    }
    return { chars, n, map };
  }

  // Merge code-point ranges and wrap each in <mark>, escaping everything else.
  // Returns null when there is nothing to mark.
  function renderRanges(chars, ranges) {
    if (!ranges.length) return null;
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push([r[0], r[1]]);
    }
    let out = '';
    let pos = 0;
    for (const [s, e] of merged) {
      out += esc(chars.slice(pos, s).join('')) + '<mark>' + esc(chars.slice(s, e).join('')) + '</mark>';
      pos = e;
    }
    return out + esc(chars.slice(pos).join(''));
  }

  // Source ranges of every occurrence of any term.
  function termRanges(n, map, terms) {
    const ranges = [];
    for (const t of terms) {
      if (!t) continue;
      let from = 0;
      let idx;
      while ((idx = n.indexOf(t, from)) !== -1) {
        ranges.push([map[idx], map[idx + t.length - 1] + 1]);
        from = idx + t.length;
      }
    }
    return ranges;
  }

  // Soft fallback: source ranges of contiguous runs whose character bigrams all
  // occur in the query, so the shared part of a fuzzy hit (ジェンダー in アジェンダー
  // for a ジェンダー… query) lights up with no exact term/synonym occurrence. Runs
  // shorter than 3 chars are dropped so a single common bigram (どう, せい) in
  // unrelated prose isn't spuriously marked.
  function softRanges(n, map, qbg) {
    const ranges = [];
    let runStart = -1;
    const close = (lastBigram) => {
      if (lastBigram + 1 - runStart + 1 >= 3) ranges.push([map[runStart], map[lastBigram + 1] + 1]);
      runStart = -1;
    };
    for (let k = 0; k < n.length - 1; k++) {
      if (qbg.has(n.slice(k, k + 2))) {
        if (runStart < 0) runStart = k;
      } else if (runStart >= 0) {
        close(k - 1);
      }
    }
    if (runStart >= 0) close(n.length - 2);
    return ranges;
  }

  // Mark every (normalised) occurrence of any term; returns escaped HTML.
  function highlight(text, terms) {
    if (!text) return '';
    const { chars, n, map } = normMapped(text);
    return renderRanges(chars, termRanges(n, map, terms)) ?? esc(text);
  }

  // Soft (shared-bigram) highlight of a short string; null when nothing overlaps.
  function softText(text, qbg) {
    if (!text || !qbg.size) return null;
    const { chars, n, map } = normMapped(text);
    const html = renderRanges(chars, softRanges(n, map, qbg));
    return html && html.includes('<mark>') ? html : null;
  }

  // First source code-point index where any term (then, if given, any query
  // bigram) matches, or -1.
  function firstHit(n, map, terms, qbg) {
    let best = -1;
    for (const t of terms) {
      if (!t) continue;
      const idx = n.indexOf(t);
      if (idx !== -1 && (best < 0 || idx < best)) best = idx;
    }
    if (best < 0 && qbg) {
      for (let k = 0; k < n.length - 1; k++) {
        if (qbg.has(n.slice(k, k + 2))) {
          best = k;
          break;
        }
      }
    }
    return best < 0 ? -1 : map[best];
  }

  // A window of body text centred on the first match, marking terms (and, when
  // qbg is given, the soft query-bigram overlap as a fallback).
  function snippet(text, terms, qbg) {
    if (!text) return '';
    const { chars, n, map } = normMapped(text);
    const pos = firstHit(n, map, terms, qbg);
    if (pos < 0) return esc(chars.slice(0, 96).join('')) + (chars.length > 96 ? '…' : '');
    const start = Math.max(0, pos - 32);
    const end = Math.min(chars.length, pos + 64);
    const frag = chars.slice(start, end).join('');
    let html = highlight(frag, terms);
    if (!html.includes('<mark>') && qbg) html = softText(frag, qbg) ?? html;
    return (start > 0 ? '…' : '') + html + (end < chars.length ? '…' : '');
  }

  // Which of an entry's own keywords (the `a` field: aliases / readings / abbr /
  // English) CONTAIN a query term — shown when the title and body carry no
  // visible hit, so a result reveals WHY it matched (e.g. SRS → 性別適合手術). Only
  // keywords that contain a term are returned, so the keyword can be highlighted.
  function matchedKeywords(a, terms) {
    if (!a) return [];
    const out = [];
    const seen = new Set();
    for (const tok of a.split(/[\s　]+/)) {
      const tn = norm(tok);
      if (!tn || seen.has(tok)) continue;
      if (terms.some((t) => tn.includes(t))) {
        seen.add(tok);
        out.push(tok);
      }
    }
    return out;
  }

  function render(results, terms, synTerms, els) {
    if (!results.length) {
      els.status.textContent = '見つかりませんでした。別のことばや、ひらがな・カタカナを変えて試してみてください。';
      els.results.innerHTML = '';
      return;
    }
    const qbg = new Set();
    for (const t of terms) for (const g of bigrams(t)) qbg.add(g);
    els.status.textContent = `${results.length} 件`;
    els.results.innerHTML = results
      .map(({ e }) => {
        const ext = e.ext ? ' target="_blank" rel="noreferrer"' : '';
        let titleHtml = highlight(e.t, terms);
        let snipHtml = snippet(e.x, terms, null);
        let marked = titleHtml.includes('<mark>') || snipHtml.includes('<mark>');
        // (1) hidden-field hit: surface the matched alias/abbr, highlighted.
        let aliasHtml = '';
        if (!marked) {
          const kw = matchedKeywords(e.a, terms).filter((k) => !norm(e.t).includes(norm(k)));
          if (kw.length) {
            aliasHtml =
              `<span class="search-result-alias"><span class="search-result-alias-label">別名</span><span>${kw
                .map((k) => highlight(k, terms))
                .join('、')}</span></span>`;
            marked = true;
          }
        }
        // (2) fuzzy / synonym hit: mark the synonym occurrence, else the soft
        //     (shared-bigram) overlap, so every shown result reveals its match.
        if (!marked) {
          const st = highlight(e.t, synTerms);
          const t2 = st.includes('<mark>') ? st : softText(e.t, qbg);
          const s2 = snippet(e.x, synTerms, qbg);
          if ((t2 && t2.includes('<mark>')) || s2.includes('<mark>')) {
            if (t2 && t2.includes('<mark>')) titleHtml = t2;
            snipHtml = s2;
            marked = true;
          }
        }
        return (
          `<a class="search-result" href="${esc(e.u)}"${ext}>` +
          `<span class="search-result-head"><span class="search-result-kind">${esc(e.k)}</span>` +
          `<span class="search-result-title">${titleHtml}</span></span>` +
          (snipHtml ? `<span class="search-result-snip">${snipHtml}</span>` : '') +
          aliasHtml +
          `</a>`
        );
      })
      .join('');
  }

  function init() {
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    const status = document.getElementById('search-status');
    if (!input || !results || !status) return;
    const els = { results, status };

    const params = new URLSearchParams(location.search);
    const initial = params.get('q') || '';
    if (initial) input.value = initial;

    let timer = null;
    async function update(pushUrl) {
      const q = input.value;
      const u = new URL(location.href);
      if (q) u.searchParams.set('q', q);
      else u.searchParams.delete('q');
      history.replaceState(null, '', u);
      if (!q.trim()) {
        status.textContent = '';
        results.innerHTML = '';
        return;
      }
      status.textContent = '検索中…';
      await load();
      const rawTerms = q.trim().split(/[\s　]+/).filter(Boolean);
      const terms = rawTerms.map(norm).filter(Boolean);
      const synTerms = expand(rawTerms); // query-vocabulary synonyms (already normalised)
      render(run(q), terms, synTerms, els);
    }

    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => update(), 120);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(timer);
        update();
      }
    });

    if (initial.trim()) update();
    input.focus();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
