// Which Open Graph card each route uses. Shared by scripts/gen-og-images.mjs
// (renders the cards) and BaseLayout (points og:image at them) so they can't
// drift. The homepage keeps the hand-made /og-image.png (ogCardFor returns null).

export const OG_GROUPS = {
  'はじめに・基本': ['/start/', '/faq/', '/basics/', '/gender/', '/orientation/', '/intersex/', '/dysphoria/', '/learn/'],
  '移行と医療': ['/transition/', '/detransition/', '/puberty-blockers/', '/hrt-effects/', '/hrt-medications/', '/fertility/', '/voice/', '/presentation/', '/hair-removal/', '/surgery/', '/cost/'],
  '相談・医療機関': ['/support/', '/clinics/', '/map/'],
  '暮らしと社会': ['/coming-out/', '/relationships/', '/everyday/', '/school/', '/allies/', '/parents/', '/guidelines/', '/safety/', '/legal-change/', '/flags/', '/pride/', '/history/'],
  '調べる・資料': ['/reference/', '/search/', '/glossary/', '/works/', '/bibliography/', '/resources/', '/library/', '/tags/'],
  'このサイト': ['/about/', '/data/', '/legal/', '/edit/', '/sitemap/'],
};

export const ROUTE_CATEGORY = Object.fromEntries(
  Object.entries(OG_GROUPS).flatMap(([cat, routes]) => routes.map((r) => [r, cat])),
);

export const slugForRoute = (route) =>
  route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replace(/\//g, '-');

// Detail collections share their index card (e.g. every /glossary/x/ uses the
// /glossary/ card) so we don't render hundreds of images.
const COLLECTION_BASES = ['/glossary/', '/clinics/', '/library/', '/tags/'];

// The card a given pathname should use, or null to fall back to /og-image.png.
export function ogCardFor(pathname) {
  if (pathname === '/') return null;
  if (ROUTE_CATEGORY[pathname]) return { route: pathname, slug: slugForRoute(pathname), category: ROUTE_CATEGORY[pathname] };
  for (const base of COLLECTION_BASES) {
    if (pathname.startsWith(base) && pathname !== base) {
      return { route: base, slug: slugForRoute(base), category: ROUTE_CATEGORY[base] };
    }
  }
  return null;
}

// Every route we render a card for (one per main page).
export const OG_ROUTES = Object.keys(ROUTE_CATEGORY);
