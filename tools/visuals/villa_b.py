# Villa B: a modern Riviera villa (stone, glass, cantilevered white roofs, teak soffits), lawn, umbrella pines.
# usage: python villa_b.py <shot> <width> <height> <samples> <out.png> [light]
import os, sys, math, random, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector, noise
import vlib as V

SHOT, W, H, SPP, OUT = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
LIGHT = sys.argv[6] if len(sys.argv) > 6 else 'golden'
SEA_Z = -14.0

V.reset()
V.render_setup(W, H, SPP, {'golden': -2.0, 'blue': -0.2, 'sunset': -1.5}[LIGHT])
if LIGHT == 'golden':
    V.sky(9, 62, 1.0, aerosol=2.0); interior = 0.5; pool_glow = 0.0
elif LIGHT == 'sunset':
    V.sky(2.0, 50, 1.0, aerosol=3.0); interior = 1.3; pool_glow = 0.1
else:
    V.sky(-3.0, 55, 1.0, aerosol=2.0, sun_disc=False); interior = 3.0; pool_glow = 0.3

M = {
    'white': V.plaster('white', (0.86, 0.85, 0.82), bump=0.03),
    'plaster_in': V.plaster('plaster_in', (0.8, 0.76, 0.7), bump=0.02),
    'stone': V.stone('stoneb', (0.42, 0.38, 0.33), 1.4, (0.5, 0.47, 0.42)),
    'teak': V.wood('teakb', (0.34, 0.2, 0.1), 3.0, 0.5),
    'deck': V.wood('deck', (0.4, 0.27, 0.16), 6.0, 0.6, (1, 30, 1)),
    'oak': V.wood('oakb', (0.45, 0.31, 0.18), 2.0, 0.45),
    'glass': V.glass('glassb', (0.88, 0.92, 0.93)),
    'water': V.water('waterb', (0.7, 0.9, 0.9)),
    'tiles': V.tiles('tilesb', (0.36, 0.52, 0.56), glow=pool_glow),
    'coping': V.paving('copingb', (0.78, 0.75, 0.7), 1.0, 0.45),
    'sea': V.sea('seab'),
    'grass': V.grass('grassb', (0.07, 0.12, 0.035)),
    'terrain': V.terrain_mat('terrainb', (0.3, 0.27, 0.2), (0.25, 0.25, 0.13), (0.06, 0.08, 0.03)),
    'hedge': V.foliage('hedge', (0.035, 0.07, 0.025), 0.3, 6.0),
    'pine': V.foliage('pine', (0.05, 0.08, 0.035), 0.35, 2.5),
    'bark': V.plain('barkb', (0.16, 0.11, 0.08), 0.9),
    'bronze': V.plain('bronzeb', (0.05, 0.045, 0.04), 0.35, 1.0),
    'linen': V.plain('linenb', (0.8, 0.77, 0.7), 0.9, sheen=0.5),
    'charcoal': V.plain('charcoal', (0.07, 0.07, 0.075), 0.85, sheen=0.3),
    'warm': V.emission('warmb', (1.0, 0.74, 0.48), 4.0 * interior),
    'lamp': V.emission('lampb', (1.0, 0.7, 0.42), 3.0 * interior),
    'poollamp': V.emission('poollampb', (0.75, 0.95, 1.0), 90.0 * max(pool_glow, 0.05)),
    'island': V.plain('islandb', (0.2, 0.22, 0.26), 0.95),
    'gravel': V.gravel('gravelb', (0.66, 0.64, 0.6)),
    'lavender': V.foliage('lavb', (0.26, 0.2, 0.36), 0.35, 6.0),
    'olive': V.foliage('oliveb', (0.16, 0.18, 0.11), 0.4, 3.0),
}

# ------------------------------------------------------------------ ground: lawn on a gentle slope to the sea
def h(x, y):
    nat = -0.4 - max(0.0, y - 34) * 0.16 - max(0.0, y - 70) * 0.25
    nat += noise.fractal(Vector((x * 0.03, y * 0.03, 1.7)), 0.6, 2.0, 4) * (0.15 if y < 40 else 1.6)
    if y < -14:
        nat = -0.4 + (-14 - y) * 0.12 + noise.fractal(Vector((x * 0.03, y * 0.03, 4.1)), 0.6, 2.0, 4) * 1.5
    return nat
V.grid_terrain('ground', -220, 220, -120, 150, 220, 135, h, M['terrain'])
V.box('lawn', -44, 44, 11.0, 36, -0.4, -0.02, M['grass'])
V.mesh_obj('sea', [(-30000, 90, SEA_Z), (30000, 90, SEA_Z), (30000, 40000, SEA_Z), (-30000, 40000, SEA_Z)], [(0, 1, 2, 3)], M['sea'])
for k, (ix, iy, r, hh) in enumerate([(-6000, 11000, 3000, 420), (4200, 14000, 4600, 600), (9000, 9000, 1500, 220)]):
    V.blob(f'isl{k}', (ix, iy, SEA_Z - hh * 0.25), 1.0, (r, r * 0.5, hh), M['island'], k + 9, 3, 0.35, 1.3)

# ------------------------------------------------------------------ house
V.box('plinth', -20, 20, -11, 0, -0.4, 0.0, M['coping'])
V.box('deck', -16, 16, 0, 6.1, -0.4, 0.0, M['deck'])

def glass_wall(name, x0, x1, y, z0, z1, n=None):
    n = n or max(2, int(round((x1 - x0) / 2.4)))
    for j in range(n):
        a = x0 + (x1 - x0) * j / n
        b = x0 + (x1 - x0) * (j + 1) / n
        V.box(f'{name}g{j}', a + 0.02, b - 0.02, y - 0.012, y + 0.012, z0 + 0.03, z1 - 0.03, M['glass'])
        V.box(f'{name}m{j}', b - 0.03, b + 0.03, y - 0.04, y + 0.04, z0, z1, M['bronze'])
    V.box(name + 'b', x0, x1, y - 0.04, y + 0.04, z0, z0 + 0.04, M['bronze'])
    V.box(name + 't', x0, x1, y - 0.04, y + 0.04, z1 - 0.04, z1, M['bronze'])

# ground floor: stone end walls, full glazing between, white roof slab cantilevered over the deck
V.box('gf_wl', -16.5, -15.6, -9, 0.2, 0, 3.4, M['stone'], 0.02)
V.box('gf_wr', 15.6, 16.5, -9, 0.2, 0, 3.4, M['stone'], 0.02)
V.box('gf_back', -15.6, 15.6, -9, -8.6, 0, 3.4, M['stone'])
glass_wall('gf', -15.6, 15.6, -0.4, 0.0, 3.4, 12)
V.box('gf_roof', -18.5, 18.0, -10.0, 2.8, 3.4, 3.78, M['white'], 0.02)
V.box('gf_soffit', -18.4, 17.9, -0.3, 2.75, 3.37, 3.4, M['teak'])
V.box('gf_floor', -15.6, 15.6, -8.6, -0.4, 0.0, 0.03, M['oak'])
V.box('gf_ceil', -15.6, 15.6, -8.6, -0.4, 3.3, 3.37, M['plaster_in'])
V.box('gf_bw', -15.6, 15.6, -8.6, -8.55, 0, 3.3, M['plaster_in'])
V.box('gf_cove', -15.2, 15.2, -8.5, -8.4, 3.12, 3.2, M['warm'])
V.area_light('gf_al', (0, -4.5, 3.25), 26, 340 * interior, size_y=6)
# interior silhouettes
V.box('sofa1', -11, -6, -6.2, -5.2, 0, 0.42, M['linen'], 0.06)
V.box('sofa1b', -11, -6, -6.2, -5.85, 0.42, 0.82, M['linen'], 0.06)
V.box('ctab', -9.6, -7.4, -4.4, -3.4, 0, 0.34, M['coping'], 0.02)
V.box('dtab', 4, 8.4, -5.4, -4.2, 0.74, 0.78, M['oak'], 0.01)
for x in (5.0, 6.2, 7.4):
    V.blob(f'pd{x}', (x, -4.8, 2.3), 0.13, (1, 1, 0.7), M['lamp'], 3, 3, 0.0)
V.box('art', -3.5, -0.5, -8.52, -8.5, 1.1, 2.6, M['charcoal'])

# upper floor: glass pavilion set back, stone side walls, thin white roof
V.box('uf_wl', -7, -6.4, -8.4, -1.2, 3.78, 6.9, M['stone'], 0.02)
V.box('uf_wr', 10.4, 11.0, -8.4, -1.2, 3.78, 6.9, M['stone'], 0.02)
V.box('uf_back', -6.4, 10.4, -8.4, -8.0, 3.78, 6.9, M['stone'])
glass_wall('uf', -6.4, 10.4, -1.6, 3.78, 6.9, 7)
V.box('uf_roof', -8.0, 12.2, -9.2, 0.6, 6.9, 7.22, M['white'], 0.02)
V.box('uf_soffit', -7.9, 12.1, -1.4, 0.55, 6.87, 6.9, M['teak'])
V.box('uf_floor', -6.4, 10.4, -8.0, -1.6, 3.78, 3.8, M['oak'])
V.box('uf_ceil', -6.4, 10.4, -8.0, -1.6, 6.8, 6.87, M['plaster_in'])
V.box('uf_cove', -6.2, 10.2, -7.9, -7.8, 6.62, 6.7, M['warm'])
V.area_light('uf_al', (2, -4.8, 6.75), 14, 160 * interior, size_y=4)
V.box('bed', 4.0, 6.2, -7.9, -5.6, 3.8, 4.35, M['linen'], 0.08)
# glass balustrade on the roof terrace
V.box('bal', -18.3, 17.8, 2.62, 2.66, 3.78, 4.8, M['glass'])
# long stone garden wall
V.box('gwall', -34, -16.5, -2.6, -2.0, 0, 2.6, M['stone'], 0.02)

# ------------------------------------------------------------------ pool, deck furniture
PX0, PX1, PY0, PY1 = -12.5, 12.5, 6.6, 10.6
V.box('p_floor', PX0, PX1, PY0, PY1, -1.65, -1.5, M['tiles'])
V.box('p_wl', PX0 - 0.3, PX0, PY0, PY1, -1.65, -0.1, M['tiles'])
V.box('p_wr', PX1, PX1 + 0.3, PY0, PY1, -1.65, -0.1, M['tiles'])
V.box('p_wb', PX0, PX1, PY0 - 0.3, PY0, -1.65, -0.1, M['tiles'])
V.box('p_wf', PX0, PX1, PY1, PY1 + 0.3, -1.65, -0.1, M['tiles'])
V.box('cop_l', PX0 - 0.5, PX0 + 0.03, PY0 - 0.5, PY1 + 0.5, -0.1, 0.0, M['coping'], 0.01)
V.box('cop_r', PX1 - 0.03, PX1 + 0.5, PY0 - 0.5, PY1 + 0.5, -0.1, 0.0, M['coping'], 0.01)
V.box('cop_b', PX0 - 0.5, PX1 + 0.5, PY0 - 0.5, PY0 + 0.03, -0.1, 0.0, M['coping'], 0.01)
V.box('cop_f', PX0 - 0.5, PX1 + 0.5, PY1 - 0.03, PY1 + 0.5, -0.1, 0.0, M['coping'], 0.01)
V.box('p_water', PX0 - 0.02, PX1 + 0.02, PY0 - 0.02, PY1 + 0.02, -1.52, -0.12, M['water'])
# stone surround so no ground shows between deck, pool and lawn
V.box('sur_l', -20, PX0 - 0.5, 6.1, 11.8, -0.4, 0.0, M['coping'])
V.box('sur_r', PX1 + 0.5, 20, 6.1, 11.8, -0.4, 0.0, M['coping'])
V.box('sur_f', PX0 - 0.5, PX1 + 0.5, PY1 + 0.5, 11.8, -0.4, 0.0, M['coping'])
V.box('sur_sl', -20, -16, 0, 6.1, -0.4, 0.0, M['coping'])
V.box('sur_sr', 16, 20, 0, 6.1, -0.4, 0.0, M['coping'])
for i in range(6):
    x = PX0 + 2 + i * (PX1 - PX0 - 4) / 5
    V.box(f'pl{i}', x - 0.12, x + 0.12, PY0, PY0 + 0.02, -0.75, -0.55, M['poollamp'])
for i, x in enumerate((-9, -6.8, 6.8, 9.0)):
    V.box(f'lg{i}', x - 0.36, x + 0.36, 2.6, 4.6, 0.06, 0.28, M['teak'], 0.02)
    V.box(f'lgc{i}', x - 0.34, x + 0.34, 2.9, 4.58, 0.28, 0.38, M['linen'], 0.04)
    bk = V.box(f'lgb{i}', x - 0.34, x + 0.34, -0.05, 0.05, 0.0, 0.78, M['linen'], 0.04)
    bk.rotation_euler = (math.radians(40), 0, 0)
    bk.location = (0, 3.35, 0.36)
# outdoor sofa group on the deck
V.box('os1', -3.2, 3.2, 1.0, 1.9, 0.0, 0.4, M['charcoal'], 0.05)
V.box('os1b', -3.2, 3.2, 1.0, 1.3, 0.4, 0.78, M['charcoal'], 0.05)
V.box('ot', -1.0, 1.0, 2.6, 3.6, 0.0, 0.34, M['teak'], 0.02)

# ------------------------------------------------------------------ garden: hedges, pines, olives, gravel paths
V.box('hedge_l', -44, -40.8, 11, 36, -0.02, 1.3, M['hedge'], 0.25)
V.box('hedge_r', 40.8, 44, 11, 36, -0.02, 1.3, M['hedge'], 0.25)
V.box('hedge_f', -44, 44, 34.6, 36.6, -0.02, 0.9, M['hedge'], 0.25)
V.box('path', -1.0, 1.0, 11.2, 34.6, -0.02, 0.0, M['gravel'])
for i, (x, y, s) in enumerate([(-26, 18, 1.15), (24, 23, 1.25), (-36, 30, 1.0), (33, 9, 0.95), (-20, -18, 1.1), (26, -16, 1.2), (-48, 4, 1.1), (50, 28, 1.0)]):
    V.umbrella_pine(f'pine{i}', x, y, h(x, y) if abs(x) > 44 or y < -10 else -0.02, s, M['pine'], M['bark'], 20 + i)
for i, (x, y) in enumerate([(-20, 31), (20, 31)]):
    V.olive(f'ol{i}', x, y, -0.02, 0.85, M['olive'], M['bark'], 40 + i)
lav = V.shrub('lavs', 0, 0, -600, 0.3, M['lavender'], 3)
k = 0
for side in ():
    for row in range(2):
        y = 11.6 + row * 0.6
        x = side * 13.5
        while abs(x) < 40:
            V.instance(lav, f'lv{k}', (x, y, -0.02), k * 1.7, 0.9 + 0.2 * math.sin(k))
            x += side * 0.62
            k += 1
src = V.shrub('scrubs', 0, 0, -500, 1.0, M['hedge'], 5)
rnd = random.Random(3)
n = 0
while n < 700:
    x = rnd.uniform(-200, 200); y = rnd.uniform(-110, 85)
    if -48 < x < 48 and -16 < y < 40:
        continue
    z = h(x, y)
    V.instance(src, f'sb{n}', (x, y, z - 0.2), rnd.uniform(0, 6.3), rnd.uniform(0.8, 2.4))
    n += 1

SHOTS = {
    # from the lawn corner: pool in front, house on the right, pines framing
    'hero': dict(loc=(-17.5, 14.2, 1.35), tgt=(8, -3, 2.0), lens=22, sy=0.08),
    # frontal, symmetrical across the pool
    'front': dict(loc=(0, 30, 1.6), tgt=(0, -4, 2.4), lens=26, sy=0.08),
    # under the pines looking back at the house across the garden
    'garden': dict(loc=(19, 15.5, 1.5), tgt=(-8, -1, 2.2), lens=24, sy=0.06),
    # corner detail: cantilevered roof, teak soffit, stone wall
    'detail': dict(loc=(21.5, 9.5, 1.5), tgt=(12, -1, 3.0), lens=28, sy=0.12),
    # from the roof terrace corner over the garden to the sea
    'view': dict(loc=(-16.5, 1.8, 5.4), tgt=(10, 40, 1.0), lens=22, sy=-0.08),
}
s = SHOTS[SHOT]
cam = V.camera(SHOT, s['loc'], s['tgt'], s['lens'], s.get('sx', 0.0), s.get('sy', 0.0), s.get('level', True))
t0 = time.time()
V.render(cam, OUT)
print('RENDERED', SHOT, LIGHT, W, H, SPP, round(time.time() - t0, 1), 's')
