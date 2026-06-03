// Per-page Open Graph cards. For each prose route we render a branded 1200x630
// PNG (the page title on the site's pink/blue card) with satori -> resvg, into
// dist/og/<slug>.png. BaseLayout points og:image at the matching slug; pages
// without a card fall back to /og-image.png. Runs in postbuild (needs dist HTML).
import fs from 'node:fs';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const FONT = fs.readFileSync('scripts/assets/MPLUSRounded1c-Bold.ttf');
const pageDates = JSON.parse(fs.readFileSync('src/data/page-dates.json', 'utf8'));
const routes = ['/', ...Object.keys(pageDates)];

const slugFor = (route) => (route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replace(/\//g, '-'));

function titleFor(route) {
  const file = route === '/' ? 'dist/index.html' : `dist${route}index.html`;
  if (!fs.existsSync(file)) return null;
  const m = fs.readFileSync(file, 'utf8').match(/<title>([^<]*)<\/title>/);
  if (!m) return null;
  const t = m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  return t.split(' - ')[0].trim();
}

const h = (type, style, children) => ({ type, props: { style, children } });
const TRANS = ['#5BCEFA', '#F5A9B8', '#FFFFFF', '#F5A9B8', '#5BCEFA'];

function card(title) {
  const size = title.length > 22 ? 58 : title.length > 14 ? 66 : 74;
  return h('div', {
    width: '1200px', height: '630px', display: 'flex',
    background: 'linear-gradient(135deg, #ffe1ee 0%, #e7f1ff 100%)',
    fontFamily: 'M PLUS Rounded 1c',
  }, [
    h('div', { display: 'flex', flexDirection: 'column', width: '22px', height: '630px' },
      TRANS.map((c) => h('div', { display: 'flex', background: c, flexGrow: 1, width: '22px' }, ''))),
    h('div', {
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      height: '630px', flexGrow: 1, padding: '74px 84px',
    }, [
      h('div', { display: 'flex', fontSize: '38px', fontWeight: 700, color: '#2b90e7' }, 'とらんすナビ'),
      h('div', { display: 'flex', fontSize: `${size}px`, fontWeight: 700, color: '#3a3f5a', lineHeight: 1.3 }, title),
      h('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '27px' }, [
        h('div', { display: 'flex', color: '#8a90ad' }, '日本のトランスジェンダー情報ウィキ'),
        h('div', { display: 'flex', color: '#e8589b', fontWeight: 700 }, 'transnavi.jp'),
      ]),
    ]),
  ]);
}

fs.mkdirSync('dist/og', { recursive: true });
let n = 0;
for (const route of routes) {
  const title = titleFor(route);
  if (!title) continue;
  const svg = await satori(card(title), {
    width: 1200, height: 630,
    fonts: [{ name: 'M PLUS Rounded 1c', data: FONT, weight: 700, style: 'normal' }],
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  fs.writeFileSync(`dist/og/${slugFor(route)}.png`, png);
  n++;
}
console.log(`og images: ${n} cards written to dist/og/`);
