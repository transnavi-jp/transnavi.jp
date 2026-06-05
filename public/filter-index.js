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
  const items = [...root.querySelectorAll('[data-filter-item]')].map((el) => {
    const hay = norm(el.dataset.search ?? el.textContent ?? '');
    return { el, hay, grams: fuzzy ? new Set(bigrams(hay)) : null };
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
    return {
      key: group.dataset.filterKey || 'categories',
      tabs,
      active: tabs.find((tab) => tab.getAttribute('aria-pressed') === 'true')?.dataset.filterValue ?? '',
    };
  });

  const update = () => {
    const query = norm(input.value.trim());
    const queryGrams = fuzzy && query.length >= 4 ? bigrams(query) : null;
    let visible = 0;

    for (const item of items) {
      let matchesQuery = query === '' || item.hay.includes(query);
      if (!matchesQuery && queryGrams) matchesQuery = coverage(queryGrams, item.grams) >= 0.75;
      const matchesDims = dims.every((dim) => {
        if (dim.active === '') return true;
        const values = (item.el.dataset[dim.key] ?? '').split(',').filter(Boolean);
        return values.includes(dim.active);
      });
      const matches = matchesQuery && matchesDims;

      item.el.hidden = !matches;
      if (matches) visible += 1;
    }

    // Collapsed in the initial default view (no narrowing — all 診療区分);
    // auto-open groups once the reader searches or picks any filter.
    const catDim = dims.find((dim) => dim.key === 'categories');
    const narrowed =
      query !== '' ||
      (catDim ? catDim.active !== '' : false) ||
      dims.some((dim) => dim.key !== 'categories' && dim.active !== '');

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
        dim.active = tab.dataset.filterValue ?? '';
        for (const currentTab of dim.tabs) {
          currentTab.setAttribute('aria-pressed', currentTab === tab ? 'true' : 'false');
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

  update();
}
