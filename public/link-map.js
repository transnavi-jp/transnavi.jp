// Interactive force-directed map of the site's internal links, drawn into
// #link-map on /sitemap/ from /link-map.json. Hand-rolled (no library): simple
// repulsion + spring + centering forces, draggable nodes, click to open a page.
(function () {
  'use strict';
  var SVGNS = 'http://www.w3.org/2000/svg';
  var COLORS = {
    start: '#4ba8ea',
    medical: '#e8589b',
    support: '#36b37e',
    society: '#f2994a',
    reference: '#8a6dc6',
    site: '#8d97ad',
  };

  function el(name, attrs) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
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
    var nodes = data.nodes;
    var byId = {};
    nodes.forEach(function (n) {
      byId[n.id] = n;
    });
    var links = data.links.filter(function (l) {
      return byId[l.source] && byId[l.target];
    });

    var W = Math.max(320, host.clientWidth || 680);
    var H = host.clientHeight || 560;
    var cx = W / 2;
    var cy = H / 2;

    // Initial positions: spread groups around a ring so it untangles fast.
    var groups = {};
    nodes.forEach(function (n) {
      (groups[n.group] = groups[n.group] || []).push(n);
    });
    var gKeys = Object.keys(groups);
    gKeys.forEach(function (g, gi) {
      var base = (gi / gKeys.length) * Math.PI * 2;
      groups[g].forEach(function (n, i) {
        var a = base + (i - groups[g].length / 2) * 0.18;
        var r = 120 + ((i % 3) * 36);
        n.x = cx + Math.cos(a) * r;
        n.y = cy + Math.sin(a) * r;
        n.vx = 0;
        n.vy = 0;
        n.deg = 0;
      });
    });
    links.forEach(function (l) {
      byId[l.source].deg++;
      byId[l.target].deg++;
    });

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'link-map-svg', role: 'img', 'aria-label': 'サイト内のページのつながりの図' });
    var gEdges = el('g', { class: 'lm-edges' });
    var gNodes = el('g', { class: 'lm-nodes' });
    svg.appendChild(gEdges);
    svg.appendChild(gNodes);
    host.appendChild(svg);

    var edgeEls = links.map(function (l) {
      var line = el('line', { class: 'lm-edge' });
      gEdges.appendChild(line);
      return line;
    });

    var nodeEls = nodes.map(function (n) {
      var g = el('g', { class: 'lm-node', tabindex: '0', role: 'link', 'aria-label': n.label });
      var r = 6 + Math.min(6, n.deg);
      var c = el('circle', { r: r, fill: COLORS[n.group] || '#8d97ad' });
      var t = el('text', { class: 'lm-label', x: 0, y: r + 13 });
      t.textContent = n.label;
      g.appendChild(c);
      g.appendChild(t);
      gNodes.appendChild(g);
      n._g = g;
      n._r = r;
      go(n, g);
      return g;
    });

    function go(n, g) {
      var moved = false;
      var sx, sy, ox, oy;
      function down(e) {
        e.preventDefault();
        moved = false;
        var p = pt(e);
        sx = p.x;
        sy = p.y;
        ox = n.x;
        oy = n.y;
        n.fixed = true;
        alpha = Math.max(alpha, 0.35);
        tick();
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      }
      function move(e) {
        var p = pt(e);
        if (Math.abs(p.x - sx) + Math.abs(p.y - sy) > 4) moved = true;
        n.x = ox + (p.x - sx);
        n.y = oy + (p.y - sy);
        n.vx = 0;
        n.vy = 0;
      }
      function up() {
        n.fixed = false;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        if (!moved) location.href = n.id;
      }
      g.addEventListener('pointerdown', down);
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') location.href = n.id;
      });
    }

    function pt(e) {
      var rect = svg.getBoundingClientRect();
      return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
    }

    var alpha = 1;
    function step() {
      // repulsion
      for (var i = 0; i < nodes.length; i++) {
        var a = nodes[i];
        for (var j = i + 1; j < nodes.length; j++) {
          var b = nodes[j];
          var dx = a.x - b.x;
          var dy = a.y - b.y;
          var d2 = dx * dx + dy * dy || 0.01;
          var f = (2600 / d2) * alpha;
          var d = Math.sqrt(d2);
          var fx = (dx / d) * f;
          var fy = (dy / d) * f;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }
      // springs
      links.forEach(function (l) {
        var a = byId[l.source];
        var b = byId[l.target];
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        var f = ((d - 90) / d) * 0.06 * alpha;
        var fx = dx * f;
        var fy = dy * f;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      });
      // centering + integrate
      nodes.forEach(function (n) {
        n.vx += (cx - n.x) * 0.002 * alpha;
        n.vy += (cy - n.y) * 0.002 * alpha;
        if (!n.fixed) {
          n.x += n.vx * 0.85;
          n.y += n.vy * 0.85;
        }
        n.vx *= 0.85;
        n.vy *= 0.85;
        var pad = n._r + 16;
        n.x = Math.max(pad, Math.min(W - pad, n.x));
        n.y = Math.max(pad, Math.min(H - pad, n.y));
      });
    }

    function render() {
      links.forEach(function (l, i) {
        var a = byId[l.source];
        var b = byId[l.target];
        var e = edgeEls[i];
        e.setAttribute('x1', a.x);
        e.setAttribute('y1', a.y);
        e.setAttribute('x2', b.x);
        e.setAttribute('y2', b.y);
      });
      nodes.forEach(function (n) {
        n._g.setAttribute('transform', 'translate(' + n.x.toFixed(1) + ',' + n.y.toFixed(1) + ')');
      });
    }

    var raf = null;
    function tick() {
      if (raf) return;
      function loop() {
        step();
        render();
        alpha *= 0.985;
        if (alpha > 0.02) {
          raf = requestAnimationFrame(loop);
        } else {
          raf = null;
        }
      }
      raf = requestAnimationFrame(loop);
    }
    render();
    tick();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
