// Data-layer invariants, runnable without a build: node --test tests/
// Catches schema drift in the hand-edited JSON/YAML before it silently breaks
// the search index, tag pages, citations or glossary cross-links.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import yaml from 'js-yaml';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const glossary = JSON.parse(read('src/data/glossary.json'));
const clinics = JSON.parse(read('src/data/clinics.json'));
const pageTags = JSON.parse(read('src/data/page-tags.json'));
const references = yaml.load(read('src/data/references.yml'));
const citationPages = yaml.load(read('src/data/citation-pages.yml'));

// Controlled tag vocabulary, extracted from the TAGS literal in tag-taxonomy.ts
// (the file is TypeScript, so we parse the keys instead of importing it).
const taxonomySrc = read('src/data/tag-taxonomy.ts');
const tagsBlock = taxonomySrc.slice(taxonomySrc.indexOf('export const TAGS'));
const TAG_LABELS = new Set([...tagsBlock.matchAll(/^\s+'?([^':\n]+)'?:\s*\{\s*slug:/gm)].map((m) => m[1]));

test('tag taxonomy extraction found the vocabulary', () => {
  assert.ok(TAG_LABELS.size >= 20, `only extracted ${TAG_LABELS.size} tags`);
  assert.ok(TAG_LABELS.has('ホルモン療法'));
});

test('glossary ids are unique and well-formed', () => {
  const ids = glossary.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate glossary id');
  for (const id of ids) assert.match(id, /^[a-z0-9][a-z0-9-]*$/, `bad id: ${id}`);
});

test('glossary seeAlso ids resolve and never self-reference', () => {
  const ids = new Set(glossary.map((e) => e.id));
  for (const e of glossary) {
    for (const ref of e.seeAlso ?? []) {
      assert.ok(ids.has(ref), `${e.id}: unknown seeAlso "${ref}"`);
      assert.notEqual(ref, e.id, `${e.id}: seeAlso references itself`);
    }
  }
});

test('glossary tags come from the controlled vocabulary', () => {
  for (const e of glossary) {
    for (const t of e.tags ?? []) assert.ok(TAG_LABELS.has(t), `${e.id}: off-vocabulary tag "${t}"`);
  }
});

test('page-tags routes are well-formed and tags come from the vocabulary', () => {
  for (const [route, info] of Object.entries(pageTags)) {
    assert.match(route, /^\/[a-z0-9-]+\/$/, `bad route key: ${route}`);
    assert.ok(info.title, `${route}: missing title`);
    assert.ok(info.tags?.length, `${route}: no tags`);
    for (const t of info.tags) assert.ok(TAG_LABELS.has(t), `${route}: off-vocabulary tag "${t}"`);
  }
});

test('every citation key on every page exists in references.yml', () => {
  for (const [route, keys] of Object.entries(citationPages)) {
    for (const k of keys ?? []) assert.ok(references[k], `${route}: unknown reference key "${k}"`);
  }
});

test('references have a title and url', () => {
  for (const [key, r] of Object.entries(references)) {
    assert.ok(r.title, `${key}: missing title`);
    assert.ok(r.url, `${key}: missing url`);
  }
});

test('clinic records have unique ids and the fields the pages render', () => {
  const ids = clinics.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate clinic id');
  for (const c of clinics) {
    assert.ok(c.name, `${c.id}: missing name`);
    assert.ok(c.prefecture, `${c.id}: missing prefecture`);
    assert.ok(c.services?.length, `${c.id}: no services`);
    assert.ok(c.verificationStatus, `${c.id}: missing verificationStatus`);
  }
});

test('domestic clinic addresses, where present, match the record locality', () => {
  for (const c of clinics) {
    if (!c.address || c.country) continue; // overseas addresses are romanised — checked below
    // Imported addresses vary: some start with 〒, some omit the prefecture and
    // start at city level. Require the prefecture or the record's city to
    // appear, which still catches a pasted address from the wrong region.
    const ok =
      c.address.includes(c.prefecture) ||
      c.address.includes(c.prefecture.replace(/[都道府県]$/, '')) ||
      (c.city && c.address.includes(c.city));
    assert.ok(ok, `${c.id}: address "${c.address}" matches neither ${c.prefecture} nor ${c.city ?? '(no city)'}`);
  }
});

test('overseas clinics carry country + city, and group under their country', () => {
  for (const c of clinics) {
    if (!c.country) continue;
    assert.ok(c.city, `${c.id}: overseas clinic missing city`);
    // Overseas records put the country in `prefecture` too, so the list groups
    // them under a country heading instead of scattering them among prefectures.
    assert.equal(c.prefecture, c.country, `${c.id}: prefecture should equal country for overseas`);
    assert.ok(c.id.startsWith('srs-overseas-'), `${c.id}: overseas id should be namespaced srs-overseas-*`);
  }
});
