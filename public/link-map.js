// Interactive pseudo-3D map of the site's internal links, drawn into #link-map
// on /sitemap/ from /link-map.json. Hand-rolled (no library): a 3D force layout,
// perspective projection, gentle auto-rotation, soft "bubble" page nodes, and an
// optional, togglable layer of small glossary-term diamonds. Controls: drag to
// orbit, wheel/pinch to zoom, Shift-drag / two-finger to pan, tap a node to open
// it. Pauses when scrolled out of view.
(function () {
  'use strict';
  var SVGNS = 'http://www.w3.org/2000/svg';
  var COLORS = {
    start: '#5bb0ee',
    medical: '#ff8fc4',
    support: '#5cc99a',
    society: '#ffb06b',
    reference: '#a98ee0',
    site: '#aab2c8',
    term: '#c9a9ec',
  };
  var FOCAL = 760;
  var AUTO = 0.0021;

  function el(name, attrs) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function tint(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    function m(c) { return Math.round(c + (255 - c) * f); }
    return 'rgb(' + m((n >> 16) & 255) + ',' + m((n >> 8) & 255) + ',' + m(n & 255) + ')';
  }
  async function init() {
    var host = document.getElementById('link-map');
    if (!host) return;
    var data;
    try {
      data = await (await fetch('/link-map.json')).json();
    } catch (e) {
      return;
    }

    var W = Math.max(320, host.clientWidth || 680);
    var H = host.clientHeight || 560;
    var cx = W / 2, cy = H / 2;

    var byId = {};
    var pages = data.nodes.map(function (n) { return { id: n.id, label: n.label, group: n.group, type: 'page', q: 3400 }; });
    var terms = (data.terms || []).map(function (n) { return { id: n.id, label: n.label, group: 'term', type: 'term', q: 850 }; });
    pages.concat(terms).forEach(function (n) { byId[n.id] = n; });
    var pageLinks = data.links.filter(function (l) { return byId[l.source] && byId[l.target]; });
    var termLinks = (data.termLinks || []).filter(function (l) { return byId[l.source] && byId[l.target]; });

    function seed(list, r) {
      list.forEach(function (n, i) {
        var phi = Math.acos(1 - (2 * (i + 0.5)) / list.length);
        var theta = Math.PI * (1 + Math.sqrt(5)) * i;
        n.x = r * Math.sin(phi) * Math.cos(theta);
        n.y = r * Math.sin(phi) * Math.sin(theta);
        n.z = r * Math.cos(phi);
        n.vx = n.vy = n.vz = 0;
        n.deg = 0;
      });
    }
    seed(pages, 150);
    seed(terms, 230);
    pageLinks.concat(termLinks).forEach(function (l) { byId[l.source].deg++; byId[l.target].deg++; });

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'link-map-svg', role: 'img', 'aria-label': 'サイト内のページのつながりの3D図' });
    var defs = el('defs', {});
    svg.appendChild(defs);
    Object.keys(COLORS).forEach(function (g) {
      var grad = el('radialGradient', { id: 'lmg-' + g, cx: '36%', cy: '30%', r: '78%' });
      grad.appendChild(el('stop', { offset: '0%', 'stop-color': '#ffffff' }));
      grad.appendChild(el('stop', { offset: '30%', 'stop-color': tint(COLORS[g], 0.55) }));
      grad.appendChild(el('stop', { offset: '78%', 'stop-color': COLORS[g] }));
      grad.appendChild(el('stop', { offset: '100%', 'stop-color': tint(COLORS[g], 0.12) }));
      defs.appendChild(grad);
    });
    var gTermEdges = el('g', { class: 'lm-term-edges' });
    var gEdges = el('g', { class: 'lm-edges' });
    var gTerms = el('g', { class: 'lm-terms' });
    var gNodes = el('g', { class: 'lm-nodes' });
    [gTermEdges, gEdges, gTerms, gNodes].forEach(function (g) { svg.appendChild(g); });
    host.appendChild(svg);

    var pageEdgeEls = pageLinks.map(function () { var l = el('line', { class: 'lm-edge' }); gEdges.appendChild(l); return l; });
    var termEdgeEls = termLinks.map(function () { var l = el('line', { class: 'lm-edge lm-term-edge' }); gTermEdges.appendChild(l); return l; });

    pages.forEach(function (n) {
      var g = el('g', { class: 'lm-node', tabindex: '0', role: 'link', 'aria-label': n.label });
      n._r = 7 + Math.min(7, n.deg);
      n._c = el('circle', { r: n._r, fill: 'url(#lmg-' + n.group + ')' });
      var shine = el('ellipse', { class: 'lm-shine', cx: -n._r * 0.3, cy: -n._r * 0.34, rx: n._r * 0.3, ry: n._r * 0.2 });
      n._t = el('text', { class: 'lm-label', x: 0, y: n._r + 13 });
      n._t.textContent = n.label;
      g.appendChild(n._c); g.appendChild(shine); g.appendChild(n._t);
      gNodes.appendChild(g); n._g = g;
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter') location.href = n.id; });
    });
    terms.forEach(function (n) {
      var g = el('g', { class: 'lm-term-node', tabindex: '0', role: 'link', 'aria-label': n.label });
      n._r = 4;
      var d = el('polygon', { points: '0,-4 4,0 0,4 -4,0', fill: 'url(#lmg-term)' });
      var title = el('title', {}); title.textContent = n.label;
      g.appendChild(d); g.appendChild(title);
      gTerms.appendChild(g); n._g = g;
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter') location.href = n.id; });
    });

    var showTerms = false;
    function setTerms(on) {
      showTerms = on;
      gTerms.style.display = on ? '' : 'none';
      gTermEdges.style.display = on ? '' : 'none';
      if (on) { seed(terms, 230); }
      alpha = Math.max(alpha, 0.9);
    }
    function activeNodes() { return showTerms ? pages.concat(terms) : pages; }
    function activeLinks() { return showTerms ? pageLinks.concat(termLinks) : pageLinks; }

    var rotY = 0.4, rotX = -0.3, zoom = 1, panX = 0, panY = 0, alpha = 1;

    function physics() {
      var ns = activeNodes(), ls = activeLinks();
      for (var i = 0; i < ns.length; i++) {
        var a = ns[i];
        for (var j = i + 1; j < ns.length; j++) {
          var b = ns[j];
          var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
          var d2 = dx * dx + dy * dy + dz * dz || 0.01;
          var d = Math.sqrt(d2);
          var f = (Math.sqrt(a.q * b.q) / d2) * alpha;
          a.vx += (dx / d) * f; a.vy += (dy / d) * f; a.vz += (dz / d) * f;
          b.vx -= (dx / d) * f; b.vy -= (dy / d) * f; b.vz -= (dz / d) * f;
        }
      }
      ls.forEach(function (l) {
        var a = byId[l.source], b = byId[l.target];
        var rest = a.type === 'term' || b.type === 'term' ? 54 : 96;
        var dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        var d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
        var f = ((d - rest) / d) * 0.05 * alpha;
        a.vx += dx * f; a.vy += dy * f; a.vz += dz * f;
        b.vx -= dx * f; b.vy -= dy * f; b.vz -= dz * f;
      });
      ns.forEach(function (n) {
        n.vx -= n.x * 0.0016 * alpha; n.vy -= n.y * 0.0016 * alpha; n.vz -= n.z * 0.0016 * alpha;
        n.x += n.vx * 0.82; n.y += n.vy * 0.82; n.z += n.vz * 0.82;
        n.vx *= 0.82; n.vy *= 0.82; n.vz *= 0.82;
      });
    }

    var cyS, syS;
    function project(n) {
      var cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      var x1 = n.x * cosY - n.z * sinY;
      var z1 = n.x * sinY + n.z * cosY;
      var cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      var y1 = n.y * cosX - z1 * sinX;
      var z2 = n.y * sinX + z1 * cosX;
      var s = (FOCAL / (FOCAL + z2)) * zoom;
      return { sx: cx + panX + x1 * s, sy: cy + panY + y1 * s, s: s, z: z2 };
    }

    function render() {
      var P = {};
      pages.forEach(function (n) { P[n.id] = project(n); });
      pages.slice().sort(function (a, b) { return P[b.id].z - P[a.id].z; }).forEach(function (n) { gNodes.appendChild(n._g); });
      pages.forEach(function (n) {
        var p = P[n.id];
        var op = 0.5 + 0.5 * (1 - Math.min(1, Math.max(0, (p.z + 200) / 400)));
        n._g.setAttribute('transform', 'translate(' + p.sx.toFixed(1) + ',' + p.sy.toFixed(1) + ') scale(' + p.s.toFixed(3) + ')');
        n._g.style.opacity = op.toFixed(2);
        n._t.style.opacity = op > 0.82 ? '1' : op > 0.64 ? '0.5' : '0';
        n._px = p.sx; n._py = p.sy; n._pr = n._r * p.s;
      });
      pageLinks.forEach(function (l, i) {
        var a = P[l.source], b = P[l.target], e = pageEdgeEls[i];
        e.setAttribute('x1', a.sx.toFixed(1)); e.setAttribute('y1', a.sy.toFixed(1));
        e.setAttribute('x2', b.sx.toFixed(1)); e.setAttribute('y2', b.sy.toFixed(1));
        e.style.opacity = (0.16 + 0.32 * (1 - Math.min(1, Math.max(0, ((a.z + b.z) / 2 + 200) / 400)))).toFixed(2);
      });
      if (showTerms) {
        terms.forEach(function (n) {
          var p = project(n); P[n.id] = p;
          var op = 0.4 + 0.45 * (1 - Math.min(1, Math.max(0, (p.z + 230) / 460)));
          n._g.setAttribute('transform', 'translate(' + p.sx.toFixed(1) + ',' + p.sy.toFixed(1) + ') scale(' + p.s.toFixed(3) + ')');
          n._g.style.opacity = op.toFixed(2);
          n._px = p.sx; n._py = p.sy; n._pr = n._r * p.s;
        });
        termLinks.forEach(function (l, i) {
          var a = P[l.source], b = P[l.target], e = termEdgeEls[i];
          e.setAttribute('x1', a.sx.toFixed(1)); e.setAttribute('y1', a.sy.toFixed(1));
          e.setAttribute('x2', b.sx.toFixed(1)); e.setAttribute('y2', b.sy.toFixed(1));
        });
      }
    }

    function vb(clientX, clientY) {
      var r = svg.getBoundingClientRect();
      return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H, k: W / r.width };
    }
    function zoomAt(mx, my, factor) {
      var nz = Math.max(0.45, Math.min(3.2, zoom * factor));
      var f = nz / zoom;
      panX = panX * f + (mx - cx) * (1 - f);
      panY = panY * f + (my - cy) * (1 - f);
      zoom = nz;
      if (!running) render();
    }
    function ptHit(mx, my) {
      var best = null, bd = 1e9;
      activeNodes().forEach(function (n) {
        if (n._px == null) return;
        var d = Math.hypot(n._px - mx, n._py - my);
        if (d < Math.max(n.type === 'term' ? 8 : 12, n._pr + 6) && d < bd) { bd = d; best = n; }
      });
      return best;
    }

    var pointers = new Map();
    var moved = false, lx = 0, ly = 0, downNode = null, pinchDist = 0, pinchMid = null;
    function twoPointers() { var a = []; pointers.forEach(function (p) { a.push(p); }); return a; }
    svg.addEventListener('pointerdown', function (e) {
      svg.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) { moved = false; lx = e.clientX; ly = e.clientY; var v = vb(e.clientX, e.clientY); downNode = ptHit(v.x, v.y); }
      else if (pointers.size === 2) { var ps = twoPointers(); pinchDist = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y); pinchMid = { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 }; downNode = null; }
    });
    svg.addEventListener('pointermove', function (e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size >= 2) {
        var ps = twoPointers();
        var dist = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
        var mid = { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 };
        var v = vb(mid.x, mid.y);
        if (pinchDist) zoomAt(v.x, v.y, dist / pinchDist);
        if (pinchMid) { var k = vb(0, 0).k; panX += (mid.x - pinchMid.x) * k; panY += (mid.y - pinchMid.y) * k; }
        pinchDist = dist; pinchMid = mid; moved = true; if (!running) render(); return;
      }
      var dx = e.clientX - lx, dy = e.clientY - ly;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      lx = e.clientX; ly = e.clientY;
      if (e.shiftKey) { var k2 = vb(0, 0).k; panX += dx * k2; panY += dy * k2; }
      else { rotY += dx * 0.008; rotX = Math.max(-1.2, Math.min(1.2, rotX + dy * 0.006)); }
      if (!running) render();
    });
    function endPointer(e) {
      if (!pointers.has(e.pointerId)) return;
      var wasSingle = pointers.size === 1;
      pointers.delete(e.pointerId);
      if (pointers.size === 1) { var rp = twoPointers()[0]; lx = rp.x; ly = rp.y; pinchMid = null; pinchDist = 0; }
      if (pointers.size === 0 && wasSingle && !moved && downNode) location.href = downNode.id;
    }
    svg.addEventListener('pointerup', endPointer);
    svg.addEventListener('pointercancel', endPointer);
    svg.addEventListener('wheel', function (e) { e.preventDefault(); var v = vb(e.clientX, e.clientY); zoomAt(v.x, v.y, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
    svg.addEventListener('dblclick', function () { zoom = 1; panX = 0; panY = 0; if (!running) render(); });

    var toggle = document.getElementById('link-map-terms');
    if (toggle) toggle.addEventListener('change', function () { setTerms(toggle.checked); });

    var raf = null, running = false;
    function loop() {
      if (alpha > 0.03) { physics(); alpha *= 0.985; }
      if (pointers.size === 0) rotY += AUTO;
      render();
      raf = requestAnimationFrame(loop);
    }
    function start() { if (running) return; running = true; raf = requestAnimationFrame(loop); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }
    render();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (ents) { ents.forEach(function (en) { en.isIntersecting ? start() : stop(); }); }, { threshold: 0.01 }).observe(host);
    } else { start(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
