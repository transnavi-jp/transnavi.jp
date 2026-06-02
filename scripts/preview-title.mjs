import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const candidates = [
  { name: '1. sky → rose (clean 2-tone)', g: 'linear-gradient(100deg, #56c2f5 0%, #f88fb5 100%)' },
  { name: '2. blue → lavender → pink', g: 'linear-gradient(100deg, #5ec6f5 0%, #b78fe6 50%, #f99dc2 100%)' },
  { name: '3. candy (brighter)', g: 'linear-gradient(110deg, #74d2f7 0%, #cf95f2 45%, #ff96c4 100%)' },
  { name: '4. aurora (4-stop)', g: 'linear-gradient(100deg, #57c7fa 0%, #8fcdf2 28%, #d7a3e6 62%, #ff9fc6 100%)' },
  { name: '5. deeper / richer', g: 'linear-gradient(95deg, #2f9fe6 0%, #9a6ad6 50%, #ff74ac 100%)' },
  { name: '6. pink → lavender → blue', g: 'linear-gradient(100deg, #f993bd 0%, #c49ae8 50%, #6fc8f4 100%)' },
  { name: '7. trans flag mirror', g: 'linear-gradient(100deg, #5bcefa 0%, #f5a9c4 38%, #cfa9e8 50%, #f5a9c4 62%, #5bcefa 100%)' },
  { name: '8. soft current (for compare)', g: 'linear-gradient(95deg, #7fc8f2 0%, #c4a8e6 50%, #f6aecb 100%)' },
];

const rows = candidates.map((c) => `
  <div class="row">
    <span class="label">${c.name}</span>
    <span class="title" style="background:${c.g}; -webkit-background-clip:text; background-clip:text; color:transparent;">とらんすナビ</span>
  </div>`).join('');

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;800&display=swap" rel="stylesheet">
<style>
  *{margin:0;box-sizing:border-box}
  body{padding:36px 44px; font-family:'M PLUS Rounded 1c',sans-serif;
    background: radial-gradient(circle at top left, rgba(255,207,227,0.45), transparent 26%), radial-gradient(circle at top right, rgba(153,216,253,0.35), transparent 28%), linear-gradient(180deg,#fff8fc,#f6fbff 42%,#f9fcff);}
  .row{display:flex; align-items:center; gap:28px; padding:14px 0; border-bottom:1px solid rgba(154,207,243,0.3);}
  .label{width:230px; flex:none; color:#6f7894; font-size:15px; font-weight:800;}
  .title{font-weight:800; font-size:46px; letter-spacing:-0.03em; line-height:1.15;}
</style></head><body>${rows}</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 760, height: 720 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(200);
await page.screenshot({ path: resolve(root, 'scripts/title-options.png'), fullPage: true });
await browser.close();
writeFileSync(resolve(root, 'scripts/.t-done'), 'ok');
console.log('rendered', candidates.length, 'options');
