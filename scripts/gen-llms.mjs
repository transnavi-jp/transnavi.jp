// Post-build: generate /llms.txt (index) and /llms-full.txt (full text) from the
// built HTML in dist/, so LLMs can read the whole site as clean markdown.
// Runs automatically after `astro build` via the npm "postbuild" hook.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const SITE = 'https://transnavi.jp';

// Prose pages, grouped — content is extracted from their built HTML.
const sections = [
  { title: 'はじめの一歩', routes: ['/', '/start/', '/basics/'] },
  { title: '性別と自分を知る', routes: ['/gender/', '/dysphoria/'] },
  { title: '性別移行・からだと医療', routes: ['/transition/', '/puberty-blockers/', '/hrt-effects/', '/hrt-medications/', '/fertility/', '/voice/', '/presentation/', '/hair-removal/', '/surgery/'] },
  { title: '暮らしと社会', routes: ['/coming-out/', '/allies/', '/safety/', '/legal-change/', '/flags/', '/pride/'] },
  { title: '相談・地域', routes: ['/support/', '/clinics/', '/map/'] },
  { title: 'このサイト', routes: ['/about/', '/legal/', '/edit/'] },
];

const decode = (s) => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));

function readHtml(route) {
  const rel = route === '/' ? 'index.html' : `${route.replace(/^\/|\/$/g, '')}/index.html`;
  const p = resolve(dist, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

function mainOf(html) {
  const m = html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
  return m ? m[1] : html;
}

// Strip navigation / interactive / heavy blocks that aren't reading content.
function clean(s) {
  return s
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<nav class="breadcrumbs"[\s\S]*?<\/nav>/g, '')
    .replace(/<a class="back-top"[\s\S]*?<\/a>/g, '')
    .replace(/<nav class="[^"]*entry-related[^"]*"[\s\S]*?<\/nav>/g, '')
    .replace(/<nav class="hero-nav"[\s\S]*?<\/nav>/g, '')
    .replace(/<div class="route-list"[\s\S]*?<\/div>/g, '')
    .replace(/<div class="word-chips"[\s\S]*?<\/div>/g, '')
    .replace(/<div class="hero-people"[\s\S]*?<\/div>/g, '')
    .replace(/<form[\s\S]*?<\/form>/g, '')
    .replace(/<div class="filter-group-row"[\s\S]*?<\/section>\s*<\/div>/g, '')
    .replace(/<section class="filter-tabs"[\s\S]*?<\/section>/g, '')
    .replace(/<div class="works-table-wrap"[\s\S]*?<\/div>/g, '')
    .replace(/<details class="clinic-region"[\s\S]*?<\/details>/g, '')
    .replace(/<div class="clinic-summary"[\s\S]*?<\/div>/g, '')
    .replace(/<div id="map"[\s\S]*?<\/div>/g, '')
    .replace(/<div class="map-legend"[\s\S]*?<\/div>/g, '');
}

function toMarkdown(inner) {
  let s = clean(inner);
  // inline
  s = s
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (_, href, t) => `[${t.replace(/<[^>]+>/g, '').trim()}](${href})`)
    .replace(/<strong>([\s\S]*?)<\/strong>/g, '**$1**')
    .replace(/<b>([\s\S]*?)<\/b>/g, '**$1**')
    .replace(/<em>([\s\S]*?)<\/em>/g, '*$1*')
    .replace(/<br\s*\/?>(\n)?/g, '\n');
  // block
  s = s
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/g, (_, t) => `\n# ${t.trim()}\n`)
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, (_, t) => `\n## ${t.trim()}\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, (_, t) => `\n### ${t.trim()}\n`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/g, (_, t) => `- ${t.trim()}\n`)
    .replace(/<dt[^>]*>([\s\S]*?)<\/dt>/g, (_, t) => `\n**${t.trim()}**\n`)
    .replace(/<dd[^>]*>([\s\S]*?)<\/dd>/g, (_, t) => `${t.trim()}\n`)
    .replace(/<p[^>]*class="eyebrow"[^>]*>[\s\S]*?<\/p>/g, '')
    .replace(/<div class="eyebrow"[^>]*>[\s\S]*?<\/div>/g, '')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/g, (_, t) => `\n${t.trim()}\n`);
  // strip remaining tags, decode, tidy
  s = decode(s.replace(/<[^>]+>/g, ' '));
  s = s.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

function firstLead(inner) {
  const m = clean(inner).match(/<p class="lead"[^>]*>([\s\S]*?)<\/p>/) || clean(inner).match(/<p[^>]*>([\s\S]*?)<\/p>/);
  if (!m) return '';
  return decode(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}
function h1Of(inner) {
  const m = inner.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  return m ? decode(m[1].replace(/<[^>]+>/g, '').trim()) : '';
}

const intro = `日本で暮らすトランスジェンダー・ノンバイナリー・ジェンダーに悩む人（特に若い人）のための、やさしい情報サイト。方針は「決めつけない・急がせない・でも放置しない」。`;

// --- build full text + index ---
let full = `# とらんすナビ (transnavi.jp) — 全文テキスト\n\n> ${intro}\n\nこのファイルは、サイトの内容を LLM が読みやすいテキストにまとめたものです（自動生成）。索引は ${SITE}/llms.txt にあります。\n`;
let index = `# とらんすナビ (transnavi.jp)\n\n> ${intro}\n\nこのファイルは、サイトを LLM 向けにまとめた索引です。全文テキストは ${SITE}/llms-full.txt にあります。\n`;

for (const sec of sections) {
  index += `\n## ${sec.title}\n`;
  for (const route of sec.routes) {
    const html = readHtml(route);
    if (!html) continue;
    const inner = mainOf(html);
    const title = h1Of(inner) || route;
    const desc = firstLead(inner);
    const url = `${SITE}${route}`;
    index += `- [${title}](${url})${desc ? `: ${desc}` : ''}\n`;
    full += `\n\n---\n\nURL: ${url}\n\n${toMarkdown(inner)}\n`;
  }
}

// --- glossary (from data, full) ---
const glossary = JSON.parse(readFileSync(resolve(root, 'src/data/glossary.json'), 'utf8'));
full += `\n\n---\n\n# 用語集（全${glossary.length}語）\nURL: ${SITE}/glossary/\n\n`;
for (const g of glossary) {
  const alias = g.aliases?.length ? `（別名: ${g.aliases.join('、')}）` : '';
  const en = g.translations?.en ? ` [${g.translations.en}]` : '';
  full += `**${g.term}${g.abbr ? `（${g.abbr}）` : ''}**${alias}${en}: ${g.notes || ''}\n`;
}

// --- data pointers (index) ---
const clinics = JSON.parse(readFileSync(resolve(root, 'src/data/clinics.json'), 'utf8'));
const works = JSON.parse(readFileSync(resolve(root, 'src/data/works.json'), 'utf8'));
index += `\n## 参照データ\n`;
index += `- [用語集](${SITE}/glossary/): ${glossary.length}語（全文は llms-full.txt に収録）\n`;
index += `- [医療機関](${SITE}/clinics/): ${clinics.length}件（ホルモン療法・診断など）\n`;
index += `- [文芸作品データベース](${SITE}/works/): ${works.length}作品\n`;
index += `- [地図で探す](${SITE}/map/): 医療機関・団体・イベントの地図\n`;
index += `\n## ソース\n- GitHub: https://github.com/transnavi/transnavi.jp\n- ライセンス: コード MIT / コンテンツ CC BY-SA 4.0\n`;

writeFileSync(resolve(dist, 'llms.txt'), index + '\n');
writeFileSync(resolve(dist, 'llms-full.txt'), full + '\n');
console.log(`llms.txt (${index.length}B) + llms-full.txt (${full.length}B) written`);
