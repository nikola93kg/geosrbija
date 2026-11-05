// GeoSrbija game. Plain ES5 so it runs on old Android WebViews.
(function () {
  var QUESTIONS_PER_ROUND = 10;
  var TIME = 15;            // seconds per question
  var ZERO_KM = 100;        // distance at which a guess is worth 0 points
  var PASS = 4000;          // round points needed to advance (out of 10000)

  // ---------- pure logic ----------
  function haversine(lat1, lon1, lat2, lon2) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  // Nearest point on river polylines ([[lon,lat],...] lists). Flat-earth is fine at Serbia's scale.
  function nearestOnLines(lat, lon, lines) {
    var kx = 111.32 * Math.cos(lat * Math.PI / 180), ky = 110.57;
    var best = { km: Infinity, lat: lat, lon: lon };
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      for (var j = 0; j < l.length - 1; j++) {
        var ax = (l[j][0] - lon) * kx, ay = (l[j][1] - lat) * ky;
        var bx = (l[j + 1][0] - lon) * kx, by = (l[j + 1][1] - lat) * ky;
        var dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
        var t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
        var px = ax + t * dx, py = ay + t * dy, d = Math.sqrt(px * px + py * py);
        if (d < best.km) best = { km: d, lat: lat + py / ky, lon: lon + px / kx };
      }
    }
    return best;
  }

  function score(km, timeLeft) {
    if (timeLeft <= 0) return 0;
    var acc = Math.max(0, 1 - km / ZERO_KM);
    return Math.round(1000 * acc * (0.5 + 0.5 * Math.min(1, timeLeft / TIME)));
  }

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  if (typeof module !== 'undefined') module.exports = { haversine: haversine, nearestOnLines: nearestOnLines, score: score, shuffle: shuffle };
  if (typeof document === 'undefined') return;

  // ---------- map ----------
  var NS = 'http://www.w3.org/2000/svg';
  var COS0 = Math.cos(44 * Math.PI / 180), K = 100;
  var B = GEO_MAP.box;
  function px(lon) { return (lon - B.w) * COS0 * K; }
  function py(lat) { return (B.n - lat) * K; }
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function pathOf(lines, close) {
    var d = '';
    for (var i = 0; i < lines.length; i++) {
      for (var j = 0; j < lines[i].length; j++) d += (j ? 'L' : 'M') + px(lines[i][j][0]).toFixed(1) + ' ' + py(lines[i][j][1]).toFixed(1);
      if (close) d += 'Z';
    }
    return d;
  }

  var svg = document.getElementById('map'), marks;
  function drawMap() {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, rings = [];
    GEO_MAP.outline.forEach(function (country) {
      country.forEach(function (ring) {
        rings.push(ring);
        ring.forEach(function (p) {
          minX = Math.min(minX, px(p[0])); maxX = Math.max(maxX, px(p[0]));
          minY = Math.min(minY, py(p[1])); maxY = Math.max(maxY, py(p[1]));
        });
      });
    });
    var pad = 8;
    svg.setAttribute('viewBox', (minX - pad) + ' ' + (minY - pad) + ' ' + (maxX - minX + 2 * pad) + ' ' + (maxY - minY + 2 * pad));
    var defs = el('defs', {}, svg);
    // North-to-south colour ramp mimics the lowland/highland relief.
    var g = el('linearGradient', { id: 'relief', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    [['0', '#43b649'], ['0.33', '#7cc04a'], ['0.45', '#b9b45a'], ['0.7', '#c99a5e'], ['1', '#a8703f']].forEach(function (s) {
      el('stop', { offset: s[0], 'stop-color': s[1] }, g);
    });
    var clip = el('clipPath', { id: 'land' }, defs);
    var land = pathOf(rings, true);
    el('path', { d: land }, clip);
    el('path', { d: land, fill: 'none', stroke: '#fff', 'stroke-width': 5, 'stroke-linejoin': 'round' }, svg);
    el('path', { d: land, fill: 'url(#relief)' }, svg);
    var rv = el('g', { 'clip-path': 'url(#land)', fill: 'none', stroke: '#2b8fd8', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    for (var name in GEO_MAP.rivers) el('path', { d: pathOf(GEO_MAP.rivers[name], false), 'stroke-width': name === 'Dunav' ? 2.6 : 1.6 }, rv);
    marks = el('g', {}, svg);
  }

  function toLatLon(evt) {
    var t = evt.changedTouches ? evt.changedTouches[0] : evt;
    var pt = svg.createSVGPoint();
    pt.x = t.clientX; pt.y = t.clientY;
    var p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { lat: B.n - p.y / K, lon: B.w + p.x / (COS0 * K) };
  }

  function mark(lat, lon, cls) {
    var x = px(lon), y = py(lat), g = el('g', { 'class': cls, transform: 'translate(' + x + ',' + y + ')' }, marks);
    if (cls === 'guess') {
      el('circle', { r: 6, 'class': 'ring' }, g);
      el('path', { d: 'M-4 -4L4 4M4 -4L-4 4' }, g);
    } else {
      el('path', { d: 'M0 0C-2-5-6-7-6-11A6 6 0 1 1 6-11C6-7 2-5 0 0Z' }, g);
      el('circle', { cy: -11, r: 2.2, fill: '#fff' }, g);
    }
  }

  // ---------- game state & UI ----------
  var $ = function (id) { return document.getElementById(id); };
  var store = window.localStorage;
  var state = null, timer = null, pending = null;

  function show(screen) {
    ['menu', 'game', 'result'].forEach(function (s) { $(s).style.display = s === screen ? '' : 'none'; });
  }

  function renderMenu() {
    var reached = +store.getItem('reached') || 0, list = $('rounds');
    list.innerHTML = '';
    GEO_ROUNDS.forEach(function (r, i) {
      var b = document.createElement('button');
      b.className = 'round' + (i > reached ? ' locked' : '');
      b.disabled = i > reached;
      b.innerHTML = '<b>' + (i + 1) + '</b> ' + r.name + (i > reached ? ' <span>🔒</span>' : '');
      b.onclick = function () { start(i); };
      list.appendChild(b);
    });
    $('best').textContent = store.getItem('best') || 0;
    show('menu');
  }

  function start(round) {
    state = { round: round, total: 0 };
    startRound();
  }

  function startRound() {
    var r = GEO_ROUNDS[state.round];
    state.qs = shuffle(r.places).slice(0, QUESTIONS_PER_ROUND);
    state.q = 0; state.roundPts = 0;
    store.setItem('reached', Math.max(+store.getItem('reached') || 0, state.round));
    $('roundName').textContent = 'Runda ' + (state.round + 1) + ' · ' + r.name;
    show('game');
    ask();
  }

  function ask() {
    marks.innerHTML = '';
    $('feedback').textContent = '';
    $('feedback').className = '';
    var q = state.qs[state.q];
    $('qNum').textContent = 'Pitanje ' + (state.q + 1) + '/' + state.qs.length;
    $('target').textContent = q[0];
    $('points').textContent = state.total;
    state.answered = false;
    state.left = TIME;
    tick();
    clearInterval(timer);
    timer = setInterval(function () { state.left -= 0.1; tick(); if (state.left <= 0) answer(null); }, 100);
  }

  function tick() {
    var f = Math.max(0, state.left / TIME);
    $('bar').style.width = (f * 100) + '%';
    $('bar').className = f < 0.3 ? 'low' : '';
    $('clock').textContent = Math.max(0, Math.ceil(state.left)) + 's';
  }

  function answer(guess) {
    if (state.answered) return;
    state.answered = true;
    clearInterval(timer);
    var q = state.qs[state.q], isRiver = GEO_ROUNDS[state.round].rivers, km = Infinity, tLat, tLon;
    if (isRiver) {
      var lines = GEO_MAP.rivers[q[0]];
      if (guess) { var n = nearestOnLines(guess.lat, guess.lon, lines); km = n.km; tLat = n.lat; tLon = n.lon; }
      el('path', { d: pathOf(lines, false), 'class': 'river-hit' }, marks);
    } else {
      tLat = q[1]; tLon = q[2];
      if (guess) km = haversine(guess.lat, guess.lon, tLat, tLon);
    }
    var pts = guess ? score(km, state.left) : 0;
    if (guess) {
      el('line', { x1: px(guess.lon), y1: py(guess.lat), x2: px(tLon), y2: py(tLat), 'class': 'link' }, marks);
      mark(guess.lat, guess.lon, 'guess');
    }
    if (!isRiver) mark(tLat, tLon, 'pin');
    state.roundPts += pts; state.total += pts;
    $('points').textContent = state.total;
    var fb = $('feedback');
    fb.textContent = !guess ? 'Isteklo vreme!' : (km < 1 ? 'Pogodak!' : 'Promašaj: ' + Math.round(km) + ' km') + '  +' + pts;
    fb.className = pts >= 700 ? 'good' : pts > 0 ? 'ok' : 'bad';
    pending = setTimeout(next, 1800);
  }

  function next() {
    state.q++;
    if (state.q < state.qs.length) return ask();
    var passed = state.roundPts >= PASS, last = state.round === GEO_ROUNDS.length - 1;
    if (state.total > (+store.getItem('best') || 0)) store.setItem('best', state.total);
    if (passed && !last) store.setItem('reached', Math.max(+store.getItem('reached') || 0, state.round + 1));
    $('resTitle').textContent = passed ? (last ? 'Svaka čast! Završio si sve runde!' : 'Runda pređena!') : 'Kraj igre';
    $('resRound').textContent = state.roundPts + ' / ' + (state.qs.length * 1000);
    $('resTotal').textContent = state.total;
    $('resNext').style.display = passed && !last ? '' : 'none';
    $('resNote').textContent = passed ? '' : 'Za sledeću rundu treba bar ' + PASS + ' poena.';
    show('result');
  }

  function onTap(e) {
    if (!state || state.answered) return;
    e.preventDefault();
    answer(toLatLon(e));
  }
  svg.addEventListener('touchstart', onTap);
  svg.addEventListener('mousedown', onTap);
  $('play').onclick = function () { start(0); };
  $('resNext').onclick = function () { state.round++; startRound(); };
  $('resMenu').onclick = renderMenu;
  $('quit').onclick = function () { clearInterval(timer); clearTimeout(pending); state = null; renderMenu(); };

  drawMap();
  renderMenu();
})();
