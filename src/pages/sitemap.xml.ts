import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import clinicsData from '../data/clinics.json';
import glossaryData from '../data/glossary.json';
import pageDates from '../data/page-dates.json';
import type { Clinic } from '../types/clinic';
import type { GlossaryEntry } from '../types/glossary';

const dates = pageDates as Record<string, { created: string; updated: string }>;

function escapeXml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export const GET: APIRoute = async ({ site }) => {
  const imported = await getCollection('imported');
  const clinics = clinicsData as Clinic[];
  const glossary = glossaryData as GlossaryEntry[];

  const paths = [
    '/',
    '/start/',
    '/faq/',
    '/support/',
    '/allies/',
    '/basics/',
    '/gender/',
    '/intersex/',
    '/dysphoria/',
    '/transition/',
    '/detransition/',
    '/hrt-effects/',
    '/hrt-medications/',
    '/fertility/',
    '/voice/',
    '/presentation/',
    '/hair-removal/',
    '/surgery/',
    '/cost/',
    '/legal-change/',
    '/coming-out/',
    '/everyday/',
    '/relationships/',
    '/safety/',
    '/puberty-blockers/',
    '/learn/',
    '/reference/',
    '/flags/',
    '/pride/',
    '/works/',
    '/bibliography/',
    '/about/',
    '/map/',
    '/clinics/',
    '/edit/',
    '/glossary/',
    '/guidelines/',
    '/legal/',
    '/library/',
    '/resources/',
    '/search/',
    '/data/',
    '/sitemap/',
    ...clinics.map((clinic) => `/clinics/${clinic.id}/`),
    ...glossary.map((entry) => `/glossary/${entry.id}/`),
    ...imported.map((page) => `/library/${page.id}/`),
  ];

  const entries = [...new Set(paths)].map((path) => ({
    url: new URL(path, site).toString(),
    lastmod: dates[path]?.updated,
  }));
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
    .map((e) => `  <url><loc>${escapeXml(e.url)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`)
    .join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
