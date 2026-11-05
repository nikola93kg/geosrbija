// GeoSrbija game. Plain ES5 so it runs on old Android WebViews.
(function () {
  var QUESTIONS_PER_ROUND = 10;
  var TIME = 15;            // default seconds per question
  var ZERO_KM = 100;        // default distance at which a guess is worth 0 points

  var GEO_LEVELS = [
    { id: 0, title: 'Туриста', sub: 'Почетник', time: 18, zeroKm: 120, pass: 4000, regions: true, slice: [0, 0.65] },
    { id: 1, title: 'Излетник', sub: 'Аматер', time: 15, zeroKm: 100, pass: 4800, regions: true, slice: [0, 0.85] },
    { id: 2, title: 'Планинар', sub: 'Средњи', time: 12, zeroKm: 85, pass: 5500, regions: true, slice: [0, 1] },
    { id: 3, title: 'Географ', sub: 'Тежак', time: 10, zeroKm: 70, pass: 6500, regions: false, slice: [0.25, 1] },
    { id: 4, title: 'Чувар Србије', sub: 'Експерт', time: 8, zeroKm: 55, pass: 7500, regions: false, slice: [0.35, 1] }
  ];

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

  function score(km, timeLeft, maxTime, zeroKm) {
    if (timeLeft <= 0) return 0;
    var z = zeroKm || ZERO_KM, t = maxTime || TIME;
    var acc = Math.max(0, 1 - km / z);
    return Math.round(1000 * acc * (0.5 + 0.5 * Math.min(1, timeLeft / t)));
  }

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  if (typeof module !== 'undefined') module.exports = { haversine: haversine, nearestOnLines: nearestOnLines, score: score, shuffle: shuffle, GEO_LEVELS: GEO_LEVELS };
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
      var inner = el('g', { id: id + 'Regions', 'clip-path': 'url(#' + id + 'Clip)' }, target);
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
  ['click', 'tap', 'tick', 'good', 'ok', 'bad', 'wrong_answer', 'win', 'lose'].forEach(function (k) {
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

  var ROUND_ILLS = ['ill_tvrdjava.png', 'ill_mapa_srbije.png', 'ill_crkva.png', 'ill_planinski_vrhovi.png', 'ill_cetinar.png', 'ill_reka_dolina.png'];

  function openSub(id) {
    ['mainNav', 'subRounds', 'subRecords', 'subStats', 'subSettings'].forEach(function (s) {
      $(s).style.display = s === (id || 'mainNav') ? '' : 'none';
    });
  }

  function getLevel() {
    var idx = +store.getItem('level') || 0;
    return GEO_LEVELS[idx] || GEO_LEVELS[0];
  }

  function reachedFor(lvlIdx) {
    return +store.getItem('reached_l' + lvlIdx) || 0;
  }

  function renderMenu(sub) {
    var lvl = getLevel(), reached = reachedFor(lvl.id);
    var lvlBox = $('levels'), list = $('rounds'), recs = $('roundRecords');
    lvlBox.innerHTML = ''; list.innerHTML = ''; recs.innerHTML = '';

    GEO_LEVELS.forEach(function (l) {
      var lb = document.createElement('button');
      lb.className = 'level-btn' + (l.id === lvl.id ? ' active' : '');
      lb.innerHTML = l.title + '<small>' + l.sub + '</small>';
      lb.onclick = function () {
        sfx('click');
        store.setItem('level', l.id);
        renderMenu('subRounds');
      };
      lvlBox.appendChild(lb);
    });
    $('levelInfo').textContent = 'Ниво: ' + lvl.title + ' (' + lvl.sub + ') · ⏱ ' + lvl.time + 'с · Потребно за следећу рунду: ' + lvl.pass + ' п.';

    GEO_ROUNDS.forEach(function (r, i) {
      var b = document.createElement('button');
      b.className = 'round' + (i > reached ? ' locked' : '');
      b.disabled = i > reached;
      b.innerHTML = '<img class="r-ill" src="img/' + ROUND_ILLS[i] + '" alt=""><b>' + (i + 1) + '</b> ' + r.name + (i > reached ? ' <span>🔒</span>' : ' <span>›</span>');
      b.onclick = function () { start(i); };
      list.appendChild(b);

      var row = document.createElement('div');
      row.className = 'info-row';
      row.innerHTML = '<span>' + (i + 1) + '. ' + r.name + '</span><b>' + (+store.getItem('best_r' + i) || 0) + '</b>';
      recs.appendChild(row);
    });
    $('best').textContent = store.getItem('best') || 0;
    $('stGames').textContent = +store.getItem('st_games') || 0;
    $('stTotalPts').textContent = +store.getItem('st_pts') || 0;
    $('stHits').textContent = +store.getItem('st_hits') || 0;
    var bkm = store.getItem('st_best_km');
    $('stBestKm').textContent = bkm !== null ? bkm + ' км' : '—';
    $('stUnlocked').textContent = Math.min(GEO_ROUNDS.length, reached + 1) + ' / ' + GEO_ROUNDS.length + ' (' + lvl.title + ')';
    syncSoundUI();
    openSub(typeof sub === 'string' ? sub : null);
    show('menu');
  }

  function pickQuestions(places, lvl) {
    var n = places.length;
    var from = Math.min(Math.floor(n * lvl.slice[0]), Math.max(0, n - QUESTIONS_PER_ROUND));
    var to = Math.max(from + QUESTIONS_PER_ROUND, Math.ceil(n * lvl.slice[1]));
    return shuffle(places.slice(from, to)).slice(0, QUESTIONS_PER_ROUND);
  }

  function start(round) {
    sfx('click');
    var lvl = getLevel();
    if (round > reachedFor(lvl.id)) round = reachedFor(lvl.id);
    state = { level: lvl.id, lvl: lvl, round: round, total: 0, totalHits: 0, totalQs: 0, paused: false };
    var regEl = $('mRegions');
    if (regEl) regEl.style.display = lvl.regions ? '' : 'none';
    $('pauseModal').style.display = 'none';
    startRound();
  }

  function startRound() {
    var r = GEO_ROUNDS[state.round];
    state.qs = pickQuestions(r.places, state.lvl);
    state.q = 0; state.roundPts = 0; state.hits = 0; state.paused = false;
    $('roundIll').src = 'img/' + ROUND_ILLS[state.round];
    $('roundName').textContent = state.lvl.title + ' · Рунда ' + (state.round + 1) + ' · ' + r.name;
    show('game');
    ask();
  }

  function startTimer() {
    clearInterval(timer);
    timer = setInterval(function () {
      if (state.paused) return;
      state.left -= 0.1;
      tick();
      if (state.left <= 0) answer(null);
    }, 100);
  }

  function ask() {
    marks.innerHTML = '';
    $('feedback').textContent = '';
    $('feedback').className = '';
    var q = state.qs[state.q], tMax = state.lvl.time;
    $('qNum').textContent = 'Питање ' + (state.q + 1) + ' / ' + state.qs.length;
    $('target').textContent = q[0];
    $('points').textContent = state.total;
    state.answered = false; state.paused = false;
    state.left = tMax; state.lastSec = tMax;
    tick();
    startTimer();
  }

  function tick() {
    var tMax = state.lvl.time;
    var f = Math.max(0, state.left / tMax), sec = Math.max(0, Math.ceil(state.left));
    $('bar').style.width = (f * 100) + '%';
    $('bar').className = f < 0.3 ? 'low' : '';
    $('clock').textContent = '00:' + ('0' + sec).slice(-2);
    if (sec !== state.lastSec) { state.lastSec = sec; if (sec > 0 && sec <= 4) sfx('tick'); }
  }

  function pauseGame() {
    if (!state || state.answered || state.paused) return;
    sfx('click');
    state.paused = true;
    clearInterval(timer);
    $('pauseDesc').textContent = 'Ниво: ' + state.lvl.title + ' · Рунда ' + (state.round + 1) + ' (' + GEO_ROUNDS[state.round].name + ')';
    $('pauseModal').style.display = '';
  }

  function resumeGame() {
    if (!state || !state.paused) return;
    sfx('click');
    state.paused = false;
    $('pauseModal').style.display = 'none';
    startTimer();
  }

  function answer(guess) {
    if (state.answered || state.paused) return;
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
    var pts = guess ? score(km, state.left, state.lvl.time, state.lvl.zeroKm) : 0;
    if (guess) {
      el('line', { x1: px(guess.lon), y1: py(guess.lat), x2: px(tLon), y2: py(tLat), 'class': 'link' }, marks);
      mark(guess.lat, guess.lon, 'guess');
      var prevKm = store.getItem('st_best_km'), rkm = Math.round(km);
      if (prevKm === null || rkm < +prevKm) store.setItem('st_best_km', rkm);
    }
    if (!isRiver) mark(tLat, tLon, 'pin');
    var bigMiss = guess && km >= 65;
    state.totalQs++;
    if (pts > 0 && !bigMiss) { state.hits++; state.totalHits++; }
    state.roundPts += pts; state.total += pts;
    $('points').textContent = state.total;
    var fb = $('feedback'), kind = !guess || bigMiss || pts === 0 ? 'bad' : pts >= 700 ? 'good' : 'ok';
    var snd = bigMiss ? 'wrong_answer' : kind;
    fb.textContent = !guess ? '⏱ Истекло време!' : (kind === 'good' ? '✓ ' : kind === 'bad' ? '✗ ' : '') +
      (km < 1 ? 'Тачно!' : Math.round(km) + ' км') + '  +' + pts;
    fb.className = kind;
    setTimeout(function () { sfx(snd); }, guess ? 90 : 0);
    pending = setTimeout(next, bigMiss ? 2100 : 1800);
  }

  function next() {
    state.q++;
    if (state.q < state.qs.length) return ask();
    var passReq = state.lvl.pass;
    var passed = state.roundPts >= passReq, last = state.round === GEO_ROUNDS.length - 1;
    if (state.roundPts > (+store.getItem('best_r' + state.round) || 0)) store.setItem('best_r' + state.round, state.roundPts);
    store.setItem('st_pts', (+store.getItem('st_pts') || 0) + state.roundPts);
    store.setItem('st_hits', (+store.getItem('st_hits') || 0) + state.hits);

    // Unlock and advance to the next round ONLY if the player reached the required points for this round!
    if (passed && !last) {
      store.setItem('reached_l' + state.level, Math.max(reachedFor(state.level), state.round + 1));
      sfx('win');
      state.round++;
      return startRound();
    }

    if (state.total > (+store.getItem('best') || 0)) store.setItem('best', state.total);
    store.setItem('st_games', (+store.getItem('st_games') || 0) + 1);

    var hitRatio = state.totalHits / state.totalQs;
    var ptsRatio = state.total / (state.totalQs * 1000);
    var great = passed && (hitRatio >= 0.8 || ptsRatio >= 0.7);
    var good = passed && (hitRatio >= 0.6 || ptsRatio >= 0.5);
    $('resTitle').textContent = !passed ? 'Недовољно поена!' : great ? 'Одлично!' : good ? 'Врло добро!' : 'Добро!';
    $('resMsg').textContent = !passed ?
      'У рунди „' + GEO_ROUNDS[state.round].name + '“ освојио си ' + state.roundPts + ' поена, а за прелазак у рунду ' + (state.round + 2 <= GEO_ROUNDS.length ? (state.round + 2) : state.round + 1) + ' (' + state.lvl.title + ') потребно је бар ' + passReq + ' поена!' :
      great ? 'Веома добро познајеш географију Србије! Прешао си цео квиз!' :
      good ? 'Добро познајеш географију Србије! Прешао си све рунде!' :
      'Честитамо, успешно си завршио све рунде квиза!';
    $('resRibbon').textContent = state.totalHits + ' / ' + state.totalQs;
    $('resTotal').textContent = state.total;
    $('lblShare').textContent = 'Подели резултат';
    sfx(passed ? 'win' : 'lose');
    show('result');
  }

  function onTap(e) {
    if (!state || state.answered) return;
    e.preventDefault();
    answer(toLatLon(e));
  }
  function syncSoundUI() {
    var m = +store.getItem('muted');
    $('mute').textContent = m ? '🔇' : '🔊';
    $('lblSound').textContent = m ? '🔇 Звучни ефекти: Искључени' : '🔊 Звучни ефекти: Укључени';
  }
  function toggleSound() {
    var m = +store.getItem('muted') ? 0 : 1;
    store.setItem('muted', m);
    syncSoundUI();
    if (!m) sfx('click');
  }

  svg.addEventListener('touchstart', onTap);
  svg.addEventListener('mousedown', onTap);
  $('btnPlay').onclick = function () { sfx('click'); openSub('subRounds'); };
  $('btnRecords').onclick = function () { sfx('click'); openSub('subRecords'); };
  $('btnStats').onclick = function () { sfx('click'); openSub('subStats'); };
  $('btnSettings').onclick = function () { sfx('click'); openSub('subSettings'); };
  Array.prototype.forEach.call(document.querySelectorAll('.sub-back'), function (b) {
    b.onclick = function () { sfx('click'); openSub(null); };
  });
  $('play').onclick = function () { start(0); };
  $('btnPause').onclick = pauseGame;
  $('btnResume').onclick = resumeGame;
  $('btnRestart').onclick = function () { start(state ? state.round : 0); };
  $('btnPauseMenu').onclick = function () { sfx('click'); clearInterval(timer); clearTimeout(pending); state = null; $('pauseModal').style.display = 'none'; renderMenu(); };
  $('resRetry').onclick = function () { start(state && state.roundPts < state.lvl.pass ? state.round : 0); };
  $('resShare').onclick = function () {
    sfx('click');
    var txt = 'ГеоСрбија 🇷🇸 (' + state.lvl.title + ') — Резултат: ' + state.totalHits + '/' + state.totalQs + ' (' + state.total + ' поена)!';
    if (navigator.share) {
      navigator.share({ title: 'ГеоСрбија', text: txt })['catch'](function () {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt)['catch'](function () {});
    }
    $('lblShare').textContent = '✓ Резултат копиран!';
  };
  $('resStats').onclick = function () { sfx('click'); renderMenu('subStats'); };
  $('resMenu').onclick = function () { sfx('click'); renderMenu(); };
  $('quit').onclick = function () { sfx('click'); clearInterval(timer); clearTimeout(pending); state = null; renderMenu(); };
  $('mute').onclick = toggleSound;
  $('btnToggleSound').onclick = toggleSound;
  $('btnReset').onclick = function () {
    sfx('bad');
    store.clear();
    renderMenu();
  };

  drawMap();
  renderMenu();
})();
