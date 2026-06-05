// Client-side site search with a Japanese-aware fuzzy matcher.
// - normalisation: NFKC + lowercase + katakana->hiragana + strip long-vowel /
//   punctuation, so 「カタカナ」「ｶﾀｶﾅ」「かたかな」all collapse together;
// - matching: substring first, then character-bigram Dice similarity, so typos
//   and orthographic variants still rank (a small, static-site take on the
//   "soft matching" idea behind tools like SoftMatcha);
// - synonyms: a small map bridges query vocabulary (GID -> 性別違和 etc.).
(function () {
  'use strict';

  function norm(s) {
    if (!s) return '';
    s = s.normalize('NFKC').toLowerCase();
    s = s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)); // kana -> hira
    s = s.replace(/[ー゛゜・･\s　.,、。!?！？"'「」『』（）()\[\]【】〜~_\-/]/g, '');
    return s;
  }

  function bigrams(s) {
    if (!s) return [];
    if (s.length < 2) return [s];
    const out = [];
    for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
    return out;
  }

  function dice(grams, set) {
    if (!grams.length || !set.size) return 0;
    let hit = 0;
    for (const g of grams) if (set.has(g)) hit++;
    return (2 * hit) / (grams.length + set.size);
  }

  // Query-vocabulary bridges (keys are NFKC+lowercased; values get normalised).
  const SYN = {
    gid: ['性同一性障害', '性別違和', '性別不合'],
    mtf: ['トランス女性', '男性から女性', 'male to female'],
    ftm: ['トランス男性', '女性から男性', 'female to male'],
    srs: ['性別適合手術', '手術', '陰茎反転'],
    hrt: ['ホルモン療法', 'ホルモン'],
    ホルモン: ['hrt', 'エストロゲン', 'テストステロン'],
    トランス: ['トランスジェンダー'],
    ノンバイナリー: ['xジェンダー', 'エックスジェンダー'],
    xジェンダー: ['ノンバイナリー'],
    カミングアウト: ['打ち明け', '告白', 'coming out'],
    ブロッカー: ['思春期ブロッカー', '二次性徴'],
    声: ['ボイス', '音声', 'voice'],
    名前: ['改名', '名の変更'],
    戸籍: ['性別変更', '特例法', '戸籍変更'],
    脱毛: ['ヒゲ', '医療脱毛'],
    病院: ['クリニック', '医療機関'],
    クリニック: ['病院', '医療機関'],
    相談: ['相談先', '窓口', 'ホットライン'],
  };

  let PREP = null;

  async function load() {
    if (PREP) return PREP;
    const res = await fetch('/search-index.json');
    const index = await res.json();
    PREP = index.map((e) => {
      const tn = norm(e.t);
      const an = norm(e.a || ''); // entry's own keywords (aliases/readings); high signal
      const xn = norm(e.x);
      return { e, tn, an, xn, tg: new Set(bigrams(tn)), ag: new Set(bigrams(an)), xg: new Set(bigrams(xn)) };
    });
    return PREP;
  }

  function expand(rawTerms) {
    const ex = new Set();
    for (const raw of rawTerms) {
      const key = raw.normalize('NFKC').toLowerCase();
      if (SYN[key]) for (const s of SYN[key]) ex.add(norm(s));
    }
    return [...ex].filter(Boolean);
  }

  function run(query) {
    const rawTerms = query.trim().split(/[\s　]+/).filter(Boolean);
    if (!rawTerms.length) return [];
    const terms = rawTerms.map(norm).filter(Boolean);
    if (!terms.length) return [];
    const synTerms = expand(rawTerms);

    const out = [];
    for (const p of PREP) {
      let score = 0;
      let matchedTerms = 0;
      for (const t of terms) {
        const tg = bigrams(t);
        let s = 0;
        if (p.tn.includes(t)) s = 120 + t.length * 2;
        else if (p.an.includes(t)) s = 80 + t.length; // alias / reading match beats a body mention
        else if (p.xn.includes(t)) s = 45 + t.length;
        else {
          const dt = dice(tg, p.tg);
          const da = dice(tg, p.ag);
          const dx = dice(tg, p.xg);
          if (dt >= 0.5) s = 34 * dt;
          else if (da >= 0.5) s = 26 * da;
          else if (dx >= 0.5) s = 16 * dx;
          else if (dt >= 0.34 || da >= 0.34 || dx >= 0.34) s = 8 * Math.max(dt, da, dx);
        }
        if (s > 0) matchedTerms++;
        score += s;
      }
      for (const st of synTerms) {
        if (p.tn.includes(st)) score += 22;
        else if (p.an.includes(st)) score += 14;
        else if (p.xn.includes(st)) score += 9;
      }
      // For multi-word queries, prefer entries matching more of the terms.
      if (terms.length > 1) score += matchedTerms * 6;
      if (score > 0) out.push({ e: p.e, score });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 50);
  }

  const esc = (s) =>
    s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function snippet(text, rawTerms) {
    if (!text) return '';
    let idx = -1;
    let hit = '';
    for (const raw of rawTerms) {
      const i = text.indexOf(raw);
      if (i >= 0 && (idx < 0 || i < idx)) {
        idx = i;
        hit = raw;
      }
    }
    if (idx < 0) {
      const head = text.slice(0, 96);
      return esc(head) + (text.length > 96 ? '…' : '');
    }
    const start = Math.max(0, idx - 32);
    const end = Math.min(text.length, idx + 64);
    let frag = text.slice(start, end);
    let html = esc(frag);
    // highlight every raw term occurrence in the fragment
    for (const raw of rawTerms) {
      if (!raw) continue;
      html = html.replace(new RegExp(esc(raw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) => `<mark>${m}</mark>`);
    }
    return (start > 0 ? '…' : '') + html + (end < text.length ? '…' : '');
  }

  function render(results, rawTerms, els) {
    if (!results.length) {
      els.status.textContent = '見つかりませんでした。別のことばや、ひらがな・カタカナを変えて試してみてください。';
      els.results.innerHTML = '';
      return;
    }
    els.status.textContent = `${results.length} 件`;
    els.results.innerHTML = results
      .map(({ e }) => {
        const ext = e.ext ? ' target="_blank" rel="noreferrer"' : '';
        return (
          `<a class="search-result" href="${esc(e.u)}"${ext}>` +
          `<span class="search-result-head"><span class="search-result-kind">${esc(e.k)}</span>` +
          `<span class="search-result-title">${esc(e.t)}</span></span>` +
          `<span class="search-result-snip">${snippet(e.x, rawTerms)}</span>` +
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
      render(run(q), rawTerms, els);
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
