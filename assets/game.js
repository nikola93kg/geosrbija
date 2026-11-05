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
  var PIN = 'M0 0C-2-5-6-7-6-11A6 6 0 1 1 6-11C6-7 2-5 0 0Z';

  // Draws the Serbia+Kosovo landmass into an <svg>; id prefix keeps gradient ids unique per svg.
  function drawLand(target, id, detail) {
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
    var pad = 10;
    target.setAttribute('viewBox', (minX - pad) + ' ' + (minY - pad) + ' ' + (maxX - minX + 2 * pad) + ' ' + (maxY - minY + 2 * pad + 8));
    var defs = el('defs', {}, target);
    var g = el('linearGradient', { id: id + 'Fill', x1: 0.1, y1: 0, x2: 0.8, y2: 1 }, defs);
    [['0', '#6ad14f'], ['0.5', '#46a844'], ['1', '#2c7d32']].forEach(function (s) { el('stop', { offset: s[0], 'stop-color': s[1] }, g); });
    var gl = el('linearGradient', { id: id + 'Gloss', x1: 0, y1: 0, x2: 0.3, y2: 0.7 }, defs);
    el('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0.25 }, gl);
    el('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 }, gl);
    var land = pathOf(rings, true);
    el('path', { d: land }, el('clipPath', { id: id + 'Clip' }, defs));

    el('path', { d: land, fill: 'rgba(5,22,48,0.38)', transform: 'translate(0,9)' }, target);          // drop shadow
    el('path', { d: land, fill: '#1b5e20', stroke: '#1b5e20', 'stroke-width': 5.5, 'stroke-linejoin': 'round', transform: 'translate(0,4.5)' }, target); // 3D rim
    el('path', { d: land, fill: 'none', stroke: '#fff', 'stroke-width': 5.5, 'stroke-linejoin': 'round' }, target);
    el('path', { d: land, fill: 'url(#' + id + 'Fill)' }, target);
    if (detail && GEO_MAP.regions) {
      var inner = el('g', { 'clip-path': 'url(#' + id + 'Clip)' }, target);
      var tints = { VOJ: '#8ef064', BG: '#b8ff8a', SUM: '#3b9c3a', JUG: '#236e27', KOS: '#195c1e' };
      for (var code in GEO_MAP.regions) {
        el('path', {
          d: pathOf([GEO_MAP.regions[code]], true),
          fill: tints[code] || 'none', 'fill-opacity': 0.18,
          stroke: 'rgba(255,255,255,0.42)', 'stroke-width': 1.4, 'stroke-dasharray': '4 2.5', 'stroke-linejoin': 'round'
        }, inner);
      }
    }
    el('path', { d: land, fill: 'url(#' + id + 'Gloss)' }, target);
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  }

  function drawMap() {
    drawLand(svg, 'm', true);
    marks = el('g', {}, svg);
    var logo = document.getElementById('logoMap'), c = drawLand(logo, 'l', false);
    el('path', { d: PIN, fill: '#d62828', stroke: '#fff', 'stroke-width': 1.5, transform: 'translate(' + c.cx + ',' + (c.cy + 30) + ') scale(5)' }, logo);
    el('circle', { cx: c.cx, cy: c.cy + 30 - 55, r: 11, fill: '#fff' }, logo);
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
      for (var i = 0; i < 2; i++) {
        var r = el('circle', { r: 4, 'class': 'ripple' }, g);
        el('animate', { attributeName: 'r', from: 4, to: 22, dur: '1.2s', begin: (i * 0.4) + 's', repeatCount: 'indefinite' }, r);
        el('animate', { attributeName: 'opacity', from: 1, to: 0, dur: '1.2s', begin: (i * 0.4) + 's', repeatCount: 'indefinite' }, r);
      }
      el('circle', { r: 4, 'class': 'dot' }, g);
    } else {
      el('path', { d: PIN, transform: 'scale(1.4)' }, g);
      el('circle', { cy: -15.4, r: 3, fill: '#fff' }, g);
    }
  }

  // ---------- game state & UI ----------
  var $ = function (id) { return document.getElementById(id); };
  var store = window.localStorage;
  var state = null, timer = null, pending = null, sounds = {};
  ['click', 'tap', 'tick', 'good', 'ok', 'bad', 'win', 'lose'].forEach(function (k) {
    var a = new Audio('sfx/' + k + '.wav');
    a.preload = 'auto';
    sounds[k] = a;
  });
  function sfx(name) {
    if (+store.getItem('muted') || !sounds[name]) return;
    try { sounds[name].currentTime = 0; sounds[name].play(); } catch (e) {}
  }

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
      b.innerHTML = '<b>' + (i + 1) + '</b> ' + r.name + (i > reached ? ' <span>🔒</span>' : ' <span>›</span>');
      b.onclick = function () { start(i); };
      list.appendChild(b);
    });
    $('best').textContent = store.getItem('best') || 0;
    show('menu');
  }

  function start(round) {
    sfx('click');
    state = { round: round, total: 0 };
    startRound();
  }

  function startRound() {
    var r = GEO_ROUNDS[state.round];
    state.qs = shuffle(r.places).slice(0, QUESTIONS_PER_ROUND);
    state.q = 0; state.roundPts = 0;
    store.setItem('reached', Math.max(+store.getItem('reached') || 0, state.round));
    $('roundName').textContent = 'Рунда ' + (state.round + 1) + ' · ' + r.name;
    show('game');
    ask();
  }

  function ask() {
    marks.innerHTML = '';
    $('feedback').textContent = '';
    $('feedback').className = '';
    var q = state.qs[state.q];
    $('qNum').textContent = 'Питање ' + (state.q + 1) + ' / ' + state.qs.length;
    $('target').textContent = q[0];
    $('points').textContent = state.total;
    state.answered = false;
    state.left = TIME; state.lastSec = TIME;
    tick();
    clearInterval(timer);
    timer = setInterval(function () { state.left -= 0.1; tick(); if (state.left <= 0) answer(null); }, 100);
  }

  function tick() {
    var f = Math.max(0, state.left / TIME), sec = Math.max(0, Math.ceil(state.left));
    $('bar').style.width = (f * 100) + '%';
    $('bar').className = f < 0.3 ? 'low' : '';
    $('clock').textContent = '00:' + ('0' + sec).slice(-2);
    if (sec !== state.lastSec) { state.lastSec = sec; if (sec > 0 && sec <= 4) sfx('tick'); }
  }

  function answer(guess) {
    if (state.answered) return;
    state.answered = true;
    clearInterval(timer);
    if (guess) sfx('tap');
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
    var fb = $('feedback'), kind = pts >= 700 ? 'good' : pts > 0 ? 'ok' : 'bad';
    fb.textContent = !guess ? '⏱ Истекло време!' : (pts >= 700 ? '✓ ' : pts > 0 ? '' : '✗ ') +
      (km < 1 ? 'Тачно!' : Math.round(km) + ' км') + '  +' + pts;
    fb.className = kind;
    setTimeout(function () { sfx(kind); }, guess ? 90 : 0);
    pending = setTimeout(next, 1800);
  }

  function next() {
    state.q++;
    if (state.q < state.qs.length) return ask();
    var passed = state.roundPts >= PASS, last = state.round === GEO_ROUNDS.length - 1;
    if (state.total > (+store.getItem('best') || 0)) store.setItem('best', state.total);
    if (passed && !last) store.setItem('reached', Math.max(+store.getItem('reached') || 0, state.round + 1));
    var ratio = state.roundPts / (state.qs.length * 1000);
    $('resTitle').textContent = ratio >= 0.8 ? 'Одлично!' : ratio >= 0.6 ? 'Врло добро!' : passed ? 'Браво!' : 'Пробај поново!';
    $('resMsg').textContent = !passed ? 'За следећу рунду треба бар ' + PASS + ' поена.' :
      last ? 'Свака част! Одлично познајеш географију Србије!' :
      'Прешао си рунду „' + GEO_ROUNDS[state.round].name + '”. Следи: ' + GEO_ROUNDS[state.round + 1].name + '.';
    $('resRound').textContent = state.roundPts + ' / ' + (state.qs.length * 1000);
    $('resTotal').textContent = state.total;
    $('resNext').style.display = passed && !last ? '' : 'none';
    $('resRetry').style.display = !passed || last ? '' : 'none';
    sfx(passed ? 'win' : 'lose');
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
  $('resNext').onclick = function () { sfx('click'); state.round++; startRound(); };
  $('resRetry').onclick = function () { sfx('click'); startRound(); };
  $('resMenu').onclick = function () { sfx('click'); renderMenu(); };
  $('quit').onclick = function () { sfx('click'); clearInterval(timer); clearTimeout(pending); state = null; renderMenu(); };
  $('mute').textContent = +store.getItem('muted') ? '🔇' : '🔊';
  $('mute').onclick = function () {
    var m = +store.getItem('muted') ? 0 : 1;
    store.setItem('muted', m);
    $('mute').textContent = m ? '🔇' : '🔊';
    if (!m) sfx('click');
  };

  drawMap();
  renderMenu();
})();
