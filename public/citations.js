// For each reference in a References list that is cited inline, add a back-link
// (↑) to its inline marker in the text. A reference cited more than once gets
// ↑ a b c… (one link per occurrence). References never cited inline (page-level
// only) get no back-link.
(function () {
  for (const list of document.querySelectorAll('.reference-list')) {
    const root = list.closest('article') || document;
    const markersAll = [...root.querySelectorAll('.cite a[href^="#ref-"]')];
    for (const li of list.querySelectorAll('li[id^="ref-"]')) {
      const target = '#' + li.id;
      const markers = markersAll.filter((a) => a.getAttribute('href') === target);
      if (!markers.length) continue;
      markers.forEach((m, i) => { if (!m.id) m.id = 'cite-' + li.id + '-' + (i + 1); });

      const back = document.createElement('span');
      back.className = 'ref-back';
      if (markers.length === 1) {
        back.innerHTML = '<a href="#' + markers[0].id + '" aria-label="本文の引用箇所に戻る">↑</a>';
      } else {
        back.append('↑ ');
        markers.forEach((m, i) => {
          const a = document.createElement('a');
          a.href = '#' + m.id;
          a.textContent = String.fromCharCode(97 + i); // a, b, c…
          a.setAttribute('aria-label', '本文の引用箇所 ' + (i + 1) + ' に戻る');
          back.append(a, ' ');
        });
      }
      li.insertBefore(document.createTextNode(' '), li.firstChild);
      li.insertBefore(back, li.firstChild);
    }
  }
})();
