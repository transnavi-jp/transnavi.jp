import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const logo = readFileSync(resolve(root, 'public/favicon.svg'), 'utf8');

// OG card built from the site's own tokens (global.css :root + body background)
// and the M PLUS Rounded 1c webfont the site uses, so the share image matches
// the real pages rather than looking like a generic banner.
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    display: flex; align-items: center; justify-content: center;
    font-family: 'M PLUS Rounded 1c', sans-serif;
    background:
      radial-gradient(circle at top left, rgba(255, 207, 227, 0.55), transparent 30%),
      radial-gradient(circle at top right, rgba(153, 216, 253, 0.42), transparent 32%),
      linear-gradient(180deg, #fff8fc 0%, #f6fbff 42%, #f9fcff 100%);
  }
  .card {
    width: 1000px; padding: 64px 80px 72px;
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(154, 207, 243, 0.55);
    border-radius: 40px;
    box-shadow: 0 28px 70px rgba(154, 207, 243, 0.22);
    display: flex; flex-direction: column; align-items: center; text-align: center;
  }
  .mark { width: 150px; height: 150px; }
  .mark svg { width: 100%; height: 100%; display: block; }
  .title {
    margin-top: 18px; font-size: 110px; font-weight: 800;
    letter-spacing: -0.05em; line-height: 1.05; color: #4a5d80;
  }
  .subtitle { margin-top: 10px; font-size: 39px; font-weight: 500; color: #6f7894; }
  .stripe {
    width: 196px; height: 13px; margin: 30px 0 18px; border-radius: 999px;
    background: linear-gradient(90deg, #5BCEFA 0 20%, #F5A9B8 20% 40%, #ffffff 40% 60%, #F5A9B8 60% 80%, #5BCEFA 80% 100%);
    box-shadow: 0 4px 14px rgba(91, 206, 250, 0.28);
  }
  .url { font-size: 33px; font-weight: 700; letter-spacing: 0.04em; color: #4ba8ea; }
</style></head>
<body>
  <div class="card">
    <div class="mark">${logo}</div>
    <div class="title">とらんすナビ</div>
    <div class="subtitle">日本のトランスジェンダー情報ウィキ</div>
    <div class="stripe"></div>
    <div class="url">transnavi.jp</div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(200);
const out = resolve(root, 'scripts/og@2x.png');
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
writeFileSync(resolve(root, 'scripts/.og-done'), 'ok');
console.log('rendered', out);
