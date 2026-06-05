// Build a table of contents from an article's <h2> headings.
//
// Runs on content pages only (an .article-shell with >= 3 real <h2>s, and not a
// filter/map index page). Wide screens: a sticky sidebar with scroll-spy. Small
// screens: a collapsible 目次 box at the top PLUS a floating 「目次」 button that
// appears once you scroll past it and opens a popover of the sections from
// anywhere — so you can jump around without scrolling back up. Headings carry
// toggle-able furigana <ruby>, so link text is read with <rt> stripped.
(function () {
  var DESKTOP = '(min-width: 1080px)';
  var shell = document.querySelector('main#main-content .article-shell');
  var nav = document.getElementById('page-toc');
  if (!shell || !nav) return;

  // Skip interactive index pages (clinics / glossary / works / resources / map):
  // a TOC of their filter sections is noise.
  if (document.querySelector('[data-filter-input], #map')) return;

  // Real section headings only — not ones inside cards, asides, nav or widgets.
  var heads = Array.prototype.filter.call(shell.querySelectorAll('h2'), function (h) {
    return !h.closest('nav, aside, details, .notice, .page-disclaimer, .concept-card, .clinic-card, [data-filter-item]');
  });
  if (heads.length < 3) return;

  function textOf(el) {
    var clone = el.cloneNode(true);
    clone.querySelectorAll('rt, rp').forEach(function (r) { r.remove(); });
    return (clone.textContent || '').trim();
  }

  heads.forEach(function (h, i) {
    if (!h.id) h.id = 'toc-sec-' + (i + 1);
    h.style.scrollMarginTop = '24px';
  });

  // Every section can have more than one link to it (the inline list and the
  // floating popover), so scroll-spy highlights them all together.
  var anchorsById = {};
  function buildList(onClick) {
    var ol = document.createElement('ol');
    ol.className = 'page-toc-list';
    heads.forEach(function (h) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = textOf(h);
      if (onClick) a.addEventListener('click', onClick);
      li.appendChild(a);
      ol.appendChild(li);
      (anchorsById[h.id] = anchorsById[h.id] || []).push(a);
    });
    return ol;
  }

  var smallScreen = function () { return !window.matchMedia(DESKTOP).matches; };

  // --- Inline TOC: sidebar on desktop, collapsible box at the top on mobile ---
  var box = document.createElement('details');
  box.className = 'page-toc-box';
  box.open = !smallScreen();
  var summary = document.createElement('summary');
  summary.className = 'page-toc-summary';
  summary.textContent = '目次';
  box.appendChild(summary);
  box.appendChild(buildList(function (e) {
    if (e.target.tagName === 'A' && smallScreen()) box.open = false;
  }));
  nav.appendChild(box);
  nav.hidden = false;
  nav.parentElement.classList.add('has-toc');

  // --- Floating expandable 目次 (small screens only, via CSS) ---
  var fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'page-toc-fab';
  fab.setAttribute('aria-expanded', 'false');
  fab.setAttribute('aria-controls', 'page-toc-pop');
  fab.setAttribute('aria-label', '目次をひらく');
  fab.innerHTML = '<span class="page-toc-fab-icon" aria-hidden="true">☰</span>目次';

  var pop = document.createElement('div');
  pop.className = 'page-toc-pop';
  pop.id = 'page-toc-pop';
  pop.hidden = true;
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', '目次');
  pop.appendChild(buildList(function (e) { if (e.target.tagName === 'A') closePop(); }));

  document.body.appendChild(pop);
  document.body.appendChild(fab);

  function openPop() { pop.hidden = false; fab.setAttribute('aria-expanded', 'true'); fab.classList.add('is-open'); }
  function closePop() { pop.hidden = true; fab.setAttribute('aria-expanded', 'false'); fab.classList.remove('is-open'); }
  fab.addEventListener('click', function (e) { e.stopPropagation(); if (pop.hidden) openPop(); else closePop(); });
  document.addEventListener('click', function (e) {
    if (!pop.hidden && !pop.contains(e.target) && e.target !== fab) closePop();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePop(); });

  if ('IntersectionObserver' in window) {
    // Reveal the floating button only once the top TOC has scrolled away.
    var fabObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { fab.classList.remove('is-visible'); closePop(); }
        else fab.classList.add('is-visible');
      });
    }, { threshold: 0 });
    fabObs.observe(nav);

    // Scroll-spy: mark the section currently near the top, in every list.
    var currentId = null;
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (currentId && anchorsById[currentId]) anchorsById[currentId].forEach(function (a) { a.classList.remove('is-current'); });
        currentId = entry.target.id;
        if (anchorsById[currentId]) anchorsById[currentId].forEach(function (a) { a.classList.add('is-current'); });
      });
    }, { rootMargin: '0px 0px -78% 0px', threshold: 0 });
    heads.forEach(function (h) { spy.observe(h); });
  }
})();
