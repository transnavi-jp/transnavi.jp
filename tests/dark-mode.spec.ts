import { expect, test } from '@playwright/test';

// Auto-detect "theme errors": elements that keep a light (near-white) background
// in dark mode, which leaves the light dark-mode text unreadable. This is the
// class of bug where a hardcoded `background: #fff` is not overridden for
// `:root[data-theme='dark']` (e.g. the /learn/ topic cards once were).

// WCAG relative luminance (0 = black, 1 = white) from a CSS rgb()/rgba() string.
function luminance(color: string): number {
  const parts = (color.match(/[\d.]+/g) ?? []).map(Number);
  const [r, g, b] = parts;
  const lin = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

// Pages that render clickable card surfaces with text on top.
const cardPages = ['/learn/', '/glossary/', '/clinics/'];
const cardSelector = '.topic-item, .article-link, .glossary-card, .clinic-card';

for (const path of cardPages) {
  test(`ダークモードでカードの背景が文字より暗い（${path}）`, async ({ page }) => {
    // Set the saved theme before the early inline theme script runs.
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    const cards = page.locator(cardSelector);
    const total = await cards.count();
    expect(total, `${path} should render cards`).toBeGreaterThan(0);

    const sample = Math.min(total, 8);
    for (let i = 0; i < sample; i++) {
      const { bg, fg } = await cards.nth(i).evaluate((el) => {
        const s = getComputedStyle(el);
        return { bg: s.backgroundColor, fg: s.color };
      });
      const bgLum = luminance(bg);
      const fgLum = luminance(fg);
      // In dark mode a card's background must be darker than its own text…
      expect(bgLum, `${path} card #${i}: bg=${bg} fg=${fg} (background not darker than text)`).toBeLessThan(fgLum);
      // …and must not be a near-white surface.
      expect(bgLum, `${path} card #${i}: bg=${bg} is too light for dark mode`).toBeLessThan(0.5);
    }
  });
}
