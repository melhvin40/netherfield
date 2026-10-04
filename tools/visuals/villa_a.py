# Villa A: a contemporary Cycladic villa on a hillside above the Aegean, infinity pool, pergola.
# usage: python villa_a.py <shot> <width> <height> <samples> <out.png> [light]
import os, sys, math, random, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector, noise
import vlib as V

SHOT, W, H, SPP, OUT = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
LIGHT = sys.argv[6] if len(sys.argv) > 6 else 'golden'
SEA_Z = -28.0

V.reset()
EXPOSURE = {'golden': -2.2, 'blue': -0.2, 'sunset': -1.6}[LIGHT]
V.render_setup(W, H, SPP, EXPOSURE)

# ------------------------------------------------------------------ light
if LIGHT == 'golden':
    V.sky(7, -38, 1.0, aerosol=2.2)
    interior = 0.6
    pool_glow = 0.0
elif LIGHT == 'sunset':
    V.sky(1.5, -25, 1.0, aerosol=3.0)
    interior = 1.2
    pool_glow = 0.12
else:  # blue hour
    V.sky(-2.5, -30, 1.0, aerosol=2.0, sun_disc=False)
    interior = 3.0
    pool_glow = 0.32

# ------------------------------------------------------------------ materials
M = {
    'plaster': V.plaster('plaster', (0.84, 0.82, 0.78)),
    'plaster_in': V.plaster('plaster_in', (0.8, 0.76, 0.7), bump=0.02),
    'stone': V.stone('stone', (0.52, 0.44, 0.36), 2.4),
    'paving': V.paving('paving', (0.74, 0.68, 0.58), 0.9),
    'oak': V.wood('oak', (0.42, 0.28, 0.16), 2.0, 0.45),
    'teak': V.wood('teak', (0.3, 0.17, 0.08), 3.0, 0.55),
    'glass': V.glass('glass'),
    'water': V.water('water', (0.72, 0.92, 0.9)),
    'tiles': V.tiles('tiles', (0.42, 0.66, 0.68), glow=pool_glow),
    'sea': V.sea('sea'),
    'terrain': V.terrain_mat('terrain', (0.3, 0.25, 0.19), (0.33, 0.28, 0.16), (0.06, 0.07, 0.03)),
    'bronze': V.plain('bronze', (0.05, 0.045, 0.04), 0.35, 1.0),
    'linen': V.plain('linen', (0.78, 0.75, 0.68), 0.9, sheen=0.5),
    'cushion_blue': V.plain('cushion_blue', (0.08, 0.14, 0.24), 0.85, sheen=0.4),
    'cypress': V.foliage('cypress', (0.03, 0.06, 0.025), 0.35, 2.0),
    'olive': V.foliage('olive', (0.16, 0.18, 0.11), 0.4, 3.0),
    'bark': V.plain('bark', (0.12, 0.1, 0.08), 0.9),
    'bougain': V.foliage('bougain', (0.55, 0.04, 0.24), 0.3, 5.0),
    'scrub': V.foliage('scrub', (0.09, 0.1, 0.05), 0.45, 2.5),
    'rosemary': V.foliage('rosemary', (0.2, 0.22, 0.17), 0.3, 4.0),
    'warm': V.emission('warm', (1.0, 0.74, 0.48), 4.0 * interior),
    'lamp': V.emission('lamp', (1.0, 0.68, 0.4), 2.5 * interior),
    'island': V.plain('island', (0.18, 0.2, 0.24), 0.95),
    'art': V.plain('art', (0.1, 0.18, 0.3), 0.7),
    'travertine': V.paving('travertine', (0.82, 0.77, 0.68), 3.0, 0.4),
    'coping': V.paving('coping', (0.8, 0.76, 0.68), 1.2, 0.45),
    'gravel': V.gravel('gravel'),
    'grass': V.grass('grass'),
    'lavender': V.foliage('lavender', (0.26, 0.2, 0.36), 0.35, 6.0),
    'poollamp': V.emission('poollamp', (0.75, 0.95, 1.0), 90.0 * max(pool_glow, 0.05)),
}

# ------------------------------------------------------------------ terrain and sea
COAST = 78.0

def coast_y(x):
    return COAST + 16 * noise.noise(Vector((x * 0.011, 0.37, 0.71)))

def h(x, y):
    c = coast_y(x)
    if y <= c:
        nat = SEA_Z + 27.5 * ((c - y) / 62.0) ** 0.78
    else:
        nat = SEA_Z - (y - c) * 0.6
    rough = noise.fractal(Vector((x * 0.035, y * 0.035, 0.5)), 0.65, 2.0, 5) * 2.8
    rock = noise.fractal(Vector((x * 0.13, y * 0.13, 2.2)), 0.6, 2.0, 3) * 0.7
    nat += rough + rock
    # platform for the villa
    def sm(a, b, t):
        u = min(max((t - a) / (b - a), 0.0), 1.0)
        return u * u * (3 - 2 * u)
    mx = sm(-40, -32, x) * (1 - sm(31, 39, x))
    my = sm(-26, -19, y) * (1 - sm(13.2, 15.5, y))
    m = mx * my
    plat = -0.35 if y <= 13.0 else min(nat, -0.35)
    if -5.5 < x < 14.5 and 5.5 < y < 13.0:
        plat = -2.2   # keep the ground clear of the pool shell
    return nat * (1 - m) + plat * m

V.grid_terrain('terrain', -260, 260, -220, 140, 260, 180, h, M['terrain'])
V.mesh_obj('sea', [(-30000, -300, SEA_Z), (30000, -300, SEA_Z), (30000, 40000, SEA_Z), (-30000, 40000, SEA_Z)], [(0, 1, 2, 3)], M['sea'])

# distant islands
rnd = random.Random(4)
for k, (ix, iy, r, hh) in enumerate([(-5200, 9000, 2600, 380), (2600, 12500, 3800, 520), (7800, 7600, 1700, 240), (-1400, 15000, 4200, 640)]):
    V.blob(f'island{k}', (ix, iy, SEA_Z - hh * 0.25), 1.0, (r, r * 0.55, hh), M['island'], k + 3, 3, 0.35, 1.3)

# ------------------------------------------------------------------ platform, pool, retaining wall
PX0, PX1, PY0, PY1 = -4.0, 13.0, 6.8, 12.4   # pool
T = 0.0                                       # terrace level
V.box('pave_main', -30, 28, -16, PY0, T - 0.4, T, M['paving'])
V.box('pave_l', -30, PX0 - 0.3, PY0, 13.0, T - 0.4, T, M['paving'])
V.box('pave_r', PX1 + 0.3, 28, PY0, 13.0, T - 0.4, T, M['paving'])
V.box('pave_back', PX0 - 0.3, PX1 + 0.3, PY0 - 0.3, PY0, T - 0.4, T, M['paving'])
# pool basin: tiled shell, travertine coping, water just below the coping, vanishing edge to the sea
V.box('pool_floor', PX0, PX1, PY0, PY1, -1.65, -1.5, M['tiles'])
V.box('pool_wl', PX0 - 0.3, PX0, PY0, PY1, -1.65, -0.1, M['tiles'])
V.box('pool_wr', PX1, PX1 + 0.3, PY0, PY1, -1.65, -0.1, M['tiles'])
V.box('pool_wb', PX0, PX1, PY0 - 0.3, PY0, -1.65, -0.1, M['tiles'])
V.box('cop_l', PX0 - 0.35, PX0 + 0.03, PY0 - 0.35, PY1, -0.1, 0.0, M['coping'], 0.01)
V.box('cop_r', PX1 - 0.03, PX1 + 0.35, PY0 - 0.35, PY1, -0.1, 0.0, M['coping'], 0.01)
V.box('cop_b', PX0 - 0.35, PX1 + 0.35, PY0 - 0.35, PY0 + 0.03, -0.1, 0.0, M['coping'], 0.01)
V.box('pool_edge', PX0 - 0.3, PX1 + 0.3, PY1, PY1 + 0.25, -1.65, -0.16, M['tiles'])
V.box('pool_water', PX0 - 0.02, PX1 + 0.02, PY0 - 0.02, PY1 + 0.25, -1.52, -0.13, M['water'])
for i in range(5):
    x = PX0 + 1.7 + i * (PX1 - PX0 - 3.4) / 4
    V.box(f'plamp{i}', x - 0.12, x + 0.12, PY0 + 0.0, PY0 + 0.02, -0.75, -0.55, M['poollamp'])
# catch basin and retaining wall
V.box('catch', PX0 - 0.3, PX1 + 0.3, PY1 + 0.25, 13.0, -0.55, -0.4, M['stone'])
V.box('wall_front', -30.6, 28.6, 13.0, 13.6, -16.0, T + 0.0, M['stone'], 0.03)
V.box('wall_cap_l', -30, PX0 - 0.3, 12.6, 13.6, T, T + 0.45, M['stone'], 0.03)
V.box('wall_cap_r', PX1 + 0.3, 28, 12.6, 13.6, T, T + 0.45, M['stone'], 0.03)
V.box('wall_side_l', -30.6, -30, -16, 13.6, -16.0, T + 0.45, M['stone'], 0.03)
V.box('wall_side_r', 28, 28.6, -16, 13.6, -16.0, T + 0.45, M['stone'], 0.03)

# ------------------------------------------------------------------ villa volumes
def facade_volume(name, x0, x1, y0, y1, z0, z1, front_open=(), glass_inset=0.35, mat=M['plaster']):
    """Plaster volume, open on the front (y1) between the given x ranges, glazed and lit inside."""
    t = 0.3
    V.box(name + '_roof', x0, x1, y0, y1, z1 - 0.45, z1, mat, 0.05)
    V.box(name + '_back', x0, x1, y0, y0 + t, z0, z1, mat, 0.05)
    V.box(name + '_l', x0, x0 + t, y0, y1, z0, z1, mat, 0.05)
    V.box(name + '_r', x1 - t, x1, y0, y1, z0, z1, mat, 0.05)
    # front: piers between openings, lintel above
    edges = [x0] + [v for rng in front_open for v in rng] + [x1]
    for i in range(0, len(edges), 2):
        a, b = edges[i], edges[i + 1]
        if b - a > 0.01:
            V.box(f'{name}_pier{i}', a, b, y1 - t, y1, z0, z1, mat, 0.05)
    for k, (a, b) in enumerate(front_open):
        V.box(f'{name}_lintel{k}', a, b, y1 - t, y1, z1 - 0.75, z1, mat, 0.05)
        gy = y1 - glass_inset
        # sliding glass panels with slim bronze frames
        n = max(2, int(round((b - a) / 2.6)))
        for j in range(n):
            ga = a + (b - a) * j / n
            gb = a + (b - a) * (j + 1) / n
            V.box(f'{name}_g{k}_{j}', ga + 0.03, gb - 0.03, gy - 0.012, gy + 0.012, z0 + 0.04, z1 - 0.78, M['glass'])
            V.box(f'{name}_fv{k}_{j}', gb - 0.035, gb + 0.035, gy - 0.04, gy + 0.04, z0, z1 - 0.75, M['bronze'])
        V.box(f'{name}_fb{k}', a, b, gy - 0.04, gy + 0.04, z0, z0 + 0.05, M['bronze'])
        V.box(f'{name}_ft{k}', a, b, gy - 0.04, gy + 0.04, z1 - 0.8, z1 - 0.75, M['bronze'])
    # interior shell
    V.box(name + '_floor', x0 + t, x1 - t, y0 + t, y1 - t, z0, z0 + 0.03, M['oak'])
    V.box(name + '_ceil', x0 + t, x1 - t, y0 + t, y1 - t, z1 - 0.5, z1 - 0.45, M['plaster_in'])
    V.box(name + '_bwall', x0 + t, x1 - t, y0 + t, y0 + t + 0.02, z0, z1 - 0.45, M['plaster_in'])
    # warm cove light along the back wall and a soft ceiling light
    V.box(name + '_cove', x0 + t + 0.2, x1 - t - 0.2, y0 + t + 0.05, y0 + t + 0.15, z1 - 0.62, z1 - 0.52, M['warm'])
    cx = (x0 + x1) / 2
    V.area_light(name + '_al', (cx, (y0 + y1) / 2, z1 - 0.55), (x1 - x0) * 0.7, 140 * interior * (x1 - x0) / 10, size_y=(y1 - y0) * 0.6, rot=(0, 0, 0))

Z1 = 3.9
facade_volume('liv', -13, 5, -11, -2, T, Z1, front_open=[(-12.2, -4.4), (-3.8, 4.2)])
facade_volume('bed', 5.6, 15.5, -12.5, -4.2, T, 3.6, front_open=[(6.4, 14.6)], mat=M['stone'])
facade_volume('up', -9.5, 1.5, -11, -5.4, Z1, Z1 + 3.4, front_open=[(-8.7, 0.7)])
# roof terrace parapet on top of the living volume
V.box('par_front', -13, 5, -2.25, -2.0, Z1, Z1 + 0.95, M['plaster'], 0.05)
V.box('par_l', -13, -12.75, -5.4, -2.0, Z1, Z1 + 0.95, M['plaster'], 0.05)
V.box('par_r', 4.75, 5, -11, -2.0, Z1, Z1 + 0.95, M['plaster'], 0.05)
V.box('roof_pave', -12.75, 4.75, -5.4, -2.25, Z1, Z1 + 0.02, M['travertine'])
# chimney-like volume and a staircase wall for silhouette
V.box('stair', -16.5, -13, -9, -3.5, T, 2.2, M['plaster'], 0.06)
V.box('chim', -2.2, -1.2, -10.8, -9.8, Z1 + 3.4, Z1 + 4.4, M['plaster'], 0.05)

# pergola in front of the living room
for i, x in enumerate((-12.6, -8.6, -4.6)):
    V.box(f'post{i}', x - 0.18, x + 0.18, 2.4, 2.76, T, 3.05, M['plaster'], 0.03)
V.box('beam_f', -12.8, -4.4, 2.4, 2.76, 3.05, 3.35, M['plaster'], 0.03)
for i in range(30):
    x = -12.7 + i * 0.28
    V.box(f'slat{i}', x, x + 0.09, -2.0, 2.76, 3.35, 3.43, M['teak'])

# outdoor dining under the pergola: a slim teak table on four legs, cushioned chairs
V.box('table', -10.7, -7.3, -0.48, 0.48, 0.72, 0.77, M['teak'], 0.008)
for x in (-10.6, -7.4):
    for y in (-0.4, 0.4):
        V.box(f'tleg{x}{y}', x - 0.035, x + 0.035, y - 0.035, y + 0.035, 0, 0.72, M['teak'])

def chair(name, x, y, face):
    # face = +1: sitter faces +y (back rest on the -y side)
    for dx in (-0.21, 0.21):
        for dy in (-0.2, 0.2):
            V.box(f'{name}l{dx}{dy}', x + dx - 0.018, x + dx + 0.018, y + dy - 0.018, y + dy + 0.018, 0, 0.42, M['teak'])
    V.box(name + 's', x - 0.24, x + 0.24, y - 0.23, y + 0.23, 0.42, 0.46, M['teak'], 0.005)
    V.box(name + 'c', x - 0.22, x + 0.22, y - 0.21, y + 0.21, 0.46, 0.52, M['linen'], 0.025)
    by = y - face * 0.21
    for dx in (-0.21, 0.21):
        V.box(f'{name}p{dx}', x + dx - 0.018, x + dx + 0.018, by - 0.018, by + 0.018, 0.46, 0.88, M['teak'])
    V.box(name + 'b', x - 0.23, x + 0.23, by - 0.015, by + 0.015, 0.62, 0.86, M['teak'], 0.005)

for i in range(3):
    x = -10.0 + i * 1.0
    chair(f'cha{i}', x, -0.85, 1)
    chair(f'chb{i}', x, 0.85, -1)
# pendant lights over the table
for x in (-9.8, -9.0, -8.2):
    V.blob(f'pend{x}', (x, 0, 2.2), 0.11, (1, 1, 0.8), M['lamp'], 1, 3, 0.0)
    V.box(f'cord{x}', x - 0.005, x + 0.005, -0.005, 0.005, 2.3, 3.35, M['bronze'])

# sun loungers facing the sea
for i, x in enumerate((0.0, 2.2, 6.6, 8.8)):
    V.box(f'lng{i}', x - 0.36, x + 0.36, 3.6, 5.6, 0.08, 0.3, M['teak'], 0.02)
    V.box(f'lngc{i}', x - 0.34, x + 0.34, 3.9, 5.58, 0.3, 0.4, M['linen'], 0.04)
    bk = V.box(f'lngb{i}', x - 0.34, x + 0.34, -0.05, 0.05, 0.0, 0.8, M['linen'], 0.04)
    bk.rotation_euler = (math.radians(40), 0, 0)
    bk.location = (0, 4.35, 0.38)
    V.box(f'lngt{i}', x + 0.6, x + 1.0, 4.4, 4.8, 0.0, 0.45, M['travertine'], 0.02)
# parasol
V.cylinder('para_pole', 4.4, 4.6, 0.03, 0.0, 2.5, M['teak'], 10)
V.cylinder('para', 4.4, 4.6, 1.5, 2.15, 2.6, M['linen'], 32, 0.05)

# planters with olive trees, rosemary along the edges
V.box('plant1', -25.7, -22.3, -13.2, -9.8, T, 0.5, M['stone'], 0.03)
V.olive('olive1', -24.0, -11.5, 0.5, 1.15, M['olive'], M['bark'], 11)
V.box('plant2', 18.5, 21.9, -12.0, -8.6, T, 0.5, M['stone'], 0.03)
V.olive('olive2', 20.2, -10.3, 0.5, 1.0, M['olive'], M['bark'], 12)
V.box('bed_l', -30, -4.6, 11.4, 12.6, 0.0, 0.12, M['terrain'])
V.box('bed_r', 13.6, 28, 11.4, 12.6, 0.0, 0.12, M['terrain'])
lav = V.shrub('lav_src', 0, 0, -600, 0.3, M['lavender'], 3)
k = 0
for row, yy in enumerate((11.75, 12.25)):
    for x0, x1 in ((-29.6, -5.0), (14.0, 27.6)):
        x = x0 + (row * 0.3)
        while x < x1:
            V.instance(lav, f'lav{k}', (x, yy, 0.1), k * 1.3, 0.9 + 0.25 * math.sin(k * 2.1))
            x += 0.62
            k += 1
V.box('gravel_l', -29.4, -15.0, 2.0, 10.6, 0.0, 0.02, M['gravel'])
V.box('plant3', -25.0, -21.6, 4.4, 7.8, T, 0.55, M['stone'], 0.03)
V.olive('olive3', -23.3, 6.1, 0.55, 1.05, M['olive'], M['bark'], 13)
V.box('plant4', -19.6, -17.4, 7.6, 9.8, T, 0.55, M['stone'], 0.03)
V.olive('olive4', -18.5, 8.7, 0.55, 0.8, M['olive'], M['bark'], 14)
V.box('gravel', 16.0, 27.4, -15.4, -1.0, 0.0, 0.02, M['gravel'])
for i in range(0):
    V.shrub(f'ros{i}', -29.2 + i * 0.75, 11.6 + 0.3 * math.sin(i), 0.0, 0.42, M['rosemary'], i)
for i in range(0):
    V.shrub(f'rosr{i}', 17.0 + i * 0.75, 12.2 + 0.2 * math.cos(i), 0.0, 0.38, M['rosemary'], 30 + i)
# bougainvillea climbing the west wall and the pergola end
for i in range(26):
    rr = random.Random(i)
    V.blob(f'bg{i}', (-13.25 - rr.uniform(0, 0.4), rr.uniform(-10.5, -2.5), rr.uniform(0.6, 3.6)), rr.uniform(0.35, 0.7), (0.7, 1.2, 1.0), M['bougain'], 50 + i, 2, 0.5, 2.5)
for i in range(10):
    rr = random.Random(100 + i)
    V.blob(f'bgp{i}', (-12.6 + rr.uniform(-0.4, 0.4), rr.uniform(-1.8, 2.8), 3.5 + rr.uniform(0, 0.4)), rr.uniform(0.35, 0.6), (1.2, 1.2, 0.6), M['bougain'], 80 + i, 2, 0.5, 2.5)

# cypresses on the hill behind, scrub on the slopes
for i, (x, y, hh) in enumerate([(-19, -24, 12), (-15.5, -27, 10), (-22, -30, 13.5), (9, -21, 11), (12.5, -24, 13), (19, -20, 9.5), (25, -27, 12.5), (-30, -20, 9)]):
    V.cypress(f'cyp{i}', x, y, h(x, y) - 0.3, hh, M['cypress'], i)
src = V.shrub('scrub_src', 0, 0, -500, 1.0, M['scrub'], 7)
rnd = random.Random(9)
placed = 0
while placed < 1400:
    x = rnd.uniform(-200, 200)
    y = rnd.uniform(-160, 90)
    if -42 < x < 41 and -28 < y < 16:
        continue
    z = h(x, y)
    if z < SEA_Z + 0.5:
        continue
    s = rnd.uniform(0.6, 2.0)
    V.instance(src, f'sc{placed}', (x, y, z - 0.2 * s), rnd.uniform(0, 6.28), s)
    placed += 1

for i in range(46):
    rr = random.Random(500 + i)
    x = rr.uniform(-150, 150)
    y = rr.uniform(-140, -24) if i % 3 else rr.uniform(-60, 60)
    if -44 < x < 43 and -30 < y < 18:
        continue
    z = h(x, y)
    if z < SEA_Z + 2:
        continue
    V.cypress(f'cypx{i}', x, y, z - 0.3, rr.uniform(7, 13), M['cypress'], 60 + i)

# ------------------------------------------------------------------ interiors (read as warm silhouettes through glass)
V.box('sofa', -10.5, -5.5, -8.4, -7.4, 0, 0.42, M['linen'], 0.06)
V.box('sofab', -10.5, -5.5, -8.4, -8.0, 0.42, 0.85, M['linen'], 0.06)
V.box('ctable', -9.2, -6.8, -6.6, -5.4, 0, 0.36, M['travertine'], 0.02)
V.box('art', -9.5, -6.5, -10.68, -10.64, 1.2, 2.8, M['art'])
V.box('dtable', -1.5, 2.5, -7.2, -6.0, 0.74, 0.78, M['oak'], 0.01)
for x in (-0.6, 0.5, 1.6):
    V.blob(f'ipend{x}', (x, -6.6, 2.35), 0.13, (1, 1, 0.7), M['lamp'], 2, 3, 0.0)
V.box('bed', 8.0, 10.2, -11.6, -9.4, 0, 0.55, M['linen'], 0.08)
V.box('bedhead', 7.8, 10.4, -12.1, -11.9, 0, 1.3, M['oak'], 0.02)
V.box('upsofa', -6.0, -2.0, -10.3, -9.4, Z1, Z1 + 0.45, M['cushion_blue'], 0.06)

# garden lights along the terrace edge

# ------------------------------------------------------------------ cameras
SHOTS = {
    # from the roof terrace over the glowing pool to the sea
    'terrace': dict(loc=(-6.0, -4.9, 6.4), tgt=(9, 14, -0.5), lens=24, sy=-0.1),
    # three-quarter view from the west lawn: pool in front, house on the right, sea on the left
    'west3q': dict(loc=(-14.0, 11.6, 1.65), tgt=(10, -8, 1.6), lens=20, sy=0.12),
    # from the east terrace corner back across the pool to the house
    'east3q': dict(loc=(25.5, 9.0, 1.6), tgt=(-4, -4, 1.6), lens=22, sy=0.1),
    # over the pool to the vanishing edge and the open sea
    'pool': dict(loc=(-3.2, 5.6, 1.35), tgt=(16, 15.5, -1.0), lens=20, sy=-0.06),
    # drone view from above the sea, looking back at the house on its stone terrace
    'aerial': dict(loc=(70, 34, 21), tgt=(-5, -4, -1.0), lens=30, level=False),
    # frontal elevation from above the slope
    'front': dict(loc=(1.5, 46, 4.0), tgt=(1.5, -4, 3.0), lens=35, sy=0.04),
    # under the pergola, dining table, looking out to sea
    'pergola': dict(loc=(-12.3, -1.7, 1.5), tgt=(4, 16, 0.6), lens=22, sy=-0.05),
}
s = SHOTS[SHOT]
cam = V.camera(SHOT, s['loc'], s['tgt'], s['lens'], s.get('sx', 0.0), s.get('sy', 0.0), s.get('level', True))
t0 = time.time()
V.render(cam, OUT)
print('RENDERED', SHOT, LIGHT, W, H, SPP, round(time.time() - t0, 1), 's')
