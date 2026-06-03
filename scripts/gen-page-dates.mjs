// Derives each content page's created / last-updated date from git history (the
// repo is public), so freshness is shown without any manual frontmatter. Runs
// in prebuild and writes src/data/page-dates.json (route -> { created, updated }).
import { execSync } from 'node:child_process';
import fs from 'node:fs';

// Prose content pages where "when was this last updated" matters to the reader.
const ROUTES = [
  '/start/', '/basics/', '/gender/', '/orientation/', '/dysphoria/', '/transition/',
  '/hrt-effects/', '/hrt-medications/', '/fertility/', '/puberty-blockers/', '/voice/',
  '/presentation/', '/hair-removal/', '/surgery/', '/legal-change/', '/coming-out/',
  '/allies/', '/safety/', '/guidelines/', '/about/', '/legal/', '/data/',
];

const git = (args) => {
  try {
    return execSync(`git ${args}`, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

const out = {};
for (const route of ROUTES) {
  const file = `src/pages/${route.replace(/^\/|\/$/g, '')}.astro`;
  if (!fs.existsSync(file)) continue;
  const updated = git(`log -1 --format=%cs -- "${file}"`);
  // First commit that added the file (follows renames); fall back to oldest commit.
  const created =
    git(`log --diff-filter=A --follow --format=%cs -- "${file}" | tail -1`) ||
    git(`log --follow --format=%cs -- "${file}" | tail -1`) ||
    updated;
  if (updated) out[route] = { created: created || updated, updated };
}

fs.writeFileSync('src/data/page-dates.json', JSON.stringify(out, null, 2) + '\n');
console.log(`page-dates.json: ${Object.keys(out).length} pages dated from git`);
