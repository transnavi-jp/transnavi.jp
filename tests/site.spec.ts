import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

// Body prose may carry <ruby> furigana (toggle-able), whose <rt> readings land in
// textContent and break exact substring matches. Read the text with rt stripped.
async function textNoRuby(locator: Locator): Promise<string> {
  return locator.first().evaluate((el) => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('rt, rp').forEach((r) => r.remove());
    return clone.textContent ?? '';
  });
}

const pages = [
  '/',
  '/start/',
  '/support/',
  '/allies/',
  '/basics/',
  '/gender/',
  '/orientation/',
  '/dysphoria/',
  '/transition/',
  '/hrt-medications/',
  '/presentation/',
  '/flags/',
  '/pride/',
  '/clinics/',
  '/map/',
  '/glossary/',
  '/works/',
  '/legal/',
  '/library/',
  '/resources/',
  '/about/',
  '/sitemap/',
  '/data/',
];

for (const path of pages) {
  test(`${path} は日本語ページとして表示される`, async ({ page }) => {
    await page.goto(path);

    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page.locator('body')).not.toContainText('法務部');
    await expect(page.locator('body')).not.toContainText('資料庫');

    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();

    const fontSize = await h1.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(fontSize).toBeLessThanOrEqual(36);
  });
}

test('全ページのフッターに今すぐの相談先（タップできる電話番号）がある', async ({ page }) => {
  // 取り乱した利用者がどのページからでも、画面遷移なしで 24時間の番号に届くこと。
  await page.goto('/basics/');
  const tel = page.locator('.footer-crisis a[href^="tel:"]');
  await expect(tel).toHaveAttribute('href', 'tel:0120279338');
  await expect(tel).toContainText('0120-279-338');
});

test('医療機関ページは主観的コメント欄を表示しない', async ({ page }) => {
  await page.goto('/clinics/hrt-tokyo-gender-clinic/');

  expect(await textNoRuby(page.locator('h1'))).toContain('東京ジェンダークリニック');
  await expect(page.locator('body')).not.toContainText('取り込み時の記録');
  await expect(page.locator('body')).not.toContainText('おすすめ');
  expect(await textNoRuby(page.locator('body'))).toContain('特定の医療機関をすすめるものではありません');
});

test('医療機関一覧を検索できる', async ({ page }) => {
  await page.goto('/clinics/');

  await page.getByLabel('医療機関を検索').fill('東京ジェンダー');

  await expect(page.locator('.clinic-name-link', { hasText: '東京ジェンダークリニック' })).toBeVisible();
  await expect(page.locator('.clinic-name-link', { hasText: '水戸中央クリニック' })).toBeHidden();
  await expect(page.locator('[data-filter-count]')).toHaveText('1');
});

test('医療機関カードに電話と確認状況を表示する', async ({ page }) => {
  await page.goto('/clinics/');

  await page.locator('summary', { hasText: '岩手県' }).click();

  // 大日向医院's website is down, so its URL was dropped; the card still shows
  // the phone and status, and falls back to 公式サイト未確認.
  const card = page.locator('[data-filter-item]', { hasText: '大日向医院' });
  await expect(card).toContainText('電話: 019-662-5530');
  await expect(card).toContainText('公式サイト未確認');
  await expect(card).toContainText('ホルモン療法 / 要確認');
});

test('医療機関リンクを公式サイトと関連ページに分けて表示する', async ({ page }) => {
  await page.goto('/clinics/');

  await page.locator('summary', { hasText: '神奈川県' }).click();

  const card = page.locator('[data-filter-item]', { hasText: '川崎中央クリニック' });
  await expect(card.getByRole('link', { name: '公式サイト' })).toHaveAttribute('href', 'https://www.kawasaki-biyou.com/');
  await expect(card).toContainText('関連ページ:');
  await expect(card.getByRole('link', { name: '1' })).toHaveAttribute('href', 'https://www.kawasaki-mens.com/mtf/');

  await page.goto('/clinics/hrt-kanagawa-kawasaki/');

  expect(await textNoRuby(page.locator('.clinic-detail'))).toContain('公式サイト');
  expect(await textNoRuby(page.locator('.clinic-detail'))).toContain('関連ページ');
  await expect(page.getByRole('link', { name: 'https://www.kawasaki-biyou.com/' })).toHaveAttribute('href', 'https://www.kawasaki-biyou.com/');
  await expect(page.getByRole('link', { name: 'https://www.kawasaki-mens.com/mtf/' })).toHaveAttribute('href', 'https://www.kawasaki-mens.com/mtf/');
});

test('医療機関一覧を診療区分タブで切り替えられる', async ({ page }) => {
  await page.goto('/clinics/');

  await page.getByRole('button', { name: '精神科（メンタルクリニック）' }).click();

  await expect(page.locator('.clinic-region[open] summary', { hasText: '宮城県' })).toBeVisible();
  await expect(page.locator('.clinic-name-link', { hasText: '青葉心理クリニック' })).toBeVisible();
  await expect(page.locator('.clinic-name-link', { hasText: '水戸中央クリニック' })).toBeHidden();

  await page.getByRole('button', { name: '手術', exact: true }).click();

  await expect(page.locator('.clinic-name-link', { hasText: '札幌医科大学付属病院' })).toBeVisible();
  await expect(page.locator('.clinic-name-link', { hasText: '青葉心理クリニック' })).toBeHidden();
});

test('医療機関カードを展開して詳細を見られる', async ({ page }) => {
  await page.goto('/clinics/');

  await page.locator('summary', { hasText: '岩手県' }).click();

  const card = page.locator('[data-filter-item]', { hasText: '大日向医院' });
  const button = card.locator('[data-expand-button]');

  await button.click();

  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(card).toContainText('地域');
  await expect(card).toContainText('岩手県 / 盛岡市');
  await expect(card).toContainText('掲載ページを見る');
});

test('都道府県は日本の並び順で初期表示は折りたたみ', async ({ page }) => {
  await page.goto('/clinics/');

  const summaries = page.locator('.clinic-region summary');
  await expect(summaries.nth(0)).toContainText('北海道');
  await expect(summaries.nth(1)).toContainText('青森県');
  await expect(summaries.nth(2)).toContainText('岩手県');
  await expect(page.locator('.clinic-region').nth(0)).not.toHaveAttribute('open', '');
});

test('用語集を検索できる', async ({ page }) => {
  await page.goto('/glossary/');

  await page.getByLabel('用語を検索').fill('インフォームドコンセントモデル');

  // Target by the term name (.clinic-name) — tag chips now also put labels like
  // 「カミングアウト」 on many cards, so a bare card-text match is ambiguous.
  await expect(
    page.locator('.glossary-card', { has: page.locator('.clinic-name', { hasText: 'インフォームドコンセントモデル' }) }),
  ).toBeVisible();
  await expect(
    page.locator('.glossary-card', { has: page.locator('.clinic-name', { hasText: 'カミングアウト' }) }),
  ).toBeHidden();
  await expect(page.locator('[data-filter-count]')).toHaveText('1');
});

test('用語集を読み（ひらがな）・別名・略語でも検索できる', async ({ page }) => {
  await page.goto('/glossary/');
  const search = page.getByLabel('用語を検索');

  // A kanji term found by its hiragana reading (built into the search blob).
  await search.fill('せいべついわ');
  await expect(page.locator('.glossary-card .clinic-name', { hasText: '性別違和' }).first()).toBeVisible();

  // A katakana alias of a kanji term.
  await search.fill('ジェンダーアイデンティティ');
  await expect(page.locator('.glossary-card .clinic-name', { hasText: '性同一性' }).first()).toBeVisible();

  // An abbreviation alias.
  await search.fill('SRS');
  await expect(page.locator('.glossary-card .clinic-name', { hasText: '性別適合手術' }).first()).toBeVisible();

  // A small typo still matches via the fuzzy fallback.
  await search.fill('せいべついあ');
  await expect(page.locator('.glossary-card .clinic-name', { hasText: '性別違和' }).first()).toBeVisible();
});

test('用語ページにタグが表示され、タグで用語集を絞り込める', async ({ page }) => {
  // 各用語ページにタグのチップが出る。
  await page.goto('/glossary/spironolactone/');
  await expect(page.locator('.glossary-tag', { hasText: 'ホルモン療法' }).first()).toBeVisible();

  // タグのリンク（/glossary/?q=<タグ>）で用語集がそのタグに絞り込まれる。
  await page.goto('/glossary/?q=' + encodeURIComponent('MtF・女性化'));
  const visible = page.locator('.glossary-card[data-filter-item]:not([hidden])');
  await expect(visible.first()).toBeVisible();
  const count = await visible.count();
  expect(count).toBeGreaterThan(5);
  expect(count).toBeLessThan(120);
});

test('タグの仕組み: カード・ページのタグから /tags/ をたどれる', async ({ page }) => {
  // 用語集カードのタグはリンクで、/tags/<slug>/ に飛ぶ。
  await page.goto('/glossary/');
  await expect(
    page.locator('.glossary-card-tag', { hasText: 'ホルモン療法' }).first(),
  ).toHaveAttribute('href', '/tags/hormones/');

  // /tags/（タグの地図）にタグノードが並ぶ。
  await page.goto('/tags/');
  await expect(page.locator('.tag-node').first()).toBeVisible();

  // 個別タグページに、ページと用語の両方が一覧される。
  await page.goto('/tags/hormones/');
  await expect(page.locator('.tag-page-list a').first()).toBeVisible();
  await expect(page.locator('.word-chips a.word-chip').first()).toBeVisible();

  // 解説ページの下部にタグ行（/tags/ へのリンク）がある。
  await page.goto('/hrt-effects/');
  await expect(page.locator('.page-tags a.page-tag').first()).toHaveAttribute('href', /^\/tags\//);
});

test('MtF.wiki の免責事項を自サイトの資料として掲載しない', async ({ page }) => {
  await page.goto('/library/');

  await expect(page.locator('body')).not.toContainText('免責事項');
  await expect(page.getByRole('link', { name: /免責事項/ })).toHaveCount(0);
});

test('関連サイトページに 2345.LGBT 由来の外部リンクを表示する', async ({ page }) => {
  await page.goto('/resources/');

  expect(await textNoRuby(page.locator('h1'))).toContain('関連サイト');
  await expect(page.getByRole('link', { name: /全国医療地図/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /日本 GID\/GD と共に生きる人々の会/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /はじめてのトランスジェンダー trans101\.jp/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Tネット/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /虹色ダイバーシティ/ }).first()).toBeVisible();
});

test('文芸作品データベースに 2345.LGBT 由来の作品を掲載する', async ({ page }) => {
  await page.goto('/works/');

  expect(await textNoRuby(page.locator('h1'))).toContain('文芸作品');
  await expect(page.locator('body')).toContainText('片袖の魚');
  await expect(page.locator('body')).toContainText('三浦部長、本日付けで女性になります。');
});

test('旧 /articles/ の URL は移行先へ誘導する', async ({ page }) => {
  // 本番（静的）では meta refresh、開発サーバーでは HTTP リダイレクトになる。
  const expectRedirect = async (from: string, to: RegExp) => {
    const res = await page.request.get(from, { maxRedirects: 0 });
    if (res.status() >= 300 && res.status() < 400) {
      expect(res.headers()['location']).toMatch(to);
    } else {
      expect(await res.text()).toMatch(new RegExp(`refresh[\\s\\S]*?${to.source}`, 'i'));
    }
  };
  await expectRedirect('/articles/cultural-works/', /\/works/);
  await expectRedirect('/articles/start-here/', /\/start/);
  await expectRedirect('/articles/editorial-policy/', /\/about/);
  await expectRedirect('/articles/international-resources/', /\/resources/);
});

test('サイト内検索がひらがな入力でカタカナの内容にヒットする', async ({ page }) => {
  // ?q= で初期化され、ひらがな「ほるもん」がカタカナ「ホルモン」のページに当たる
  // （カナ正規化＋あいまい一致が効いていること）。
  await page.goto('/search/?q=ほるもん');
  const results = page.locator('#search-results');
  await expect(results.locator('.search-result').first()).toBeVisible();
  await expect(results).toContainText('ホルモン療法');

  // ヘッダーの検索フォームはどのページにも出ている（モバイルではアイコンのみ）。
  await page.goto('/basics/');
  await expect(page.locator('.header-search')).toBeVisible();
  await expect(page.locator('.header-search')).toHaveAttribute('action', '/search/');
});

test('サイト内検索は別名で引いた用語を本文言及より上位に出す', async ({ page }) => {
  // 「性自認」は 性同一性 の別名。多くのページが本文で言及するが、別名で当たる
  // 用語ページ（性同一性）が先頭に来る（別名フィールドを本文より高く採点）。
  await page.goto('/search/?q=性自認');
  const first = page.locator('#search-results .search-result').first();
  await expect(first.locator('.search-result-title')).toHaveText('性同一性');
  await expect(first.locator('.search-result-kind')).toHaveText('用語');
});

test('サイト内検索はかな入力・略語の一致をハイライトする', async ({ page }) => {
  // ひらがな「ほるもん」がカタカナ「ホルモン」を、（リテラル一致ではなく正規化を
  // たどって）タイトル上でハイライトする。
  await page.goto('/search/?q=ほるもん');
  const first = page.locator('#search-results .search-result').first();
  await expect(first.locator('mark').first()).toHaveText('ホルモン');

  // 略語 SRS は同義語（性別適合手術）としても展開され、その同義語が結果タイトル上で
  // ハイライトされる（クエリ語だけでなく同義語も光らせる）。
  await page.goto('/search/?q=SRS');
  const srs = page
    .locator('#search-results .search-result')
    .filter({ has: page.getByText('性別適合手術', { exact: true }) })
    .first();
  await expect(srs.locator('.search-result-title mark')).toHaveText('性別適合手術');
});

test('サイト内検索は同義語も一緒にハイライトする', async ({ page }) => {
  // 「性自認」で検索すると、同じ概念の別名「性同一性」も結果上でハイライトされる。
  // 先頭結果（性同一性の用語ページ）はタイトルが同義語としてハイライトされ、
  // 結果全体に「性自認」と「性同一性」両方のマークが出る。
  await page.goto('/search/?q=性自認');
  const first = page.locator('#search-results .search-result').first();
  await expect(first.locator('.search-result-title mark')).toHaveText('性同一性');
  const marks = await first.locator('mark').allTextContents();
  expect(marks).toContain('性自認');
  expect(marks).toContain('性同一性');
});

test('サイト内検索は「〜とは」などの語尾を落として用語を引ける', async ({ page }) => {
  // 「性自認とは」は、語尾「とは」を落とさないと 性自認 に一致せず用語ページが
  // 出てこない（評価セットで rank ∞ → 1）。search-core の語尾トリムが効くこと。
  await page.goto('/search/?q=性自認とは');
  const first = page.locator('#search-results .search-result').first();
  await expect(first.locator('.search-result-title')).toHaveText('性同一性');
  await expect(first.locator('.search-result-kind')).toHaveText('用語');
});

test('用語集フィルタは一致箇所をカード上でハイライトする', async ({ page }) => {
  await page.goto('/glossary/');
  const search = page.getByLabel('用語を検索');

  // 別名「性自認」が 性同一性 のカード上でハイライトされる。
  await search.fill('性自認');
  const sei = page
    .locator('.glossary-card:not([hidden])')
    .filter({ has: page.locator('.clinic-name', { hasText: '性同一性' }) })
    .first();
  await expect(sei.locator('mark').first()).toHaveText('性自認');

  // 読み（ひらがな）で引いた漢字語は、見える文字に一致がないので「一致」ヒント
  // 行に読みをハイライトして、なぜ当たったかを示す。
  await search.fill('せいどういつせい');
  const seiByReading = page
    .locator('.glossary-card:not([hidden])')
    .filter({ has: page.locator('.clinic-name', { hasText: '性同一性' }) })
    .first();
  await expect(seiByReading.locator('.glossary-match-hint mark')).toHaveText('せいどういつせい');
});

test('歴史の年表は人名や出来事を百科事典（ウィキペディア等）へリンクする', async ({ page }) => {
  await page.goto('/history/');

  // 年表の各出来事から、外部の百科事典へ新しいタブで安全に開くリンクが多数ある。
  const wikiLinks = page.locator(
    '.timeline-event a[href*="wikipedia.org"][target="_blank"]',
  );
  expect(await wikiLinks.count()).toBeGreaterThanOrEqual(30);

  // 外部リンクは rel="noreferrer" を付けて開く。
  await expect(wikiLinks.first()).toHaveAttribute('rel', /noreferrer/);

  // 代表的な項目: ストーンウォールの反乱は日本語版ウィキペディアへ。
  await expect(
    page.locator('.timeline-event a[href*="ja.wikipedia.org"]').first(),
  ).toBeVisible();
});

test('知る・学ぶは記事をテーマ別に分け、タグと主要ページへの導線を持つ', async ({ page }) => {
  await page.goto('/learn/');

  // テーマごとのセクション（見出しは furigana ruby を含むので aria-label で判定）。
  await expect(page.locator('section[aria-label="からだと医療"]')).toBeVisible();
  await expect(page.locator('section[aria-label="調べる・参考資料"]')).toBeVisible();

  // 以前は載っていなかった主要ページへの導線がカードとしてある。
  for (const href of ['/map/', '/resources/', '/library/', '/reference/']) {
    await expect(page.locator(`.topic-item[href="${href}"]`)).toBeVisible();
  }

  // 記事カードは話題のタグを表示し、タグは /tags/ をたどれる。
  const tagChips = page.locator('.topic-tags a.page-tag[href^="/tags/"]');
  expect(await tagChips.count()).toBeGreaterThanOrEqual(20);

  // カード本体（大きなリンク）とタグ（独立リンク）は別々に押せる。
  const card = page.locator('.topic-item[href="/hrt-effects/"]');
  await expect(card).toBeVisible();
});

test('プライドページは Tokyo Pride の公式サイト（pride.tokyo）へリンクする', async ({ page }) => {
  await page.goto('/pride/');
  const link = page.locator('a[href="https://pride.tokyo/"]').first();
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('rel', /noreferrer/);
});

test('イベントバナーの一回性イベントは年指定で、定例より先に評価される', async ({ page }) => {
  await page.goto('/');
  const data = await page.locator('#event-banner-data').textContent();
  const events = JSON.parse(data ?? '[]') as Array<{ id: string; year?: number }>;

  const tp = events.findIndex((e) => e.id === 'tokyo-pride-2026');
  const month = events.findIndex((e) => e.id === 'pride-month');
  expect(tp).toBeGreaterThanOrEqual(0);
  // 一回性イベントは year を持ち、最初に一致するよう定例（プライド月間）より前に並ぶ。
  expect(events[tp].year).toBe(2026);
  expect(tp).toBeLessThan(month);
});
