"""Makes the web data for sketch 12 from the working folders.

Run from the folder that holds the working files:
    python prep.py /path/to/weather-commons/sketches/12-minerva-red
Writes data/ inside the sketch: scene.json, base.png, ataya/, zelten/, storm/.
Needs: numpy, pillow
"""
import csv, glob, json, os, sys
import numpy as np
from PIL import Image

OUT = os.path.join(sys.argv[1], 'data')
ATAYA, NDVI, ZELTEN, STORM, BASE = 'al_ataya_selected_clean', 'ndvi', 'zelten', 'cams_frames', 'base.png'
FLARES, VIIRS = 'zelten_flares_block.csv', 'zelten_viirs.csv'

REGION = [11, 28, 27, 36.5]                        # west, south, east, north (storm frames, base map)
ATAYA_BOX = [13.4769, 32.5813, 13.8454, 32.8588]
ZELTEN_BOX = [19.59, 28.78, 19.96, 29.06]
FLARE_BOX = [19.7633, 28.904, 19.7837, 28.922]
NDVI_MIN, NDVI_MAX, W = -0.1, 0.7, 480             # as in build_cube.py
THR, WIN, NB = 0.10, 3, 5                          # locked change settings
PIC_W, STORM_W = 1200, 800                         # web widths in px

for d in ('ataya', 'zelten', 'storm'):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)


def jpg(src, dst, w=PIC_W):
    im = Image.open(src).convert('RGB')
    if im.width > w:
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, dst), quality=82)


# --- Al Atayah: NDVI change points (same rules as the cube) ---
yms, grids = [], []
for path in sorted(glob.glob(os.path.join(NDVI, '[0-9]*.png'))):
    a = np.asarray(Image.open(path).convert('L')).astype(float)
    h = round(a.shape[0] * W / a.shape[1])
    ys, xs = np.linspace(0, a.shape[0], h + 1).astype(int), np.linspace(0, a.shape[1], W + 1).astype(int)
    rs = lambda m: np.add.reduceat(np.add.reduceat(m, ys[:-1], 0), xs[:-1], 1)
    s, c = rs(np.where(a > 0, a, 0)), rs((a > 0).astype(float))
    n = np.outer(np.diff(ys), np.diff(xs))
    b = np.where((c > 0) & (c >= n / 2), np.round(s / np.maximum(c, 1)), 0)
    grids.append(np.where(b > 0, NDVI_MIN + (b - 1) / 254 * (NDVI_MAX - NDVI_MIN), np.nan))
    yms.append(os.path.basename(path)[:7])
val = np.array(grids)                               # years x h x w
n, H = len(val), val.shape[1]


def umed(st):                                       # upper median of valid values, like the cube's med()
    srt, cnt = np.sort(st, 0), np.sum(~np.isnan(st), 0)
    out = np.take_along_axis(srt, (cnt // 2)[None], 0)[0]
    return np.where(cnt > 0, out, np.nan)


sea = umed(val) < 0
best = {1: [np.zeros((H, W)), np.full((H, W), -1), np.full((H, W), -1)],
        -1: [np.zeros((H, W)), np.full((H, W), -1), np.full((H, W), -1)]}
for k in range(WIN, n - WIN + 1):
    d = umed(val[k:k + WIN]) - umed(val[k - WIN:k])
    for sgn, (bd, kd, kd2) in best.items():
        v = np.nan_to_num(sgn * d, nan=-9)
        up = v > bd + 1e-6
        tie = ~up & (np.abs(v - bd) <= 1e-6) & (kd2 == k - 1)
        bd[up], kd[up], kd2[up], kd2[tie] = v[up], k, k, k
events = []
for sgn, (bd, kd, kd2) in best.items():
    r = np.where((bd > THR) & ~sea, np.floor((kd + kd2) / 2 + 0.5), -1).astype(int)
    p = np.pad(r, 1, constant_values=-1)
    cnt = sum(((q := p[1 + dy:1 + dy + H, 1 + dx:1 + dx + W]) >= 0) & (np.abs(q - r) <= 2)
              for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx)
    keep = (r >= 0) & (cnt >= NB)
    keep[0], keep[-1], keep[:, 0], keep[:, -1] = False, False, False, False
    for y, x in zip(*np.nonzero(keep)):
        events += [int(x), int(y), int(r[y, x]), sgn]
print('Al Atayah:', n, 'years,', len(events) // 4, 'change points')

# ground pictures: the one for each NDVI month, else the nearest earlier one
have = sorted(os.path.basename(p)[:7] for p in glob.glob(os.path.join(ATAYA, '[0-9]*.png')))
ataya = []
for ym in yms:
    src = max((h for h in have if h <= ym), default=have[0] if have else None)
    if src and not os.path.exists(os.path.join(OUT, 'ataya', src + '.jpg')):
        jpg(os.path.join(ATAYA, src + '.png'), f'ataya/{src}.jpg')
    ataya.append(src)

# --- Zelten ---
zelten = []
for p in sorted(glob.glob(os.path.join(ZELTEN, '[0-9]*.png'))):
    d = os.path.basename(p)[:10]
    jpg(p, f'zelten/{d}.jpg')
    zelten.append(d)
flares = [[int(r['year']), float(r['lon']), float(r['lat']), float(r['share'])]
          for r in csv.DictReader(open(FLARES))]
vol = {r['year']: float(r['volume_bcm']) for r in csv.DictReader(open(VIIRS))}
print('Zelten:', len(zelten), 'pictures,', len(flares), 'flare points')

# --- storm ---
storm = []
for p in sorted(glob.glob(os.path.join(STORM, '*.png'))):
    t = os.path.basename(p)[:13]
    im = Image.open(p).convert('RGBA')
    im.resize((STORM_W, round(im.height * STORM_W / im.width)), Image.LANCZOS).save(
        os.path.join(OUT, 'storm', t + '.png'), optimize=True)
    storm.append(t)
print('storm:', len(storm), 'frames')

# --- base map: land, sea and coastline from base.png (grey land, dark sea) ---
land = np.asarray(Image.open(BASE).convert('L')) > 45
edge = land & ~(np.roll(land, 1, 0) & np.roll(land, -1, 0) & np.roll(land, 1, 1) & np.roll(land, -1, 1))
rgb = np.where(land[..., None], [24, 24, 24], [11, 12, 15])
rgb[edge] = [120, 120, 120]
Image.fromarray(rgb.astype(np.uint8)).save(os.path.join(OUT, 'base.png'), optimize=True)

json.dump({'region': REGION,
           'ataya': {'box': ATAYA_BOX, 'w': W, 'h': H, 'dates': yms, 'pics': ataya, 'events': events},
           'zelten': {'box': ZELTEN_BOX, 'flareBox': FLARE_BOX, 'pics': zelten, 'flares': flares, 'vol': vol},
           'storm': {'box': REGION, 'frames': storm}},
          open(os.path.join(OUT, 'scene.json'), 'w'), separators=(',', ':'))

mb = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(OUT) for f in fs) / 1e6
print(f'saved {OUT}  ({mb:.1f} MB)')
