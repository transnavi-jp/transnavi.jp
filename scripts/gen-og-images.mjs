// Per-page Open Graph cards. For each main route we render a branded 1200x630
// PNG: the page title (broken at natural Japanese phrase points with BudouX),
// the logo, a category tag, and the trans-flag stripe, on a soft pink/blue
// gradient. satori -> resvg, into dist/og/<slug>.png. The homepage keeps the
// hand-made /og-image.png (see og-routes.mjs / BaseLayout). Runs in postbuild.
import fs from 'node:fs';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { loadDefaultJapaneseParser } from 'budoux';
import { OG_ROUTES, ROUTE_CATEGORY, COLLECTION_CATEGORY, slugForRoute } from '../src/data/og-routes.mjs';

const FONT_BOLD = fs.readFileSync('scripts/assets/MPLUSRounded1c-Bold.ttf');
const LOGO = 'data:image/png;base64,' + fs.readFileSync('public/icon-192.png').toString('base64');
const parser = loadDefaultJapaneseParser();

function titleFor(route) {
  const file = route === '/' ? 'dist/index.html' : `dist${route}index.html`;
  if (!fs.existsSync(file)) return null;
  const m = fs.readFileSync(file, 'utf8').match(/<title>([^<]*)<\/title>/);
  if (!m) return null;
  const t = m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  return t.split(' - ')[0].trim();
}

// Rough advance width in em (full-width ~1, ascii/half-width ~0.5).
const charW = (ch) => (/[\x00-\x7F｡-ﾟ]/.test(ch) ? 0.5 : 1);
const strW = (s) => [...s].reduce((a, c) => a + charW(c), 0);

// Break a title into lines at natural points: BudouX phrases, also allowing a
// break after 「・」 and around 「（」, then greedy-fill to maxEm per line.
function wrapTitle(title, maxEm) {
  const units = [];
  for (const ph of parser.parse(title)) {
    for (const part of ph.split(/(?<=・)|(?=（)|(?<=）)/)) if (part) units.push(part);
  }
  const lines = [];
  let cur = '';
  for (const u of units) {
    if (cur && strW(cur + u) > maxEm) { lines.push(cur); cur = u; } else cur += u;
  }
  if (cur) lines.push(cur);
  return lines;
}

const h = (type, style, children) => ({ type, props: children === undefined ? { style } : { style, children } });
const TRANS = ['#5BCEFA', '#F5A9B8', '#FFFFFF', '#F5A9B8', '#5BCEFA'];

function card(title, category) {
  // Pick a size that keeps the title to <=3 comfortable lines.
  const W = 1018; // content width in px (1200 - flag bar - padding)
  let size = 70;
  let lines = wrapTitle(title, W / size);
  if (lines.length > 3) { size = 58; lines = wrapTitle(title, W / size); }
  if (lines.length > 3) { size = 50; lines = wrapTitle(title, W / size); }

  return h('div', {
    width: '1200px', height: '630px', display: 'flex',
    fontFamily: 'M PLUS Rounded 1c',
    background: 'linear-gradient(125deg, #ffdcec 0%, #f4e8fb 46%, #ddecff 100%)',
  }, [
    // trans-flag stripe down the left edge
    h('div', { display: 'flex', flexDirection: 'column', width: '24px', height: '630px' },
      TRANS.map((c) => h('div', { display: 'flex', background: c, flexGrow: 1, width: '24px' }))),
    // content
    h('div', {
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      height: '630px', flexGrow: 1, padding: '62px 76px', position: 'relative',
    }, [
      // soft decorative bubble for depth
      h('div', { position: 'absolute', right: '-90px', bottom: '-130px', width: '360px', height: '360px', borderRadius: '50%', background: 'rgba(255,255,255,0.4)', display: 'flex' }),
      // top: logo + brand .... category pill
      h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
        h('div', { display: 'flex', alignItems: 'center' }, [
          { type: 'img', props: { src: LOGO, width: 72, height: 72, style: { borderRadius: '18px', marginRight: '20px' } } },
          h('div', { display: 'flex', fontSize: '34px', fontWeight: 700, color: '#2b90e7' }, 'とらんすナビ'),
        ]),
        category
          ? h('div', {
              display: 'flex', alignItems: 'center', padding: '10px 26px', borderRadius: '999px',
              fontSize: '27px', fontWeight: 700, color: '#ffffff',
              background: 'linear-gradient(90deg, #f288b1 0%, #8ea6e8 55%, #5bb8ef 100%)',
              boxShadow: '0 6px 16px rgba(232,120,170,0.28)',
            }, category)
          : h('div', { display: 'flex' }),
      ]),
      // title (BudouX-wrapped, one div per line)
      h('div', { display: 'flex', flexDirection: 'column' },
        lines.map((ln) => h('div', { display: 'flex', fontSize: `${size}px`, fontWeight: 700, color: '#39405c', lineHeight: 1.32 }, ln))),
      // bottom: tagline .... url
      h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
        h('div', { display: 'flex', fontSize: '25px', color: '#8a90ad' }, '日本のトランスジェンダー情報ウィキ'),
        h('div', { display: 'flex', fontSize: '28px', fontWeight: 800, color: '#ef6ea6' }, 'transnavi.jp'),
      ]),
    ]),
  ]);
}

// Collection detail pages (every built /glossary/x/, /clinics/x/, …) each get
// their own card so a shared glossary term or clinic previews with its own name
// instead of the generic index card.
function walkRoutes(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...walkRoutes(`${dir}/${e.name}`));
    else if (e.name === 'index.html') out.push(`${dir.replace(/^dist/, '')}/`);
  }
  return out;
}
const detailRoutes = Object.keys(COLLECTION_CATEGORY).flatMap((base) => {
  const dir = `dist${base}`.replace(/\/$/, '');
  return fs.existsSync(dir) ? walkRoutes(dir).filter((r) => r !== base) : [];
});

const categoryFor = (route) =>
  ROUTE_CATEGORY[route] ??
  Object.entries(COLLECTION_CATEGORY).find(([base]) => route.startsWith(base))?.[1];

fs.rmSync('dist/og', { recursive: true, force: true });
fs.mkdirSync('dist/og', { recursive: true });
let n = 0;
for (const route of [...OG_ROUTES, ...detailRoutes]) {
  const title = titleFor(route);
  if (!title) continue;
  const svg = await satori(card(title, categoryFor(route)), {
    width: 1200, height: 630,
    fonts: [{ name: 'M PLUS Rounded 1c', data: FONT_BOLD, weight: 700, style: 'normal' }],
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  fs.writeFileSync(`dist/og/${slugForRoute(route)}.png`, png);
  n++;
}
console.log(`og images: ${n} cards written to dist/og/ (${detailRoutes.length} collection entries)`);
