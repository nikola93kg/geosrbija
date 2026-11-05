// Run: node --test apps/geosrbija/test/game.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const game = require('../assets/game.js');
const ROUNDS = require('../assets/data.js');
const GEO_MAP = new Function(fs.readFileSync(path.join(__dirname, '../assets/map.js'), 'utf8') + 'return GEO_MAP;')();

test('haversine Beograd–Novi Sad ≈ 72 km', () => {
  const km = game.haversine(44.817, 20.457, 45.267, 19.833);
  assert.ok(km > 68 && km < 76, km);
});

test('nearestOnLines finds segment distance, not just vertex distance', () => {
  const line = [[[20.0, 44.0], [21.0, 44.0]]];
  const n = game.nearestOnLines(44.1, 20.5, line);
  assert.ok(Math.abs(n.km - 11.06) < 0.2, n.km);
  assert.ok(Math.abs(n.lon - 20.5) < 1e-6 && Math.abs(n.lat - 44.0) < 1e-6);
});

test('score: perfect fast guess = 1000, far or timeout = 0, slower = less', () => {
  assert.strictEqual(game.score(0, 15), 1000);
  assert.strictEqual(game.score(150, 15), 0);
  assert.strictEqual(game.score(0, 0), 0);
  assert.ok(game.score(10, 5) < game.score(10, 14));
});

function inside(lon, lat) {
  let hit = false;
  GEO_MAP.outline.forEach((country) => country.forEach((ring) => {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
    }
  }));
  return hit;
}

test('six rounds with >= 10 questions in Serbian Cyrillic, monasteries 3rd, villages 5th, rivers last', () => {
  assert.deepStrictEqual(ROUNDS.map((r) => r.name),
    ['Велики градови', 'Мањи градови', 'Манастири', 'Планине', 'Варошице и села', 'Реке']);
  ROUNDS.forEach((r) => assert.ok(r.places.length >= 10, r.name));
});

test('every place lies inside Serbia (incl. Kosovo), every river and region has geometry, and SFX exist', () => {
  ROUNDS.forEach((r) => r.places.forEach((p) => {
    if (r.rivers) assert.ok(GEO_MAP.rivers[p[0]], 'missing river ' + p[0]);
    else assert.ok(inside(p[2], p[1]), p[0] + ' is outside the map');
  }));
  assert.deepStrictEqual(Object.keys(GEO_MAP.regions), ['VOJ', 'BG', 'SUM', 'JUG', 'KOS']);
  ['click', 'tap', 'tick', 'good', 'ok', 'bad', 'wrong_answer', 'win', 'lose'].forEach((k) => {
    assert.ok(fs.existsSync(path.join(__dirname, '../assets/sfx', k + '.wav')), 'missing sfx ' + k);
  });
});
