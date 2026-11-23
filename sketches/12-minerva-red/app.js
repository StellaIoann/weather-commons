// Minerva Red: one map from Tripoli to Crete, two sites and a storm.
// A 2D canvas with a tilted top-down camera (orthographic): pictures lie flat on the ground,
// the time blocks stand above them, the dust floats a little above the map.
// Data comes from data/scene.json, made by tools/prep.py.

// ---- the story: edit names and texts here ----
const STEPS = [
  { name: 'April 2024 Duststorm', view: 'region', layer: 'storm', loop: true,
    kind: 'Dust · modelled (CAMS forecast), not a satellite image',
    text: 'Dust lifted over Libya on 21 April and crossed the sea; over Crete it peaked on the evening of 23 April.' },
  { name: 'Al Atayah', view: 'ataya', layer: 'ataya',
    kind: 'Landsat pictures · observed  /  vegetation change (NDVI) · derived from observations',
    text: 'The dunes Esso fixed with oil. Each point is a 72 m cell whose vegetation rose (rust) or fell (sand) clearly and stayed so, placed at the year it changed.' },
  { name: 'Zelten', view: 'zelten', layer: 'zelten',
    kind: 'Landsat pictures and flare detections · observed  /  gas volume, VIIRS Nightfire · observed',
    text: 'The oil field. Beside it, the 2 km around its three gas flares, enlarged ten times: a point is a 30 m pixel seen burning that year, sized by the share of satellite passes that caught it.' },
  { name: 'Film', view: 'region', layer: null,
    video: 'https://player.vimeo.com/video/VIDEO_ID',      // paste the link from Vimeo: Share → Embed, the src="…" part
    kind: 'Film · Stella Ioannidou, 2026',
    text: 'tk' },
  { name: 'Explore', view: 'region', layer: null, free: true,
    kind: '',
    text: 'Move freely. Double-click to come back.' },
];

// ---- world: kilometres on a plain lat/lon grid (equirectangular, like the storm frames) ----
const LAT0 = 32.25, KX = 111.32 * Math.cos(LAT0 * Math.PI / 180), KY = 110.57;
const wx = lon => (lon - 19) * KX, wy = lat => -(lat - LAT0) * KY;
const ZA = 22;                                  // Al Atayah block height, km
const ZH2 = 18, M = 10;                         // Zelten block: height (km), enlargement
const GAP = 6;                                  // km between a site picture and its block (blocks stand to the east)
const ZS = 8;                                   // storm sheet height, km
const Y0 = 1984, Y1 = 2025;                     // Zelten years
const RUST = 'rgb(176,84,52)', SAND = 'rgb(236,222,190)', FLARE = [216, 90, 48];
const DUST = 'rgb(214,160,90)', COASTC = 'rgb(120,175,255)', FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const KEY = [[DUST, 'Dust, modelled (CAMS forecast)'], [RUST, 'Vegetation gained, derived from Landsat (NDVI)'],
             [SAND, 'Vegetation lost, derived from Landsat (NDVI)'], [`rgb(${FLARE})`, 'Gas flares, observed (Landsat)'],
             [COASTC, 'Coast, cartographic (LSIB)']];
const PLACES = [['Tripoli', 13.19, 32.89], ['Sirte', 16.59, 31.21], ['Benghazi', 20.07, 32.12], ['Crete', 24.9, 35.0]];

const cv = document.getElementById('c'), ui = id => document.getElementById(id);
let ctx = cv.getContext('2d');
const ANG = { ataya: [0, 1.2], zelten: [0, 1.2] };   // the inset: turn and tilt (radians); tilt 1.57 = straight down, 1.2 = plan oblique
const DPR = window.devicePixelRatio || 1;
let cw = 0, ch = 0, ox = 0, S, IMG = {}, step = 0;     // ox: screen centre, left of the story box
let cam = { x: 0, y: 0, s: 1, phi: 0, elev: 1, cz: 0 }, flight = null;
const T = { ataya: 0, zelten: Y0, storm: 0 }, playing = { on: false, last: 0, acc: 0 };
let grow = 1, growT0 = 0;

let COAST = null;                               // vector coastline (data/coast.json), else the base picture
Promise.all([fetch('data/scene.json').then(r => r.json()),
             fetch('data/coast.json').then(r => (r.ok ? r.json() : null)).catch(() => null)])
  .then(([d, c]) => { if (c) COAST = c.map(r => Float32Array.from(r.flatMap(([lon, lat]) => [wx(lon), wy(lat)]))); init(d); });

function img(src) { if (!IMG[src]) { IMG[src] = new Image(); IMG[src].src = src; } return IMG[src]; }

function init(d) {
  S = d;
  const a = S.ataya, [w0, s0, e0, n0] = a.box;
  a.yr = a.dates.map(ym => +ym.slice(0, 4) + (+ym.slice(5, 7) - 0.5) / 12);
  const span = a.yr[a.yr.length - 1] - a.yr[0] + 1, cx = (wx(e0) - wx(w0)) / a.w, cy = (wy(s0) - wy(n0)) / a.h;
  a.cell = cx; a.dx = wx(e0) - wx(w0) + GAP;        // the block is the picture's frame, moved east
  const n = a.events.length / 4;
  a.X = new Float32Array(n); a.Y = new Float32Array(n); a.Z = new Float32Array(n); a.K = new Int16Array(n); a.G = new Int8Array(n);
  for (let i = 0; i < n; i++) {
    const [x, y, k, g] = a.events.slice(i * 4, i * 4 + 4);
    a.X[i] = wx(w0) + (x + 0.5) * cx + a.dx; a.Y[i] = wy(n0) + (y + 0.5) * cy;
    a.Z[i] = (a.yr[k] - a.yr[0]) / span * ZA; a.K[i] = k; a.G[i] = g;
  }
  a.z = k => (a.yr[k] - a.yr[0]) / span * ZA;
  const z = S.zelten, [fw, fs, fe, fn] = z.flareBox;
  z.fx = (wx(fw) + wx(fe)) / 2; z.fy = (wy(fs) + wy(fn)) / 2;
  z.bx = wx(z.box[2]) + GAP + (wx(fe) - wx(fw)) * M / 2;   // centre of the enlarged block, east of the picture
  z.zz = y => (y - Y0 + 0.5) / (Y1 - Y0 + 1) * ZH2;
  z.pts = z.flares.map(([y, lon, lat, sh]) => ({ y, X: z.bx + (wx(lon) - z.fx) * M, Y: z.fy + (wy(lat) - z.fy) * M, s: sh }));
  img('data/base.png');
  new Set(a.pics).forEach(p => img(`data/ataya/${p}.jpg`));
  z.pics.forEach(p => img(`data/zelten/${p}.jpg`));
  S.storm.frames.forEach(f => img(`data/storm/${f}.png`));
  ui('steps').innerHTML = '<button data-d="-1" aria-label="Back">←</button>' +
    STEPS.map((s, i) => `<button data-i="${i}" title="${s.name}">${i + 1}</button>`).join('') + '<button data-d="1" aria-label="Next">→</button>';
  ui('steps').onclick = e => { const b = e.target.closest('button'); if (b) go(b.dataset.d ? step + +b.dataset.d : +b.dataset.i); };
  ui('key').innerHTML = KEY.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join('');
  resize(); cam = view(STEPS[0].view); go(0, true);
  requestAnimationFrame(frame);
}

// ---- camera ----
function P(X, Y, Z = 0) {
  const dx = X - cam.x, dy = Y - cam.y, c = Math.cos(cam.phi), s = Math.sin(cam.phi);
  const rx = dx * c - dy * s, ry = dx * s + dy * c;
  return [ox + rx * cam.s, ch / 2 + (ry * Math.sin(cam.elev) - (Z - cam.cz) * Math.cos(cam.elev)) * cam.s];
}

// the camera that frames a lon/lat box (and a block of height top above it)
function view(name) {
  const B = { region: [S.region, null, 0, 1.1, 0.95], ataya: [S.ataya.box, blockA(), 0.2, 0.8, 0.88],
              zelten: [S.zelten.box, blockZ(), 0.2, 0.8, 0.88] }[name];
  const [box3, blk, phi, elev, f] = B;
  const G = corners(box3).map(([X, Y]) => [X, Y, 0]);
  if (blk) blk[0].forEach(([X, Y]) => G.push([X, Y, 0], [X, Y, blk[1]]));
  return fit(G, phi, elev, f);
}

// the camera that fits a set of 3D points into the current screen (cw, ch, ox)
function fit(G, phi, elev, f, pad = 40) {
  const c = { x: 0, y: 0, s: 1, phi, elev, cz: 0 };
  G.forEach(([X, Y]) => { c.x += X / G.length; c.y += Y / G.length; });
  const keep = cam; cam = c;
  const pts = G.map(p => P(...p));
  cam = keep;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), mx = (Math.max(...xs) + Math.min(...xs)) / 2 - ox;
  const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys), mid = (Math.max(...ys) + Math.min(...ys)) / 2 - ch / 2;
  c.cz = -mid / Math.cos(elev);
  c.x += mx * Math.cos(phi); c.y -= mx * Math.sin(phi);       // centre sideways too
  c.s = Math.min(2 * ox * f / bw, (ch - pad) * f / bh);
  return c;
}

function flyTo(to, ms = 2400) {
  const from = { ...cam }, d = Math.hypot(to.x - from.x, to.y - from.y);
  const need = Math.log(Math.min(cw, ch) * 0.7 / Math.max(d, 1e-3));
  const dip = Math.max(0, Math.min(Math.log(from.s), Math.log(to.s)) - need);
  flight = { from, to, dip, t0: performance.now(), ms };
}

function fly(now) {
  if (!flight) return;
  const { from: A, to: B, dip, t0, ms } = flight, t = Math.min(1, (now - t0) / ms), e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const L = (a, b) => a + (b - a) * e;
  cam = { x: L(A.x, B.x), y: L(A.y, B.y), phi: L(A.phi, B.phi), elev: L(A.elev, B.elev), cz: L(A.cz, B.cz),
          s: Math.exp(L(Math.log(A.s), Math.log(B.s)) - dip * Math.sin(Math.PI * t)) };
  if (t >= 1) { flight = null; arrive(); }
}

// ---- steps and time ----
function go(i, now) {
  step = Math.max(0, Math.min(STEPS.length - 1, i));
  const st = STEPS[step];
  ui('steps').querySelectorAll('[data-i]').forEach((b, j) => b.setAttribute('aria-current', j === step));
  ui('st-title').textContent = st.name;
  ui('kind').textContent = `${step + 1} of ${STEPS.length}` + (st.kind ? ' · ' + st.kind : ''); ui('text').textContent = st.text;
  playing.on = false; ui('rail').toggleAttribute('data-off', !st.layer);
  if (st.layer) setupSlider(st.layer); else { ui('tl').textContent = ''; ui('sub').textContent = ''; }
  const site = st.layer === 'ataya' || st.layer === 'zelten';
  ui('insets').hidden = !site; topKey = null;
  if (site) showInset(st.layer === 'ataya' ? 'top' : 'ang');     // Al Atayah: plan; Zelten: plan oblique
  mi = 0; showMedia();
  film(st.video);
  const to = view(st.view);
  if (now) { cam = to; arrive(); } else flyTo(to);
}

function arrive() {                              // the guided part: play the layer once the camera is there
  const L = STEPS[step].layer; if (!L) return;
  setT(L, L === 'zelten' ? Y0 : 0); play(true);
}

function setupSlider(L) {
  const r = ui('t');
  if (L === 'ataya') { r.min = 0; r.max = S.ataya.dates.length - 1; r.step = 1; }
  if (L === 'zelten') { r.min = Y0; r.max = Y1; r.step = 1; }
  if (L === 'storm') { r.min = 0; r.max = S.storm.frames.length - 1; r.step = 0.01; }
  setT(L, T[L]); ticks(L);
}

function setT(L, v) {
  if (L === 'zelten' && v !== T.zelten) { grow = 0; growT0 = performance.now(); }
  T[L] = v; ui('t').value = v;
  let lab = '', sub = '';
  if (L === 'ataya') { lab = S.ataya.dates[v].slice(0, 4); sub = 'picture ' + month(S.ataya.pics[v]); }
  if (L === 'zelten') { lab = v; const p = zpic(); sub = p ? 'picture ' + day(p) : '';
    if (S.zelten.vol[v]) sub = S.zelten.vol[v].toFixed(2) + ' billion m³ gas flared · ' + sub; }
  if (L === 'storm') { const f = S.storm.frames[Math.round(v)]; lab = stamp(f); }
  ui('tl').textContent = lab; ui('sub').textContent = sub;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const month = ym => ym ? MON[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4) : '';
const day = d => +d.slice(8, 10) + ' ' + month(d);
const stamp = f => `${+f.slice(8, 10)} Apr, ${f.slice(11, 13)}:00 UTC`;
const zpic = () => { const ps = S.zelten.pics.filter(p => +p.slice(0, 4) <= T.zelten); return ps[ps.length - 1] || S.zelten.pics[0]; };

function play(on) { playing.on = on; playing.acc = 0; playing.last = performance.now(); ui('play').textContent = on ? '❚❚ Pause' : '▶ Run'; }

// tick marks under the time line, labelled now and then
function ticks(L) {
  let list = [];
  if (L === 'ataya') list = S.ataya.dates.map((d, i, a) => [i, d.slice(0, 4), !i || i === a.length - 1 || (+d.slice(0, 4) % 10 < +a[i - 1].slice(0, 4) % 10)]);
  if (L === 'zelten') for (let y = Y0; y <= Y1; y++) list.push([y, y, y % 5 === 0]);
  if (L === 'storm') list = S.storm.frames.map((f, i) => [i, `${+f.slice(8, 10)} Apr`, f.slice(11, 13) === '00']);
  const lo = +ui('t').min, hi = +ui('t').max;
  ui('ticks').innerHTML = list.map(([v, txt, big]) => { const x = ((v - lo) / (hi - lo) * 100).toFixed(2);
    return `<i class="${big ? 'l' : ''}" style="left:${x}%"></i>` + (big ? `<span style="left:${x}%">${txt}</span>` : ''); }).join('');
}
ui('play').onclick = () => {
  const L = STEPS[step].layer; if (!L) return;
  if (!playing.on && +ui('t').value >= +ui('t').max) setT(L, +ui('t').min);
  play(!playing.on);
};
ui('t').oninput = () => { play(false); const L = STEPS[step].layer; setT(L, L === 'storm' ? +ui('t').value : Math.round(+ui('t').value)); };

function tick(now) {
  if (!playing.on) return;
  const L = STEPS[step].layer, dt = Math.max(0, now - playing.last); playing.last = now;
  if (L === 'storm') {
    const end = S.storm.frames.length - 1;
    let v = T.storm + dt / 700;
    if (v >= end) { if (STEPS[step].loop) v = 0; else { v = end; play(false); } }
    setT(L, v); return;
  }
  playing.acc += dt;
  const every = L === 'zelten' ? 700 : 600;
  if (playing.acc < every) return;
  playing.acc = 0;
  if (+T[L] >= +ui('t').max) { play(false); return; }
  setT(L, T[L] + 1);
}

// ---- drawing ----
function plane(im, [w, s, e, n], Z, alpha = 1) {
  if (!im || !im.complete || !im.naturalWidth) return;
  const o = P(wx(w), wy(n), Z), a = P(wx(e), wy(n), Z), b = P(wx(w), wy(s), Z);
  ctx.globalAlpha = alpha;
  ctx.setTransform(DPR * (a[0] - o[0]) / im.width, DPR * (a[1] - o[1]) / im.width,
                   DPR * (b[0] - o[0]) / im.height, DPR * (b[1] - o[1]) / im.height, DPR * o[0], DPR * o[1]);
  ctx.drawImage(im, 0, 0);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1;
}
const corners = ([w, s, e, n]) => [[wx(w), wy(n)], [wx(e), wy(n)], [wx(e), wy(s)], [wx(w), wy(s)]];
const blockA = () => [corners(S.ataya.box).map(([X, Y]) => [X + S.ataya.dx, Y]), ZA + 0.5];
const blockZ = () => { const z = S.zelten; return [corners(z.flareBox).map(([X, Y]) => [z.bx + (X - z.fx) * M, z.fy + (Y - z.fy) * M]), ZH2]; };
function ring(pts, close = true) { ctx.beginPath(); pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](...p)); if (close) ctx.closePath(); ctx.stroke(); }
function line(a, b) { ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); }
function box(C, z0, z1) {                         // dashed wire block
  ctx.setLineDash([3, 4]);
  ring(C.map(([X, Y]) => P(X, Y, z0))); ring(C.map(([X, Y]) => P(X, Y, z1)));
  C.forEach(([X, Y]) => line(P(X, Y, z0), P(X, Y, z1)));
  ctx.setLineDash([]);
}
function label(txt, x, y, size = 12, col = '#fff', align = 'left') {
  ctx.font = `${size}px ${FONT}`; ctx.fillStyle = col; ctx.textAlign = align; ctx.fillText(txt, x, y); ctx.textAlign = 'left';
}

function frame(now) {
  fly(now); tick(now);
  if (grow < 1) { const g = Math.max(0, Math.min(1, (now - growT0) / 450)); grow = 1 - Math.pow(1 - g, 3); }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cw, ch);
  const L = STEPS[step].layer, free = STEPS[step].free;

  if (COAST) drawCoast(); else { plane(img('data/base.png'), S.region, 0); drawGrid(); }
  plane(img(`data/ataya/${S.ataya.pics[T.ataya]}.jpg`), S.ataya.box, 0);
  plane(img(`data/zelten/${zpic()}.jpg`), S.zelten.box, 0);

  // markers: pulse while a site is small on screen
  for (const [b, name] of [[S.ataya.box, 'Al Atayah'], [S.zelten.box, 'Zelten']]) {
    const q = corners(b).map(([X, Y]) => P(X, Y)), size = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]);
    const fade = Math.max(0, Math.min(1, 1 - (size - 30) / 60));
    if (!fade) continue;
    ctx.strokeStyle = `rgba(255,255,255,${fade * (0.45 + 0.45 * Math.sin(now / 255))})`; ctx.lineWidth = 1.5; ring(q); ctx.lineWidth = 1;
    label(name, Math.max(...q.map(p => p[0])) + 8, Math.min(...q.map(p => p[1])) + 10, 12, `rgba(255,255,255,${fade})`);
  }
  if (cam.s < 3) for (const [name, lon, lat] of PLACES) {
    const [x, y] = P(wx(lon), wy(lat)); ctx.fillStyle = '#fff'; ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    label(name, x + 6, y + 4, 12);
  }

  if (L === 'ataya' || free) drawAtaya(free ? S.ataya.dates.length - 1 : T.ataya);
  if (L === 'zelten' || free) drawZelten(free ? Y1 : T.zelten);
  if (L === 'storm') {
    const i = Math.floor(T.storm), f = T.storm - i, fr = S.storm.frames;
    plane(img(`data/storm/${fr[i]}.png`), S.storm.box, ZS, 1 - f);
    if (f > 0 && fr[i + 1]) plane(img(`data/storm/${fr[i + 1]}.png`), S.storm.box, ZS, f);
  }
  if (!STEPS[step].video) edgeLabels();
  if (L === 'ataya' || L === 'zelten') drawInsets(L);
  requestAnimationFrame(frame);
}

function drawCoast() {                           // land filled, coastline 1 px at any zoom, clipped to the map
  ctx.save();
  ctx.beginPath(); corners(S.region).forEach(([X, Y], i) => ctx[i ? 'lineTo' : 'moveTo'](...P(X, Y))); ctx.closePath(); ctx.clip();
  ctx.beginPath();
  for (const r of COAST) {
    for (let i = 0; i < r.length; i += 2) { const [x, y] = P(r[i], r[i + 1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath();
  }
  ctx.fillStyle = '#0f0f0f'; ctx.fill('evenodd');
  ctx.strokeStyle = COASTC; ctx.lineWidth = 1; ctx.stroke();
  drawGrid();
  ctx.restore();
}

// lines of latitude and longitude, spaced for the zoom; their numbers ride the bottom and right edges
let EDGE = [];
function drawGrid() {
  const px = cam.s * KX, st = [0.05, 0.1, 0.2, 0.5, 1, 2, 5].find(v => v * px >= 70) || 5, [w, s, e, n] = S.region;
  ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = 1; EDGE = [];
  const yb = ch - 10, xr = cw - 10;
  for (let v = Math.ceil(w / st) * st; v <= e + 1e-9; v += st) {
    const A = P(wx(v), wy(s)), B = P(wx(v), wy(n)); line(A, B);
    const t = (yb - A[1]) / (B[1] - A[1]), lab = `${+v.toFixed(2)}° E`;
    if (t >= 0 && t <= 1) EDGE.push([lab, A[0] + t * (B[0] - A[0]), yb, 'center']);
    else if (A[1] < yb && A[0] > 0 && A[0] < cw) EDGE.push([lab, A[0], A[1] + 14, 'center']);
  }
  for (let v = Math.ceil(s / st) * st; v <= n + 1e-9; v += st) {
    const A = P(wx(w), wy(v)), B = P(wx(e), wy(v)); line(A, B);
    const t = (xr - A[0]) / (B[0] - A[0]), lab = `${+v.toFixed(2)}° N`;
    if (t >= 0 && t <= 1) EDGE.push([lab, xr, A[1] + t * (B[1] - A[1]) + 3, 'right']);
    else if (B[0] < xr && B[1] > 0 && B[1] < ch) EDGE.push([lab, B[0] + 6, B[1] + 3, 'left']);
  }
}
function edgeLabels() {
  for (const [txt, x, y, al] of EDGE) if (y > 220 || al !== 'right') label(txt, x, y, 9, 'rgba(255,255,255,.55)', al);
}

function drawAtaya(cur) {
  const a = S.ataya, [C, top] = blockA();
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; box(C, 0, top);
  const sz = Math.max(INSET ? 1.6 : 1, a.cell * cam.s * 0.9);
  if (sz * a.w > 40) for (const [g, col] of [[1, RUST], [-1, SAND]]) {
    ctx.fillStyle = col;
    for (let i = 0; i < a.K.length; i++) {
      if (a.G[i] !== g || a.K[i] > cur) continue;
      const [x, y] = P(a.X[i], a.Y[i], a.Z[i]); ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    }
  }
  const q = C.map(([X, Y]) => P(X, Y, a.z(cur)));
  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ring(q);
  const r = q.reduce((m, p) => (p[0] > m[0] ? p : m));
  if (!INSET && r[0] - Math.min(...q.map(p => p[0])) > 120) label(a.dates[cur].slice(0, 4), r[0] + 14, r[1] + 6, 18);
}

function drawZelten(cur) {
  const z = S.zelten, C = corners(z.flareBox), [Cm] = blockZ();
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; box(Cm, 0, ZH2);
  if (!INSET) {
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ring(C.map(([X, Y]) => P(X, Y, 0)));   // the real 2 km, on the picture
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.setLineDash([2, 4]);
    [[1, 0], [2, 3]].forEach(([i, j]) => line(P(C[i][0], C[i][1], 0), P(Cm[j][0], Cm[j][1], 0))); ctx.setLineDash([]);
  }
  const base = 0.015 * M * cam.s, se = Math.max(0.25, Math.sin(cam.elev)), c = Math.cos(cam.phi), s = Math.sin(cam.phi);
  z.pts.filter(p => p.y <= cur).sort((p, q) => ((p.X - cam.x) * s + (p.Y - cam.y) * c) - ((q.X - cam.x) * s + (q.Y - cam.y) * c))
    .forEach(p => {
      const [x, y] = P(p.X, p.Y, z.zz(p.y)), now = p.y === cur, r = Math.max(INSET ? 1.2 : 0, base * (0.6 + 1.6 * Math.sqrt(p.s))) * (now ? grow : 1);
      if (r <= 0) return;
      ctx.fillStyle = `rgba(${FLARE},${now ? 1 : 0.28})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * se, 0, 0, 7); ctx.fill();
    });
  const q = Cm.map(([X, Y]) => P(X, Y, z.zz(cur)));
  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ring(q);
  const r = q.reduce((m, p) => (p[0] > m[0] ? p : m));
  if (INSET || r[0] - Math.min(...q.map(p => p[0])) < 120) return;
  label(cur, r[0] + 14, r[1] + 6, 18);
  if (z.vol[cur]) label(z.vol[cur].toFixed(2) + ' billion m³ gas flared', r[0] + 14, r[1] + 24, 12, '#aaa');
}

// ---- the insets in the story box ----
// one inset, full width: Al Atayah in plan, Zelten in plan oblique
let INSET = false, topKey = null;
const ICAP = { ang: 'Plan oblique: the plan, each year lifted a little above the one before', top: 'Plan: year of change, dark early, bright late' };
function showInset(v) {
  ui('ang').hidden = v !== 'ang'; ui('top').hidden = v !== 'top'; ui('icap').textContent = ICAP[v];
  sizeInsets(); topKey = null;
}
function sizeInsets() {
  const w = ui('insets').getBoundingClientRect().width || 372;
  for (const [id, h] of [['ang', w * 0.8], ['top', w * S.ataya.h / S.ataya.w]]) {
    const c = ui(id); c.style.height = h + 'px'; c.width = Math.round(w * DPR); c.height = Math.round(h * DPR);
  }
}
// where the points are, with a margin: the turned inset frames this, not the whole block
const EXT = {};
function extent(L) {
  if (EXT[L]) return EXT[L];
  const xs = L === 'ataya' ? S.ataya.X : S.zelten.pts.map(p => p.X), ys = L === 'ataya' ? S.ataya.Y : S.zelten.pts.map(p => p.Y);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < xs.length; i++) { x0 = Math.min(x0, xs[i]); x1 = Math.max(x1, xs[i]); y0 = Math.min(y0, ys[i]); y1 = Math.max(y1, ys[i]); }
  const m = 0.08 * Math.max(x1 - x0, y1 - y0, 1);
  return (EXT[L] = [[x0 - m, y0 - m], [x1 + m, y0 - m], [x1 + m, y1 + m], [x0 - m, y1 + m]]);
}
function drawInsets(L) {
  const cur = T[L];
  if (!ui('top').hidden) { if (topKey !== cur) drawTop(cur); return; }
  // the block from another angle: draw it with the same code, on the small canvas, with its own camera
  const keep = { ctx, cam, cw, ch, ox }, c = ui('ang');
  ctx = c.getContext('2d'); cw = c.width / DPR; ch = c.height / DPR; ox = cw / 2; INSET = true;
  const top = (L === 'ataya' ? blockA() : blockZ())[1];
  cam = fit(extent(L).flatMap(([X, Y]) => [[X, Y, 0], [X, Y, top]]), ...ANG[L], 0.95, 0);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cw, ch);
  L === 'ataya' ? drawAtaya(cur) : drawZelten(cur);
  ({ ctx, cam, cw, ch, ox } = keep); INSET = false;
}
// Al Atayah in plan: each changed cell in the year it changed, dark early and bright late, with the coastline
function drawTop(cur) {
  topKey = cur;
  const a = S.ataya, c = ui('top'), g = c.getContext('2d'), W = c.width, H = c.height, n = a.dates.length;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  if (COAST) {
    const [w, s, e, nn] = a.box, x0 = wx(w), y0 = wy(nn), kx = W / (wx(e) - x0), ky = H / (wy(s) - y0);
    g.beginPath();
    for (const r of COAST) { for (let i = 0; i < r.length; i += 2) g[i ? 'lineTo' : 'moveTo']((r[i] - x0) * kx, (r[i + 1] - y0) * ky); g.closePath(); }
    g.strokeStyle = COASTC; g.lineWidth = DPR; g.stroke();
  }
  const sx = W / a.w, sy = H / a.h, ev = a.events;
  for (let i = 0; i < ev.length; i += 4) {
    const k = ev[i + 2]; if (k > cur) continue;
    const t = 0.35 + 0.65 * k / (n - 1), col = ev[i + 3] > 0 ? [176, 84, 52] : [236, 222, 190];
    g.fillStyle = `rgb(${col[0] * t | 0},${col[1] * t | 0},${col[2] * t | 0})`;
    g.fillRect(ev[i] * sx, ev[i + 1] * sy, Math.ceil(sx), Math.ceil(sy));
  }
}

// ---- the film: a Vimeo player over the map, only while its step is open ----
function film(url) {
  const box = ui('film'), fr = ui('vimeo');
  box.hidden = !url;
  if (!url) { if (fr.src !== 'about:blank') fr.src = 'about:blank'; return; }     // leaving the step stops the film
  if (url.includes('VIDEO_ID')) { fr.hidden = true; ui('film-note').hidden = false; return; }
  fr.hidden = false; ui('film-note').hidden = true;
  const src = url + (url.includes('?') ? '&' : '?') + 'title=0&byline=0&portrait=0&dnt=1';
  if (fr.src !== src) fr.src = src;
}

// ---- the archive: media/media.json, one list per step name ----
let MEDIA = {}, mi = 0;
fetch('media/media.json').then(r => (r.ok ? r.json() : {})).then(m => { MEDIA = m; if (S) showMedia(); }).catch(() => {});
function showMedia() {
  const list = MEDIA[STEPS[step].name] || [];
  ui('media').hidden = !list.length; if (!list.length) return;
  mi = (mi + list.length) % list.length;
  const m = list[mi];
  ui('mcount').textContent = `${mi + 1} of ${list.length}`;
  ui('mbody').innerHTML = (m.src ? `<img src="${m.src}" alt="${m.alt || ''}">` : '') +
    (m.headline ? `<p class="hl">${m.headline}</p>` : '') + (m.caption ? `<p>${m.caption}</p>` : '') +
    `<p class="cr">${[m.credit, m.date, m.licence].filter(Boolean).join(' · ')}${m.link ? ` · <a href="${m.link}" target="_blank" rel="noopener">source</a>` : ''}</p>`;
}
ui('mprev').onclick = () => { mi--; showMedia(); };
ui('mnext').onclick = () => { mi++; showMedia(); };

// ---- input ----
function resize() {
  const r = cv.getBoundingClientRect(); cw = r.width; ch = r.height; ox = (cw - (cw > 900 ? 420 : 0)) / 2;
  cv.width = Math.round(cw * DPR); cv.height = Math.round(ch * DPR);
}
window.addEventListener('resize', () => { resize(); if (S) { cam = view(STEPS[step].view); if (!ui('insets').hidden) { sizeInsets(); topKey = null; } } });
let drag = null;
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  flight = null; drag = { x: e.clientX, y: e.clientY, cam: { ...cam }, move: e.shiftKey || e.button === 2 };
  cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing';
});
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y, c0 = drag.cam;
  if (drag.move) {                               // move the ground under the pointer
    const u = -dx / c0.s, v = -dy / (c0.s * Math.max(0.2, Math.sin(c0.elev))), c = Math.cos(c0.phi), s = Math.sin(c0.phi);
    cam.x = c0.x + u * c + v * s; cam.y = c0.y - u * s + v * c;
  } else { cam.phi = c0.phi - dx * 0.006; cam.elev = Math.min(1.55, Math.max(0.15, c0.elev + dy * 0.005)); }
});
cv.addEventListener('pointerup', () => { drag = null; cv.style.cursor = 'grab'; });
// zoom towards the pointer: keep the ground point under it in place
function ground(sx, sy) {
  const c = Math.cos(cam.phi), s = Math.sin(cam.phi), rx = (sx - ox) / cam.s;
  const ry = ((sy - ch / 2) / cam.s - cam.cz * Math.cos(cam.elev)) / Math.max(0.2, Math.sin(cam.elev));
  return [cam.x + rx * c + ry * s, cam.y - rx * s + ry * c];
}
cv.addEventListener('wheel', e => {
  e.preventDefault(); flight = null;
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, a = ground(x, y);
  cam.s = Math.min(600, Math.max(0.2, cam.s * Math.exp(-e.deltaY * 0.0015)));
  const b = ground(x, y); cam.x += a[0] - b[0]; cam.y += a[1] - b[1];
}, { passive: false });
cv.addEventListener('dblclick', () => flyTo(view(STEPS[step].view), 1200));
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' && e.key !== ' ') return;
  if (e.key === 'ArrowRight' || e.key === '.') go(step + 1);
  if (e.key === 'ArrowLeft' || e.key === ',') go(step - 1);
  if (e.key === ' ' && STEPS[step].layer) { e.preventDefault(); ui('play').click(); }
});
