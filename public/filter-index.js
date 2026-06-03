const normalize = (value) => value.normalize('NFKC').toLocaleLowerCase('ja-JP');

for (const form of document.querySelectorAll('[data-filter-form]')) {
  const input = form.querySelector('[data-filter-input]');
  const root = form.closest('article') ?? document;
  const items = [...root.querySelectorAll('[data-filter-item]')];
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
    const query = normalize(input.value.trim());
    let visible = 0;

    for (const item of items) {
      const haystack = normalize(item.dataset.search ?? item.textContent ?? '');
      const matchesQuery = query === '' || haystack.includes(query);
      const matchesDims = dims.every((dim) => {
        if (dim.active === '') return true;
        const values = (item.dataset[dim.key] ?? '').split(',').filter(Boolean);
        return values.includes(dim.active);
      });
      const matches = matchesQuery && matchesDims;

      item.hidden = !matches;
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
      group.open = visibleItems.length > 0 && narrowed;

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
