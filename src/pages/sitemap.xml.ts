import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import clinicsData from '../data/clinics.json';
import glossaryData from '../data/glossary.json';
import type { Clinic } from '../types/clinic';
import type { GlossaryEntry } from '../types/glossary';

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
    '/support/',
    '/allies/',
    '/basics/',
    '/gender/',
    '/dysphoria/',
    '/transition/',
    '/hrt-effects/',
    '/fertility/',
    '/voice/',
    '/presentation/',
    '/hair-removal/',
    '/surgery/',
    '/legal-change/',
    '/coming-out/',
    '/safety/',
    '/puberty-blockers/',
    '/learn/',
    '/flags/',
    '/pride/',
    '/works/',
    '/bibliography/',
    '/about/',
    '/clinics/',
    '/edit/',
    '/glossary/',
    '/legal/',
    '/library/',
    '/resources/',
    ...clinics.map((clinic) => `/clinics/${clinic.id}/`),
    ...glossary.map((entry) => `/glossary/${entry.id}/`),
    ...imported.map((page) => `/library/${page.id}/`),
  ];

  const urls = [...new Set(paths)].map((path) => new URL(path, site).toString());
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
