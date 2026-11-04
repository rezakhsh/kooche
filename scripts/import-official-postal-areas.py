"""Postal code areas from official open files, for the countries where OpenStreetMap has few or none
(docs/setup.md, "The street map"; postal codes step 5, docs/progress.md). Writes
seed/postal-areas/<cc>.json in the same form as scripts/import-postal-areas.mjs (OpenStreetMap):

    { "90210": [["<outer ring>", "<hole>", ...], ...], ... }

one entry per postal code, each polygon a list of rings in Google's polyline encoding at 5 decimals,
longitude first. Only codes in seed/postal/<cc>.tsv are kept (their stored form, as
src/modules/listings/postal-code.ts reads them); a code without an area gets a circle on the map.

Sources (licences in seed/README.md):
  US  Census Bureau, 2020 ZCTA cartographic boundary file 1:500,000 (public domain)
  CA  Statistics Canada, 2021 Census forward sortation areas, cartographic file, from StatCan's own
      map service in WGS 84 (Open Government Licence - Canada; the download page blocks servers)
  NL  CBS, postcode4 (PC4), newest year, from PDOK's OGC API in WGS 84 (CC BY 4.0)
  AU  Australian Bureau of Statistics, ASGS Edition 3 postal areas 2021, GDA2020 (CC BY 4.0)

Only Python's own modules, no GDAL. Downloads are untrusted: give each country its own new, empty
folder, keep this script elsewhere, and run Python with -I:

    python3 -I scripts/import-official-postal-areas.py fetch US /data/work/us
    python3 -I scripts/import-official-postal-areas.py build US /data/work/us seed/postal/us.tsv seed/postal-areas/us.json

Simplifying: Douglas-Peucker as for OpenStreetMap's areas (0.0002 degrees, about 15-20 m), or more
for a big area: REL times the square root of its size. The map zooms until an area fills about a
quarter of it, so a big rural area looks the same on screen with far fewer points.
"""

import io
import json
import math
import os
import struct
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

AGENT = 'peydoo-postal-import/1.0 (+https://peydoo.com)'
BASE = 0.0002
REL = 0.004

SOURCES = {
    'US': {'zip': 'https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip', 'field': 'ZCTA5CE20'},
    'AU': {
        'zip': 'https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/digital-boundary-files/POA_2021_AUST_GDA2020_SHP.zip',
        'field': 'POA_CODE21',
    },
    'NL': {'pages': 'pdok', 'field': 'postcode', 'year': 2024},
    'CA': {'pages': 'statcan', 'field': 'CFSAUID'},
}


def get(url, path, tries=5):
    req = urllib.request.Request(url, headers={'User-Agent': AGENT})
    for attempt in range(1, tries + 1):
        try:
            with urllib.request.urlopen(req, timeout=300) as r, open(path, 'wb') as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
            return
        except Exception as e:  # network trouble: wait and try again
            if os.path.exists(path):
                os.remove(path)
            if attempt == tries:
                raise
            print(f'{url}: {e}, waiting', file=sys.stderr)
            time.sleep(15 * attempt)


def statcan(folder, offset, size, generalize=None):
    """One page of StatCan's FSA layer; the number of areas in it (0 past the end)"""
    base = 'https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Cartographic_boundary_files/MapServer/14/query'
    params = {'where': '1=1', 'outFields': 'CFSAUID', 'orderByFields': 'OBJECTID', 'outSR': 4326, 'geometryPrecision': 6,
              'resultOffset': offset, 'resultRecordCount': size, 'f': 'geojson'}
    if generalize:
        params['maxAllowableOffset'] = generalize
    path = os.path.join(folder, f'page-{offset:05d}-{size:02d}.json')
    get(f'{base}?{urllib.parse.urlencode(params)}', path, tries=2)
    time.sleep(1)
    with open(path, encoding='utf-8') as f:
        n = len(json.load(f).get('features') or [])
    if n == 0:
        os.remove(path)
    return n


def fetch(cc, folder):
    src = SOURCES[cc]
    if 'zip' in src:
        get(src['zip'], os.path.join(folder, 'source.zip'))
    elif src['pages'] == 'pdok':
        crs = 'http://www.opengis.net/def/crs/OGC/1.3/CRS84'
        url = f"https://api.pdok.nl/cbs/postcode4/ogc/v1/collections/postcode4/items?f=json&limit=500&jaarcode={src['year']}&crs={urllib.parse.quote(crs, safe='')}"
        n = 0
        while url:
            n += 1
            path = os.path.join(folder, f'page-{n:04d}.json')
            get(url, path)
            with open(path, encoding='utf-8') as f:
                links = json.load(f).get('links', [])
            nxt = [l['href'] for l in links if l.get('rel') == 'next']
            url = nxt[0] if nxt and urllib.parse.urlparse(nxt[0]).hostname == 'api.pdok.nl' else None
            time.sleep(1)
    elif src['pages'] == 'statcan':
        # The northern areas (thousands of islands) are too big for a page of 25: one by one, and if
        # one still fails, generalized by StatCan to 0.0001 degrees (about 10 m, finer than ours)
        step = 25
        offset = 0
        while True:
            try:
                n = statcan(folder, offset, step)
            except urllib.error.HTTPError:
                n = 0
                for o in range(offset, offset + step):
                    try:
                        k = statcan(folder, o, 1)
                    except urllib.error.HTTPError:
                        print(f'area {o}: generalized by StatCan', file=sys.stderr)
                        k = statcan(folder, o, 1, generalize=0.0001)
                    n += k
                    if k == 0:
                        break
            if n < step:
                break
            offset += step
    print(f'{cc}: fetched into {folder}')


# ---- readers: each yields (code, [ring, ...]) with rings as lists of (lon, lat)


def read_dbf(data):
    count, header_len, record_len = struct.unpack('<xxxxIHH', data[:12])
    fields = []
    pos = 32
    while data[pos] != 0x0D:
        name = data[pos:pos + 11].split(b'\0')[0].decode('ascii')
        fields.append((name, data[pos + 16]))
        pos += 32
    for i in range(count):
        rec = data[header_len + i * record_len:header_len + (i + 1) * record_len]
        out = {}
        p = 1
        for name, length in fields:
            out[name] = rec[p:p + length].decode('utf-8', 'replace').strip()
            p += length
        yield out


def read_shp(data):
    pos = 100
    while pos < len(data):
        _, length = struct.unpack('>ii', data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + length * 2]
        pos += 8 + length * 2
        kind = struct.unpack('<i', body[:4])[0]
        if kind == 0:
            yield []
            continue
        if kind not in (5, 15, 25):
            raise ValueError(f'shape type {kind} is no polygon')
        parts_n, points_n = struct.unpack('<ii', body[36:44])
        parts = list(struct.unpack(f'<{parts_n}i', body[44:44 + 4 * parts_n])) + [points_n]
        xy = struct.unpack(f'<{2 * points_n}d', body[44 + 4 * parts_n:44 + 4 * parts_n + 16 * points_n])
        yield [[(xy[2 * j], xy[2 * j + 1]) for j in range(parts[k], parts[k + 1])] for k in range(parts_n)]


def read_zip(folder, field):
    with zipfile.ZipFile(os.path.join(folder, 'source.zip')) as z:
        names = z.namelist()
        shp = [n for n in names if n.lower().endswith('.shp')]
        if len(shp) != 1:
            raise ValueError(f'expected one .shp, found {shp}')
        stem = shp[0][:-4]
        dbf = next(n for n in names if n.lower() == (stem + '.dbf').lower())
        prj = next((n for n in names if n.lower() == (stem + '.prj').lower()), None)
        if prj:
            print('projection:', z.read(prj).decode('ascii', 'replace')[:90])
        shapes = read_shp(z.read(shp[0]))
        for rec, rings in zip(read_dbf(z.read(dbf)), shapes):
            yield rec[field], rings


def read_pages(folder, field):
    for name in sorted(os.listdir(folder)):
        if not name.startswith('page-'):
            continue
        with open(os.path.join(folder, name), encoding='utf-8') as f:
            for feat in json.load(f)['features']:
                g = feat.get('geometry')
                if not g:
                    continue
                polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates'] if g['type'] == 'MultiPolygon' else []
                yield str(feat['properties'][field]), [[(float(p[0]), float(p[1])) for p in ring] for poly in polys for ring in poly]


# ---- geometry, the same as scripts/simplify-geometry.mjs


def rnd(n):
    return math.floor(n * 1e5 + 0.5) / 1e5


def seg_dist(p, a, b):
    x, y = p
    x1, y1 = a
    dx, dy = b[0] - x1, b[1] - y1
    ln = dx * dx + dy * dy
    t = 0 if ln == 0 else max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / ln))
    return math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))


def simplify(points, tol):
    if len(points) < 3:
        return points
    keep = bytearray(len(points))
    keep[0] = keep[-1] = 1
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        a, b = points[first], points[last]
        mx, index = 0, 0
        for i in range(first + 1, last):
            d = seg_dist(points[i], a, b)
            if d > mx:
                mx, index = d, i
        if mx > tol:
            keep[index] = 1
            stack.append((first, index))
            stack.append((index, last))
    return [p for p, k in zip(points, keep) if k]


def simplify_ring(ring, tol):
    """A closed ring, simplified; split at its farthest point. None when it collapses."""
    if ring[0] != ring[-1]:
        ring = ring + [ring[0]]
    opn = ring[:-1]
    if len(opn) < 3:
        return None
    x0, y0 = opn[0]
    far, mx = 0, -1
    for i in range(1, len(opn)):
        d = math.hypot(opn[i][0] - x0, opn[i][1] - y0)
        if d > mx:
            mx, far = d, i
    first = simplify(opn[:far + 1], tol)
    second = simplify(opn[far:] + [opn[0]], tol)
    out = [(rnd(x), rnd(y)) for x, y in first[:-1] + second[:-1]]
    uniq = [p for i, p in enumerate(out) if i == 0 or p != out[i - 1]]
    if len(uniq) > 1 and uniq[-1] == uniq[0]:
        uniq.pop()
    return uniq + [uniq[0]] if len(uniq) >= 3 else None


def area(ring):
    s = 0.0
    for i in range(len(ring) - 1):
        s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return s / 2


def inside(pt, ring):
    x, y = pt
    hit = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            hit = not hit
        j = i
    return hit


def bbox(ring):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return min(xs), min(ys), max(xs), max(ys)


def polygons(rings):
    """Rings of any order and winding into [outer, hole, ...] lists: a ring inside an odd number of bigger rings is a hole"""
    rings = sorted(rings, key=lambda r: -abs(area(r)))
    boxes = [bbox(r) for r in rings]
    out = []
    owner = {}
    for i, r in enumerate(rings):
        x, y = r[0]
        around = [j for j in range(i) if boxes[j][0] <= x <= boxes[j][2] and boxes[j][1] <= y <= boxes[j][3] and inside((x, y), rings[j])]
        if len(around) % 2 == 0:
            owner[i] = len(out)
            out.append([r])
        else:
            outer = max((j for j in around if j in owner), default=None, key=lambda j: j)
            if outer is not None:
                out[owner[outer]].append(r)
    return out


def encode(ring):
    out = []
    px = py = 0

    def num(v):
        n = ~(v << 1) if v < 0 else v << 1
        while n >= 0x20:
            out.append(chr((0x20 | (n & 0x1F)) + 63))
            n >>= 5
        out.append(chr(n + 63))

    for x, y in ring:
        ix, iy = math.floor(x * 1e5 + 0.5), math.floor(y * 1e5 + 0.5)
        num(ix - px)
        num(iy - py)
        px, py = ix, iy
    return ''.join(out)


def build(cc, folder, tsv, out_file):
    src = SOURCES[cc]
    centres = {}
    with open(tsv, encoding='utf-8') as f:
        for line in f:
            if line.strip():
                code, _, lat, lng = line.rstrip('\n').split('\t')[:4]
                centres.setdefault(code, []).append((float(lng), float(lat)))
    features = read_zip(folder, src['field']) if 'zip' in src else read_pages(folder, src['field'])
    areas = {}
    unknown = []
    far = []
    raw_points = 0
    for code, rings in features:
        code = code.strip().upper()
        if cc in ('AU', 'NL') and code.isdigit():
            code = code.zfill(4)
        rings = [r for r in rings if len(r) >= 3]
        if not rings:
            continue
        if code not in centres:
            unknown.append(code)
            continue
        raw_points += sum(len(r) for r in rings)
        size = math.sqrt(sum(abs(area(r if r[0] == r[-1] else r + [r[0]])) for r in rings))
        tol = max(BASE, REL * size)
        simple = [s for s in (simplify_ring(r, tol) for r in rings) if s]
        polys = polygons(simple)
        if not polys:
            continue
        # A sanity check, not a filter (official codes are the country's own): one of the code's places within ~25 km
        x0, y0, x1, y1 = bbox([p for poly in polys for p in poly[0]])
        if not any(x0 - 0.3 <= x <= x1 + 0.3 and y0 - 0.3 <= y <= y1 + 0.3 for x, y in centres[code]):
            far.append(code)
        areas.setdefault(code, []).extend(polys)
    codes = sorted(areas)
    points = sum(len(r) for c in codes for p in areas[c] for r in p)
    with open(out_file, 'w', encoding='utf-8') as f:
        f.write('{\n' + ',\n'.join(f'{json.dumps(c)}:{json.dumps([[encode(r) for r in p] for p in areas[c]])}' for c in codes) + '\n}\n')
    missing = sorted(set(centres) - set(areas))
    print(f'{cc}: {len(codes)} of {len(centres)} postal codes with an area, {len(missing)} without; '
          f'{raw_points} points in, {points} out; {os.path.getsize(out_file)} bytes -> {out_file}')
    print(f'  source codes not in our list (left out): {len(unknown)} {sorted(set(unknown))[:20]}')
    print(f'  areas far from all their places (kept): {len(far)} {far[:20]}')
    print(f'  without an area, first ones: {missing[:30]}')


if __name__ == '__main__':
    if len(sys.argv) < 4 or sys.argv[1] not in ('fetch', 'build') or sys.argv[2] not in SOURCES:
        sys.exit(f'usage: fetch <{"|".join(SOURCES)}> <folder> | build <CC> <folder> <postal tsv> <out json>')
    if sys.argv[1] == 'fetch':
        fetch(sys.argv[2], sys.argv[3])
    else:
        build(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
