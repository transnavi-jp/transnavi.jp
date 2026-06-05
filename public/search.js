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
    (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Normalise a string per-character the way norm() does, keeping a map from each
  // normalised character back to the source character it came from — so a match
  // found in normalised space (kana-folded, NFKC, punctuation-stripped) can be
  // highlighted on the ORIGINAL text. This is what lets ほるもん highlight
  // ホルモン, and ジェンダーアイデンティティ highlight ジェンダー・アイデンティティ.
  function normMapped(text) {
    const chars = [...text];
    let n = '';
    const map = [];
    for (let i = 0; i < chars.length; i++) {
      let c = chars[i].normalize('NFKC').toLowerCase();
      c = c.replace(/[ァ-ヶ]/g, (k) => String.fromCharCode(k.charCodeAt(0) - 0x60));
      c = c.replace(/[ー゛゜・･\s　.,、。!?！？"'「」『』（）()\[\]【】〜~_\-/]/g, '');
      for (const ch of c) {
        n += ch;
        map.push(i);
      }
    }
    return { chars, n, map };
  }

  // Wrap every (normalised) occurrence of any term in <mark>, mapped back onto
  // the original characters. Returns escaped HTML.
  function highlight(text, terms) {
    if (!text) return '';
    const { chars, n, map } = normMapped(text);
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
    if (!ranges.length) return esc(text);
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

  // First original-character index where any term matches (normalised), or -1.
  function firstMatch(text, terms) {
    const { n, map } = normMapped(text);
    let best = -1;
    for (const t of terms) {
      if (!t) continue;
      const idx = n.indexOf(t);
      if (idx !== -1 && (best < 0 || map[idx] < best)) best = map[idx];
    }
    return best;
  }

  // A window of the body text centred on the first match, with matches marked.
  function snippet(text, terms) {
    if (!text) return '';
    const chars = [...text];
    const pos = firstMatch(text, terms);
    if (pos < 0) {
      return esc(chars.slice(0, 96).join('')) + (chars.length > 96 ? '…' : '');
    }
    const start = Math.max(0, pos - 32);
    const end = Math.min(chars.length, pos + 64);
    const frag = chars.slice(start, end).join('');
    return (start > 0 ? '…' : '') + highlight(frag, terms) + (end < chars.length ? '…' : '');
  }

  // Which of an entry's own keywords (the `a` field: aliases / readings / abbr /
  // English) a query term matched — shown when the title and body carry no
  // visible hit, so a result always reveals WHY it matched (e.g. SRS → 性別適合手術).
  function matchedKeywords(a, terms) {
    if (!a) return [];
    const out = [];
    const seen = new Set();
    for (const tok of a.split(/[\s　]+/)) {
      const tn = norm(tok);
      if (!tn || seen.has(tok)) continue;
      if (terms.some((t) => tn.includes(t) || t.includes(tn))) {
        seen.add(tok);
        out.push(tok);
      }
    }
    return out;
  }

  function render(results, terms, els) {
    if (!results.length) {
      els.status.textContent = '見つかりませんでした。別のことばや、ひらがな・カタカナを変えて試してみてください。';
      els.results.innerHTML = '';
      return;
    }
    els.status.textContent = `${results.length} 件`;
    els.results.innerHTML = results
      .map(({ e }) => {
        const ext = e.ext ? ' target="_blank" rel="noreferrer"' : '';
        const titleHtml = highlight(e.t, terms);
        const snipHtml = snippet(e.x, terms);
        // Guarantee a visible highlight: if neither the title nor the snippet
        // marked anything, surface the matched alias/abbr instead.
        const showAlias = !titleHtml.includes('<mark>') && !snipHtml.includes('<mark>');
        const kw = showAlias ? matchedKeywords(e.a, terms) : [];
        const aliasHtml = kw.length
          ? `<span class="search-result-alias"><span class="search-result-alias-label">別名</span><span>${kw
              .map((k) => highlight(k, terms))
              .join('、')}</span></span>`
          : '';
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
      const terms = q.trim().split(/[\s　]+/).map(norm).filter(Boolean);
      render(run(q), terms, els);
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
