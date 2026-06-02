// Renders the /map/ page markers with MapLibre GL. Data is embedded in a
// <script type="application/json" id="map-data"> tag by the page.
(function () {
  if (typeof maplibregl === 'undefined') return;
  const dataEl = document.getElementById('map-data');
  const container = document.getElementById('map');
  if (!dataEl || !container) return;

  let data;
  try {
    data = JSON.parse(dataEl.textContent || '{}');
  } catch (_) {
    return;
  }
  const clinics = data.clinics || [];
  const pois = data.pois || [];

  const map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
    center: [137.5, 37.6],
    zoom: 4.2,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), 'top-right');

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const markers = [];
  function addMarker(lng, lat, type, html) {
    const el = document.createElement('div');
    el.className = 'map-pin map-pin-' + type;
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([lng, lat])
      .setPopup(new maplibregl.Popup({ offset: 16, closeButton: true }).setHTML(html))
      .addTo(map);
    markers.push({ marker, type });
  }

  for (const c of clinics) {
    const html =
      '<strong>' + escapeHtml(c.name) + '</strong><br>' +
      '<span class="map-popup-sub">' + escapeHtml(c.area || '') + (c.approx ? '（おおよそ）' : '') + '</span><br>' +
      '<a href="/clinics/' + encodeURIComponent(c.id) + '/">掲載ページ →</a>';
    // On the clinics page, pins are coloured by 診療区分 (c.genre); elsewhere
    // they fall back to a generic clinic pin.
    addMarker(c.lng, c.lat, c.genre || 'clinic', html);
  }
  for (const p of pois) {
    const isInternal = typeof p.url === 'string' && p.url.startsWith('/');
    const link = isInternal
      ? '<a href="' + escapeHtml(p.url) + '">ひらく →</a>'
      : '<a href="' + escapeHtml(p.url) + '" target="_blank" rel="noreferrer">公式サイト →</a>';
    const html = '<strong>' + escapeHtml(p.name) + '</strong><br>' + link;
    addMarker(p.lng, p.lat, p.type, html);
  }

  for (const cb of document.querySelectorAll('[data-map-toggle]')) {
    cb.addEventListener('change', () => {
      const type = cb.dataset.mapToggle;
      for (const m of markers) {
        if (m.type === type) m.marker.getElement().style.display = cb.checked ? '' : 'none';
      }
    });
  }

  map.on('load', () => {
    const bounds = new maplibregl.LngLatBounds();
    for (const p of [...clinics, ...pois]) bounds.extend([p.lng, p.lat]);
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 48, maxZoom: 9 });
  });
})();
