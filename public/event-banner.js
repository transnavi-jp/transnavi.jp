// Shows a slim header banner when an awareness day/week/month is ongoing or
// very close, based on the visitor's current date (the site is static, so this
// must run client-side). Events recur every year; the first match wins. A
// dismissed banner stays hidden for that occurrence (per id + year).
(function () {
  'use strict';

  function init() {
    var el = document.getElementById('event-banner');
    var dataEl = document.getElementById('event-banner-data');
    if (!el || !dataEl) return;

    var events;
    try {
      events = JSON.parse(dataEl.textContent);
    } catch (e) {
      return;
    }

    var now = new Date();
    var year = now.getFullYear();
    // Midnight today, for whole-day comparisons.
    var today = new Date(year, now.getMonth(), now.getDate()).getTime();

    var active = null;
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      // A one-off dated event (e.g. a specific year's pride) sets `year`; skip it
      // in any other year. Entries without `year` recur every year as before.
      if (ev.year && ev.year !== year) continue;
      var start = new Date(year, ev.sm - 1, ev.sd);
      if (ev.lead) start.setDate(start.getDate() - ev.lead);
      var end = new Date(year, ev.em - 1, ev.ed);
      if (today >= start.getTime() && today <= end.getTime()) {
        active = ev;
        break;
      }
    }
    if (!active) return;

    // Dismissal is session-scoped (sessionStorage): closing it hides the banner
    // for the current browsing session, but it comes back on the next visit so
    // an accidental close doesn't make it vanish for the whole month.
    var key = 'eb-dismiss-' + active.id;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch (e2) {}

    el.querySelector('.event-banner-emoji').textContent = active.emoji || '🏳️‍🌈';
    el.querySelector('.event-banner-text').textContent = active.text;
    var link = el.querySelector('.event-banner-link');
    link.textContent = (active.cta || 'くわしく') + ' →';
    link.setAttribute('href', active.href || '/pride/');
    el.hidden = false;

    el.querySelector('.event-banner-close').addEventListener('click', function () {
      el.hidden = true;
      try {
        sessionStorage.setItem(key, '1');
      } catch (e3) {}
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
