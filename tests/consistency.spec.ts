import { expect, test } from '@playwright/test';

// Pages whose first element inside <main> is the primary content card.
const contentPages = [
  '/',
  '/start/',
  '/support/',
  '/allies/',
  '/basics/',
  '/gender/',
  '/dysphoria/',
  '/transition/',
  '/hrt-effects/',
  '/hrt-medications/',
  '/fertility/',
  '/voice/',
  '/presentation/',
  '/surgery/',
  '/hair-removal/',
  '/legal-change/',
  '/coming-out/',
  '/safety/',
  '/puberty-blockers/',
  '/learn/',
  '/bibliography/',
  '/flags/',
  '/pride/',
  '/works/',
  '/resources/',
  '/glossary/',
  '/clinics/',
  '/about/',
  '/legal/',
];

test.describe('レイアウトの一貫性', () => {
  for (const path of contentPages) {
    test(`${path} のメインカードはフッターと同じ幅・左端`, async ({ page }) => {
      await page.goto(path);
      const card = page.locator('main > .article-shell, main > .intro').first();
      const footer = page.locator('.site-footer');
      const c = await card.boundingBox();
      const f = await footer.boundingBox();
      expect(c, 'main card bounding box').not.toBeNull();
      expect(f, 'footer bounding box').not.toBeNull();
      // Same width and same left edge as the footer (within sub-pixel rounding).
      expect(Math.abs(c!.width - f!.width)).toBeLessThanOrEqual(1.5);
      expect(Math.abs(c!.x - f!.x)).toBeLessThanOrEqual(1.5);
    });
  }

  test('カードとフッターは同じ背景色・枠線色を使う', async ({ page }) => {
    await page.goto('/works/');
    const cssOf = (selector: string, prop: string) =>
      page.locator(selector).first().evaluate((node, p) => getComputedStyle(node).getPropertyValue(p), prop);

    expect(await cssOf('.article-shell', 'background-color')).toBe(await cssOf('.site-footer', 'background-color'));
    expect(await cssOf('.article-shell', 'border-top-color')).toBe(await cssOf('.site-footer', 'border-top-color'));
  });

  test('スローガンは左バー付きの引用として目立つ', async ({ page }) => {
    await page.goto('/start/');
    const message = page.locator('.entry-message').first();
    await expect(message).toBeVisible();
    const borderLeft = await message.evaluate((node) => getComputedStyle(node).borderLeftWidth);
    expect(Number.parseFloat(borderLeft)).toBeGreaterThanOrEqual(4);
  });

  test('はじめての導線がトップに表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'はじめに' })).toBeVisible();
    await expect(page.locator('.site-nav').getByRole('link', { name: 'はじめての方へ' })).toBeVisible();
  });
});
