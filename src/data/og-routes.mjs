// Which Open Graph card each route uses. Shared by scripts/gen-og-images.mjs
// (renders the cards) and BaseLayout (points og:image at them) so they can't
// drift. The homepage keeps the hand-made /og-image.png (ogCardFor returns null).

export const OG_GROUPS = {
  'はじめに・基本': ['/start/', '/faq/', '/myths/', '/basics/', '/gender/', '/orientation/', '/intersex/', '/dysphoria/', '/learn/'],
  '移行と医療': ['/transition/', '/detransition/', '/puberty-blockers/', '/hrt-effects/', '/hrt-medications/', '/fertility/', '/voice/', '/presentation/', '/hair-removal/', '/surgery/', '/cost/'],
  '相談・医療機関': ['/support/', '/clinics/', '/map/'],
  '暮らしと社会': ['/coming-out/', '/relationships/', '/everyday/', '/pronouns/', '/school/', '/allies/', '/parents/', '/guidelines/', '/safety/', '/legal-change/', '/flags/', '/pride/', '/history/'],
  '調べる・資料': ['/reference/', '/search/', '/glossary/', '/works/', '/bibliography/', '/resources/', '/library/', '/tags/'],
  'このサイト': ['/about/', '/data/', '/legal/', '/edit/', '/sitemap/'],
};

export const ROUTE_CATEGORY = Object.fromEntries(
  Object.entries(OG_GROUPS).flatMap(([cat, routes]) => routes.map((r) => [r, cat])),
);

export const slugForRoute = (route) =>
  route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replace(/\//g, '-');

// Detail collections get their own per-entry card (rendered from the built
// page's <title> in gen-og-images), labelled with the collection's name.
export const COLLECTION_CATEGORY = {
  '/glossary/': '用語集',
  '/clinics/': '医療機関',
  '/library/': '資料集',
  '/tags/': 'タグ',
};

// The card a given pathname should use, or null to fall back to /og-image.png.
export function ogCardFor(pathname) {
  if (pathname === '/') return null;
  if (ROUTE_CATEGORY[pathname]) return { route: pathname, slug: slugForRoute(pathname), category: ROUTE_CATEGORY[pathname] };
  for (const [base, category] of Object.entries(COLLECTION_CATEGORY)) {
    if (pathname.startsWith(base) && pathname !== base) {
      return { route: pathname, slug: slugForRoute(pathname), category };
    }
  }
  return null;
}

// Every route we render a card for (one per main page).
export const OG_ROUTES = Object.keys(ROUTE_CATEGORY);
