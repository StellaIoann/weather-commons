"""Coastline as vector outlines for sketch 12, from the detailed US State Department borders (LSIB 2017).

Run:  python coast.py /path/to/weather-commons/sketches/12-minerva-red
Writes data/coast.json: a list of rings, each a list of [lon, lat].
"""
import ee, json, os, sys

ee.Initialize(project='libya-weather-commons')
AREA = ee.Geometry.Rectangle([9, 26, 29, 38.5])     # wider than the map, so the cut edges fall outside it
SIMPLIFY = 100                                       # metres

land = (ee.FeatureCollection('USDOS/LSIB/2017').filterBounds(AREA)
        .union(50).geometry().intersection(AREA, 50).simplify(SIMPLIFY))
rings = []


def walk(g):
    t, c = g['type'], g.get('coordinates')
    if t == 'Polygon':
        rings.extend(c)
    elif t == 'MultiPolygon':
        for p in c:
            rings.extend(p)
    elif t == 'GeometryCollection':
        for x in g['geometries']:
            walk(x)


walk(land.getInfo())
rings = [[[round(x, 4), round(y, 4)] for x, y in r] for r in rings if len(r) >= 4]
out = os.path.join(sys.argv[1], 'data', 'coast.json')
json.dump(rings, open(out, 'w'), separators=(',', ':'))
print(len(rings), 'rings,', sum(map(len, rings)), 'points,', f'{os.path.getsize(out) / 1e6:.1f} MB')
