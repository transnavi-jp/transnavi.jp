// Prepend `@charset "UTF-8";` to every built CSS file.
//
// Astro/Vite emit the bundled CSS as UTF-8 but without an @charset rule, and the
// Worker serves .css as `text/css` with no charset parameter. With neither, a
// browser may decode the stylesheet as Latin-1, so a `content: '✓'` (or an
// arrow, or a Japanese ::before label) renders as mojibake like "âœ“". An
// in-file @charset rule is the highest-priority encoding signal per the CSS spec,
// so it fixes this regardless of how/where the file is served. Runs in postbuild,
// after the bundler, so the rule can't be stripped or un-escaped away.
import fs from 'node:fs';

const cssFiles = fs
  .readdirSync('dist', { recursive: true })
  .filter((f) => typeof f === 'string' && f.endsWith('.css'))
  .map((f) => 'dist/' + f);

let n = 0;
for (const file of cssFiles) {
  const css = fs.readFileSync(file, 'utf8');
  if (css.startsWith('@charset')) continue;
  // Strip a leading BOM if present (a BOM also declares UTF-8, but @charset is
  // the conventional, tool-friendly form).
  const body = css.charCodeAt(0) === 0xfeff ? css.slice(1) : css;
  fs.writeFileSync(file, '@charset "UTF-8";\n' + body);
  n++;
}
console.log(`css charset: prepended @charset "UTF-8" to ${n}/${cssFiles.length} CSS file(s)`);
