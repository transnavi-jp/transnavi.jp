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

test('医療機関ページは主観的コメント欄を表示しない', async ({ page }) => {
  await page.goto('/clinics/hrt-tokyo-gender-clinic/');

  await expect(page.locator('h1')).toContainText('東京ジェンダークリニック');
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

  await expect(page.locator('.glossary-card', { hasText: 'インフォームドコンセントモデル' })).toBeVisible();
  await expect(page.locator('.glossary-card', { hasText: 'カミングアウト' })).toBeHidden();
  await expect(page.locator('[data-filter-count]')).toHaveText('1');
});

test('MtF.wiki の免責事項を自サイトの資料として掲載しない', async ({ page }) => {
  await page.goto('/library/');

  await expect(page.locator('body')).not.toContainText('免責事項');
  await expect(page.getByRole('link', { name: /免責事項/ })).toHaveCount(0);
});

test('関連サイトページに 2345.LGBT 由来の外部リンクを表示する', async ({ page }) => {
  await page.goto('/resources/');

  await expect(page.locator('h1')).toContainText('関連サイト');
  await expect(page.getByRole('link', { name: /全国医療地図/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /日本 GID\/GD と共に生きる人々の会/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /はじめてのトランスジェンダー trans101\.jp/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Tネット/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /虹色ダイバーシティ/ }).first()).toBeVisible();
});

test('文芸作品データベースに 2345.LGBT 由来の作品を掲載する', async ({ page }) => {
  await page.goto('/works/');

  await expect(page.locator('h1')).toContainText('文芸作品');
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
