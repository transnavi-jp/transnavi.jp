// Japanese-aware normaliser for the list filters (glossary / clinics / works /
// resources): NFKC + lowercase + katakana->hiragana + strip long-vowel marks,
// middle dots, punctuation and spaces — so 「ジェンダー」「ｼﾞｪﾝﾀﾞｰ」「じぇんだー」
// and an alias typed any of those ways all match. Mirrors public/search.js.
const norm = (value) => {
  if (!value) return '';
  let s = value.normalize('NFKC').toLowerCase();
  s = s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  s = s.replace(/[ー゛゜・･\s　.,、。!?！？"'「」『』（）()\[\]【】〜~_\-/]/g, '');
  return s;
};

const esc = (s) =>
  (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Per-character normalise keeping a map from each normalised UTF-16 code unit
// back to its source code-point index, so a match found in normalised space
// (kana-folded, NFKC, punctuation-stripped) can be highlighted on the original
// card text. The map is pushed per code unit (not per code point) so it stays
// aligned with String#indexOf (UTF-16), keeping astral chars from skewing it.
// Mirrors public/search.js so 「ほるもん」highlights 「ホルモン」on the cards too.
const normMapped = (text) => {
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
};

const renderRanges = (chars, ranges) => {
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
};

const termRanges = (n, map, terms) => {
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
};

// Soft fallback ranges: contiguous runs whose character bigrams all occur in the
// query, so the shared part of a fuzzy hit lights up with no exact term match.
// Runs shorter than 3 chars are dropped so a single common bigram (どう, せい) in
// unrelated text isn't spuriously marked (which would also suppress the hint).
const softRanges = (n, map, qbg) => {
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
};

const highlight = (text, terms) => {
  if (!text) return '';
  const { chars, n, map } = normMapped(text);
  return renderRanges(chars, termRanges(n, map, terms)) ?? esc(text);
};

// Soft (shared-bigram) highlight; null when nothing overlaps.
const softText = (text, qbg) => {
  if (!text || !qbg.size) return null;
  const { chars, n, map } = normMapped(text);
  const html = renderRanges(chars, softRanges(n, map, qbg));
  return html && html.includes('<mark>') ? html : null;
};

// Which of an item's searchable tokens (data-search: term/alias/reading/category
// /English) CONTAIN a query term — surfaced when nothing visible on the card got
// marked, so a matched card shows WHY (e.g. せいどういつせい → 性同一性). Only tokens
// that contain a term are returned, so the token can actually be highlighted.
const matchedTokens = (tokens, terms) => {
  const out = [];
  const seen = new Set();
  for (const tok of tokens) {
    const tn = norm(tok);
    if (!tn || seen.has(tok)) continue;
    if (terms.some((t) => tn.includes(t))) {
      seen.add(tok);
      out.push(tok);
    }
  }
  return out;
};

const bigrams = (s) => {
  if (!s) return [];
  if (s.length < 2) return [s];
  const out = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
};

// Coverage = share of the query's bigrams found in the item's text. Independent
// of item length (unlike Dice), so it survives a typo or a missing char without
// over-matching. Used only as a fallback when the substring match misses.
const coverage = (queryGrams, itemGramSet) => {
  if (!queryGrams.length || !itemGramSet.size) return 0;
  let hit = 0;
  for (const g of queryGrams) if (itemGramSet.has(g)) hit++;
  return hit / queryGrams.length;
};

for (const form of document.querySelectorAll('[data-filter-form]')) {
  const input = form.querySelector('[data-filter-input]');
  const root = form.closest('article') ?? document;
  // Opt-in fuzzy (typo-tolerant) matching — only forms that ask for it, so the
  // clinic/works exact-narrowing behaviour (and its tests) stay strict.
  const fuzzy = form.hasAttribute('data-filter-fuzzy');
  // Opt-in match highlighting (the glossary): mark the matched substring on each
  // card's visible text, kana/alias-aware, the same way /search/ does.
  const highlightOn = form.hasAttribute('data-filter-highlight');
  const HL_SELECTOR = '.clinic-name, .glossary-en, .glossary-meaning, .glossary-aliases-text, .glossary-card-tag';
  const items = [...root.querySelectorAll('[data-filter-item]')].map((el) => {
    const hay = norm(el.dataset.search ?? el.textContent ?? '');
    const hlNodes = highlightOn
      ? [...el.querySelectorAll(HL_SELECTOR)].map((node) => ({ node, text: node.textContent }))
      : [];
    return {
      el,
      hay,
      grams: fuzzy ? new Set(bigrams(hay)) : null,
      hlNodes,
      hint: highlightOn ? el.querySelector('[data-filter-hint]') : null,
      searchTokens: highlightOn ? (el.dataset.search ?? '').split(/[\s　]+/).filter(Boolean) : [],
    };
  });
  const groups = [...root.querySelectorAll('[data-filter-group]')];
  const count = root.querySelector('[data-filter-count]');
  const empty = root.querySelector('[data-filter-empty]');

  // Each [data-filter-tabs] block is an independent filter dimension. Its
  // data-filter-key names the item dataset key to match against (default
  // "categories" → data-categories). Active selections across dimensions are
  // ANDed together, so 診療区分 and 施設の種類 narrow jointly.
  const dims = [...root.querySelectorAll('[data-filter-tabs]')].map((group) => {
    const tabs = [...group.querySelectorAll('[data-filter-tab]')];
    // A dimension is single-select by default; data-filter-multi makes it a
    // multi-select facet (OR within the facet: a card matches if it has ANY of
    // the chosen values). Single dims keep a string `active`; multi dims keep a
    // Set of chosen non-empty values.
    const multi = group.hasAttribute('data-filter-multi');
    const pressed = tabs
      .filter((tab) => tab.getAttribute('aria-pressed') === 'true')
      .map((tab) => tab.dataset.filterValue ?? '');
    return {
      key: group.dataset.filterKey || 'categories',
      tabs,
      multi,
      active: multi ? new Set(pressed.filter(Boolean)) : (pressed[0] ?? ''),
    };
  });
  const dimActive = (dim) => (dim.multi ? dim.active.size > 0 : dim.active !== '');

  const update = () => {
    const query = norm(input.value.trim());
    const queryGrams = fuzzy && query.length >= 4 ? bigrams(query) : null;
    const hlTerms = highlightOn ? input.value.trim().split(/[\s　]+/).map(norm).filter(Boolean) : [];
    const qbg = new Set();
    for (const t of hlTerms) for (const g of bigrams(t)) qbg.add(g);
    let visible = 0;

    for (const item of items) {
      let matchesQuery = query === '' || item.hay.includes(query);
      if (!matchesQuery && queryGrams) matchesQuery = coverage(queryGrams, item.grams) >= 0.75;
      const matchesDims = dims.every((dim) => {
        const values = (item.el.dataset[dim.key] ?? '').split(',').filter(Boolean);
        if (dim.multi) {
          if (dim.active.size === 0) return true;
          return values.some((value) => dim.active.has(value));
        }
        if (dim.active === '') return true;
        return values.includes(dim.active);
      });
      const matches = matchesQuery && matchesDims;

      item.el.hidden = !matches;
      if (matches) visible += 1;

      if (highlightOn) {
        const active = matches && hlTerms.length;
        let marked = false;
        const nodeText = [];
        for (const { node, text } of item.hlNodes) {
          if (active) {
            const html = highlight(text, hlTerms);
            if (html.includes('<mark>')) marked = true;
            node.innerHTML = html;
          } else {
            node.textContent = text;
          }
          nodeText.push({ node, text });
        }
        // Fuzzy hit with nothing exactly marked: light up the shared part of the
        // visible text (e.g. ジェンダー in アジェンダー) so the match is still shown.
        if (active && !marked && qbg.size) {
          for (const { node, text } of nodeText) {
            const soft = softText(text, qbg);
            if (soft) {
              node.innerHTML = soft;
              marked = true;
            }
          }
        }
        // Still nothing visible (matched on a reading, category, or an alias not
        // shown in the preview): surface the matched token in a 「一致」hint line.
        if (item.hint) {
          const hints = active && !marked ? matchedTokens(item.searchTokens, hlTerms) : [];
          if (hints.length) {
            item.hint.innerHTML =
              `<span class="glossary-aliases-label">一致</span><span>${hints.map((t) => highlight(t, hlTerms)).join('、')}</span>`;
            item.hint.hidden = false;
          } else {
            item.hint.hidden = true;
            item.hint.textContent = '';
          }
        }
      }
    }

    // Collapsed in the initial default view (no narrowing — all 診療区分);
    // auto-open groups once the reader searches or picks any filter.
    const narrowed = query !== '' || dims.some(dimActive);

    for (const group of groups) {
      const visibleItems = [...group.querySelectorAll('[data-filter-item]:not([hidden])')];
      group.hidden = visibleItems.length === 0;
      // data-filter-default-open groups (glossary categories) sit open and are
      // user-collapsible; while searching they auto-open only where there's a
      // match, and reopen when the query clears. Others (clinic regions) stay
      // closed until a search/filter narrows them.
      if ('filterDefaultOpen' in group.dataset) {
        group.open = !narrowed || visibleItems.length > 0;
      } else {
        group.open = visibleItems.length > 0 && narrowed;
      }

      const groupCount = group.querySelector('[data-filter-group-count]');
      if (groupCount) groupCount.textContent = String(visibleItems.length);
    }

    if (count) count.textContent = String(visible);
    if (empty) empty.hidden = visible !== 0;
  };

  input.addEventListener('input', update);

  // Predefined tag chips: clicking sets (or clears) the search box.
  const chips = [...root.querySelectorAll('[data-filter-set]')];
  const syncChips = () => {
    const v = input.value.trim();
    for (const chip of chips) {
      chip.setAttribute('aria-pressed', chip.dataset.filterSet === v ? 'true' : 'false');
    }
  };
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      const term = chip.dataset.filterSet ?? '';
      input.value = input.value.trim() === term ? '' : term;
      update();
      syncChips();
      input.focus();
    });
  }
  input.addEventListener('input', syncChips);

  for (const dim of dims) {
    for (const tab of dim.tabs) {
      tab.addEventListener('click', () => {
        const value = tab.dataset.filterValue ?? '';
        if (dim.multi) {
          // Empty value is the "すべて" reset; otherwise toggle this value.
          if (value === '') dim.active.clear();
          else if (dim.active.has(value)) dim.active.delete(value);
          else dim.active.add(value);
          for (const currentTab of dim.tabs) {
            const tabValue = currentTab.dataset.filterValue ?? '';
            const on = tabValue === '' ? dim.active.size === 0 : dim.active.has(tabValue);
            currentTab.setAttribute('aria-pressed', on ? 'true' : 'false');
          }
        } else {
          dim.active = value;
          for (const currentTab of dim.tabs) {
            currentTab.setAttribute('aria-pressed', currentTab === tab ? 'true' : 'false');
          }
        }
        update();
      });
    }
  }

  for (const button of root.querySelectorAll('[data-expand-button]')) {
    button.addEventListener('click', () => {
      const card = button.closest('[data-filter-item]');
      const panel = card?.querySelector('[data-expand-panel]');
      if (!panel) return;

      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      button.textContent = expanded ? '詳細を開く' : '詳細を閉じる';
      panel.hidden = expanded;
    });
  }

  // Deep-link: a ?q= in the URL pre-fills the filter, so a tag chip linking to
  // /glossary/?q=<tag> opens the list already narrowed to that tag.
  const initialQuery = new URLSearchParams(location.search).get('q');
  if (initialQuery && input) {
    input.value = initialQuery;
    syncChips();
  }

  update();
}
