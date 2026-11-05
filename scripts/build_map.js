#!/usr/bin/env node
// Generates assets/map.js from Natural Earth GeoJSON (public domain).
// Download once into /tmp/geo:
//   curl -sL -o /tmp/geo/countries.json https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson
//   curl -sL -o /tmp/geo/admin1.json    https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
//   curl -sL -o /tmp/geo/rivers.json    https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson
//   curl -sL -o /tmp/geo/rivers_eu.json https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_europe.geojson
const fs = require('fs');
const path = require('path');
const SRC = process.env.GEO_SRC || '/tmp/geo';
const load = (f) => JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));

const BOX = { w: 18.7, e: 23.2, s: 41.75, n: 46.25 };
const r3 = (n) => Math.round(n * 1000) / 1000;
const inBox = (p) => p[0] > BOX.w && p[0] < BOX.e && p[1] > BOX.s && p[1] < BOX.n;

const countries = load('countries.json').features;
const outline = ['SRB', 'KOS'].map((a3) => {
  const g = countries.find((f) => f.properties.ADM0_A3 === a3).geometry;
  const rings = g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map((p) => p[0]);
  return rings.map((ring) => ring.map((p) => [r3(p[0]), r3(p[1])]));
});

// Douglas-Peucker polyline simplification to keep SVG paths compact and smooth.
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  let maxD = 0, idx = 0;
  const [x1, y1] = pts[0], [x2, y2] = pts[pts.length - 1];
  const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const t = len2 ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2)) : 0;
    const d = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
    if (d > maxD) { maxD = d; idx = i; }
  }
  return maxD > eps ? rdp(pts.slice(0, idx + 1), eps).slice(0, -1).concat(rdp(pts.slice(idx), eps)) : [pts[0], pts[pts.length - 1]];
}

// Dissolve Serbia's admin-1 districts into statistical regions / provinces:
// VOJ (Vojvodina), BG (Beograd), SUM (Šumadija i zapadna Srbija), JUG (Južna i istočna Srbija), plus KOS (Kosovo i Metohija).
const admin1 = load('admin1.json').features;
const VOJ = new Set(['Severno-Backi', 'Zapadno-Backi', 'Južno-Backi', 'Severno-Banatski', 'Srednje-Banatski', 'Južno-Banatski', 'Sremski']);
const BG = new Set(['Grad Beograd']);
const JUG = new Set(['Podunavski', 'Branicevski', 'Borski', 'Zajecarski', 'Nišavski', 'Toplicki', 'Pirotski', 'Jablanicki', 'Pcinjski']);
function regOf(f) {
  const p = f.properties;
  if (p.adm0_a3 !== 'SRB') return null;
  return VOJ.has(p.name) ? 'VOJ' : BG.has(p.name) ? 'BG' : JUG.has(p.name) ? 'JUG' : 'SUM';
}
const ptKey = (p) => p[0] + ',' + p[1];
function buildRegionRing(code) {
  const dir = new Map();
  admin1.filter((f) => regOf(f) === code).forEach((f) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    polys.forEach((poly) => {
      const ring = poly[0].map((p) => [r3(p[0]), r3(p[1])]);
      for (let i = 0; i < ring.length - 1; i++) {
        const u = ring[i], v = ring[i + 1];
        if (u[0] === v[0] && u[1] === v[1]) continue;
        const rev = ptKey(v) + '->' + ptKey(u);
        if (dir.has(rev)) dir.delete(rev);
        else dir.set(ptKey(u) + '->' + ptKey(v), [u, v]);
      }
    });
  });
  const next = new Map();
  for (const [u, v] of dir.values()) next.set(ptKey(u), v);
  const startKey = next.keys().next().value;
  const ring = [startKey.split(',').map(Number)];
  let cur = startKey;
  while (next.has(cur)) {
    const nxt = next.get(cur);
    next.delete(cur);
    ring.push(nxt);
    cur = ptKey(nxt);
    if (cur === startKey) break;
  }
  return rdp(ring, 0.003);
}
const regions = {
  VOJ: buildRegionRing('VOJ'),
  BG: buildRegionRing('BG'),
  SUM: buildRegionRing('SUM'),
  JUG: buildRegionRing('JUG'),
  KOS: outline[1][0],
};

// Split a feature into in-box polylines (lon/lat).
function lines(feature) {
  const g = feature.geometry;
  const parts = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
  const out = [];
  parts.forEach((part) => {
    let cur = [];
    part.forEach((p) => {
      if (inBox(p)) cur.push([r3(p[0]), r3(p[1])]);
      else if (cur.length) { if (cur.length > 1) out.push(cur); cur = []; }
    });
    if (cur.length > 1) out.push(cur);
  });
  return out;
}
function pick(file, name) {
  return load(file).features
    .filter((f) => f.geometry && f.properties.name === name)
    .reduce((acc, f) => acc.concat(lines(f)), []);
}

const rivers = {
  'Дунав': pick('rivers.json', 'Danube'),
  'Сава': pick('rivers.json', 'Sava'),
  'Тиса': pick('rivers.json', 'Tisa'),
  'Дрина': pick('rivers.json', 'Drina'),
  'Тамиш': pick('rivers_eu.json', 'Timiş'),
  'Западна Морава': pick('rivers_eu.json', 'Golijska Moravica'),
  'Тимок': pick('rivers_eu.json', 'Beli Timok'),
  'Нишава': pick('rivers_eu.json', 'Nišava'),
  'Лим': pick('rivers_eu.json', 'Lim'),
  'Ситница': pick('rivers_eu.json', 'Sitnica'),
  'Бели Дрим': pick('rivers_eu.json', 'Beli Drim'),
  // Not in Natural Earth: traced by hand through towns on its banks.
  'Ибар': [[[20.43, 42.95], [20.58, 42.93], [20.87, 42.89], [20.8, 43.1], [20.61, 43.29], [20.61, 43.47], [20.69, 43.73]]],
};
// Natural Earth "Morava" = Južna + Velika Morava; they meet near Stalać (lat ~43.67).
const morava = pick('rivers.json', 'Morava');
const STALAC = 43.67;
rivers['Јужна Морава'] = morava.map((l) => l.filter((p) => p[1] <= STALAC + 0.01)).filter((l) => l.length > 1);
rivers['Велика Морава'] = morava.map((l) => l.filter((p) => p[1] >= STALAC - 0.01)).filter((l) => l.length > 1);

Object.keys(rivers).forEach((k) => { if (!rivers[k].length) throw new Error('No geometry for river ' + k); });

const out = '// Generated by scripts/build_map.js from Natural Earth data. Do not edit.\n' +
  'var GEO_MAP = ' + JSON.stringify({ box: BOX, outline: outline, regions: regions, rivers: rivers }) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'assets', 'map.js'), out);
console.log('map.js written,', (out.length / 1024).toFixed(0), 'KB; regions:', Object.keys(regions).join(', '));
