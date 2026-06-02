import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

// Source can be overridden (e.g. to import from a merged set of MtF.wiki PR
// branches) via the MTF_DOCS env var; defaults to the local checkout.
const sourceRoot = process.env.MTF_DOCS || join('..', 'MtF-wiki', 'content', 'ja', 'docs');
const outputPath = join('src', 'data', 'clinics.json');

// All 47 prefectures, so clinics in any prefecture import with a Japanese label.
const prefectureLabels = {
  hokkaido: '北海道', aomori: '青森県', iwate: '岩手県', miyagi: '宮城県', akita: '秋田県',
  yamagata: '山形県', fukushima: '福島県', ibaraki: '茨城県', tochigi: '栃木県', gunma: '群馬県',
  saitama: '埼玉県', chiba: '千葉県', tokyo: '東京都', kanagawa: '神奈川県', niigata: '新潟県',
  toyama: '富山県', ishikawa: '石川県', fukui: '福井県', yamanashi: '山梨県', nagano: '長野県',
  gifu: '岐阜県', shizuoka: '静岡県', aichi: '愛知県', mie: '三重県', shiga: '滋賀県',
  kyoto: '京都府', osaka: '大阪府', hyogo: '兵庫県', nara: '奈良県', wakayama: '和歌山県',
  tottori: '鳥取県', shimane: '島根県', okayama: '岡山県', hiroshima: '広島県', yamaguchi: '山口県',
  tokushima: '徳島県', kagawa: '香川県', ehime: '愛媛県', kochi: '高知県', fukuoka: '福岡県',
  saga: '佐賀県', nagasaki: '長崎県', kumamoto: '熊本県', oita: '大分県', miyazaki: '宮崎県',
  kagoshima: '鹿児島県', okinawa: '沖縄県',
};

const serviceLabels = {
  hrt: 'ホルモン療法',
  psyco: '精神科・診断',
};

const skipNames = new Set(['_index.md']);

async function listMarkdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return listMarkdownFiles(path);
      if (entry.isFile() && entry.name.endsWith('.md') && !skipNames.has(entry.name)) return [path];
      return [];
    }),
  );
  return files.flat();
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { data: {}, body: markdown };
  const data = {};
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    data[key] = value.replace(/^['"]|['"]$/g, '');
  }
  return { data, body: markdown.slice(match[0].length) };
}

function cleanupText(text) {
  return text
    .replaceAll('{{< mtf-wiki >}}', 'MtF.wiki')
    .replace(/{{<\s*telephone\s+"([^"]+)"\s*>}}/g, '$1')
    .replace(/{{<\s*alert[^>]*>}}/g, '')
    .replace(/{{<\s*\/alert\s*>}}/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function firstMatch(lines, regex) {
  for (const line of lines) {
    const match = line.match(regex);
    if (match) return match[1].trim();
  }
  return undefined;
}

function extractUrls(body) {
  return [...new Set([...body.matchAll(/https?:\/\/[^\s>)]+/g)].map((match) => match[0]))];
}

function extractAddress(lines) {
  return firstMatch(lines, /^[-*]?\s*((?:〒\s*)?\d{3}-?\d{4}.+)$/) ?? firstMatch(lines, /^[-*]?\s*((?:東京都|北海道|(?:京都|大阪)府|.{2,3}県).+)$/);
}

function cityFromTitle(title) {
  const match = title.match(/^(.+?)[・･](.+)$/);
  return match ? match[1].trim() : undefined;
}

function nameFromTitle(title) {
  const match = title.match(/^(.+?)[・･](.+)$/);
  return (match ? match[2] : title).trim();
}

function slugFromPath(path) {
  const withoutExt = path.replace(/\.md$/, '').replace(/\/index$/, '');
  return withoutExt.split('/').filter(Boolean).join('-');
}

const files = [
  ...(await listMarkdownFiles(join(sourceRoot, 'hrt'))),
  ...(await listMarkdownFiles(join(sourceRoot, 'psyco'))),
];

const clinics = [];
const skipped = [];

for (const file of files) {
  const markdown = await readFile(file, 'utf8');
  const { data, body } = parseFrontmatter(markdown);
  if (!data.title) continue;

  const parts = relative(sourceRoot, file).split('/');
  const serviceKey = parts[0];
  const prefectureKey = parts[1];
  // Skip non-clinic top-level pages (e.g. hrt/online.md overview) and any file
  // not under a known prefecture directory.
  if (!prefectureLabels[prefectureKey]) {
    skipped.push(relative(sourceRoot, file));
    continue;
  }
  const relativeSource = `content/ja/docs/${relative(sourceRoot, file)}`;
  const cleanedBody = cleanupText(body);
  const lines = cleanedBody
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);

  clinics.push({
    id: slugFromPath(relative(sourceRoot, file)),
    name: nameFromTitle(data.title),
    displayName: data.title,
    prefecture: prefectureLabels[prefectureKey] ?? prefectureKey,
    city: cityFromTitle(data.title),
    address: extractAddress(lines),
    phone: firstMatch(lines, /(?:電話|TEL|Tel)[:：]?\s*([0-9-]+)/i),
    urls: extractUrls(cleanedBody),
    services: [serviceLabels[serviceKey] ?? serviceKey],
    source: {
      project: 'MtF.wiki',
      path: relativeSource,
      license: 'CC BY-SA 4.0',
    },
    verificationStatus: '要確認',
    importedAt: '2026-06-03',
    notes: cleanedBody,
  });
}

clinics.sort((a, b) => `${a.prefecture}${a.name}`.localeCompare(`${b.prefecture}${b.name}`, 'ja'));

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(`${outputPath}`, `${JSON.stringify(clinics, null, 2)}\n`);

console.log(`Imported ${clinics.length} clinic entries to ${outputPath}`);
if (skipped.length) console.log(`Skipped ${skipped.length} non-clinic file(s): ${skipped.join(', ')}`);
