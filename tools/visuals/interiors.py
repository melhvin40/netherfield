# Interiors: a sea-view living room with a reading wall and dining area, and a bedroom.
# usage: python interiors.py <shot> <width> <height> <samples> <out.png> [light] [exposure]
import os, sys, math, random, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector, noise
import vlib as V

SHOT, W, H, SPP, OUT = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
LIGHT = sys.argv[6] if len(sys.argv) > 6 else 'sunset'
EXP = float(sys.argv[7]) if len(sys.argv) > 7 else None
SEA_Z = -32.0

V.reset()
base_exp = {'sunset': -1.0, 'golden': -1.6, 'morning': -1.4, 'blue': 0.4}[LIGHT]
V.render_setup(W, H, SPP, base_exp if EXP is None else EXP)
bpy.context.scene.cycles.diffuse_bounces = 6
if LIGHT == 'sunset':
    V.sky(4.0, -48, 1.0, aerosol=2.6); lamps = 0.6
elif LIGHT == 'golden':
    V.sky(10.0, -55, 1.0, aerosol=2.0); lamps = 0.25
elif LIGHT == 'morning':
    V.sky(14.0, 62, 1.0, aerosol=1.6); lamps = 0.0
else:
    V.sky(-2.5, -40, 1.0, aerosol=2.0, sun_disc=False); lamps = 2.0

M = {
    'wall': V.plaster('cwall', (0.82, 0.79, 0.74), bump=0.015),
    'ceil': V.plaster('cceil', (0.86, 0.85, 0.82), bump=0.01),
    'oak': V.wood('coak', (0.5, 0.36, 0.22), 1.6, 0.42, (1, 1, 22)),
    'oakdark': V.wood('coakd', (0.3, 0.2, 0.12), 2.5, 0.4),
    'glass': V.glass('cglass'),
    'bronze': V.plain('cbronze', (0.05, 0.045, 0.04), 0.35, 1.0),
    'linen': V.plain('clinen', (0.78, 0.75, 0.69), 0.92, sheen=0.6),
    'boucle': V.plain('cboucle', (0.84, 0.82, 0.77), 0.95, sheen=0.8),
    'sand': V.plain('csand', (0.62, 0.53, 0.42), 0.9, sheen=0.5),
    'travertine': V.paving('ctrav', (0.8, 0.74, 0.64), 4.0, 0.35),
    'marble': V.plain('cmarble', (0.86, 0.85, 0.83), 0.18, spec=0.6),
    'rug': V.plain('crug', (0.72, 0.68, 0.6), 0.98, sheen=0.7),
    'paving': V.paving('cpave', (0.76, 0.71, 0.62), 0.9),
    'sea': V.sea('csea'),
    'island': V.plain('cisl', (0.2, 0.22, 0.26), 0.95),
    'terrain': V.terrain_mat('cterr', (0.32, 0.27, 0.2), (0.33, 0.28, 0.16), (0.07, 0.08, 0.035)),
    'olive': V.foliage('colive', (0.16, 0.18, 0.11), 0.4, 3.0),
    'bark': V.plain('cbark', (0.14, 0.11, 0.09), 0.9),
    'pot': V.plain('cpot', (0.45, 0.3, 0.22), 0.85),
    'lampshade': V.emission('cshade', (1.0, 0.78, 0.55), 6.0 * lamps + 0.2),
    'art1': V.plain('cart1', (0.12, 0.2, 0.32), 0.8),
    'art2': V.plain('cart2', (0.72, 0.6, 0.44), 0.8),
    'ceramic': V.plain('cceram', (0.9, 0.88, 0.84), 0.3),
    'sheer': V.plain('csheer', (0.95, 0.94, 0.9), 0.9, sheen=0.4),
    'blanket': V.plain('cblank', (0.55, 0.47, 0.37), 0.95, sheen=0.7),
}
# sheer curtain: translucent
sheer = M['sheer']
p = sheer.node_tree.nodes['Principled BSDF']
p.inputs['Transmission Weight'].default_value = 0.85
p.inputs['Roughness'].default_value = 0.9

# ------------------------------------------------------------------ outside: terrace, slope, sea, islands
V.box('terrace', -14, 14, 4.3, 10.5, -0.35, 0.0, M['paving'])
V.box('bal', -14, 14, 10.3, 10.34, 0.0, 1.0, M['glass'])
V.box('balcap', -14, 14, 10.27, 10.37, 1.0, 1.04, M['bronze'])
def h(x, y):
    return SEA_Z + 30 * max(0.0, (120 - y) / 110.0) ** 0.8 + noise.fractal(Vector((x * 0.03, y * 0.03, 0.4)), 0.6, 2.0, 5) * 2.4 - 1.0
V.grid_terrain('slope', -160, 160, 10.5, 170, 120, 80, lambda x, y: min(h(x, y), -1.0), M['terrain'])
V.mesh_obj('sea', [(-30000, 60, SEA_Z), (30000, 60, SEA_Z), (30000, 40000, SEA_Z), (-30000, 40000, SEA_Z)], [(0, 1, 2, 3)], M['sea'])
for k, (ix, iy, r, hh) in enumerate([(-4800, 8000, 2400, 360), (3600, 12500, 4200, 560), (8800, 9800, 1600, 240)]):
    V.blob(f'isl{k}', (ix, iy, SEA_Z - hh * 0.25), 1.0, (r, r * 0.5, hh), M['island'], k + 21, 3, 0.35, 1.3)

# ------------------------------------------------------------------ living room shell (x -7..7, y -4.5..4.3)
X0, X1, Y0, Y1, ZC = -7.0, 7.0, -4.5, 4.3, 3.2
V.box('floor', X0, X1, Y0, Y1, -0.05, 0.0, M['oak'])
V.box('ceil', X0 - 0.3, X1 + 0.3, Y0 - 0.3, Y1 + 0.6, ZC, ZC + 0.4, M['ceil'])
V.box('wback', X0 - 0.3, X1 + 0.3, Y0 - 0.3, Y0, 0, ZC, M['wall'])
V.box('wleft', X0 - 0.3, X0, Y0, Y1, 0, ZC, M['wall'])
V.box('wright_a', X1, X1 + 0.3, Y0, -0.5, 0, ZC, M['wall'])
# right wall: a tall window to the side terrace
V.box('wright_top', X1, X1 + 0.3, -0.5, Y1, ZC - 0.25, ZC, M['wall'])
V.box('wr_glass', X1 + 0.12, X1 + 0.14, -0.5, Y1, 0.0, ZC - 0.25, M['glass'])
# sea side: floor-to-ceiling sliding glass with slim bronze mullions
n = 5
for j in range(n):
    a = X0 + (X1 - X0) * j / n
    b = X0 + (X1 - X0) * (j + 1) / n
    V.box(f'g{j}', a + 0.02, b - 0.02, Y1 - 0.012, Y1 + 0.012, 0.02, ZC - 0.02, M['glass'])
    V.box(f'm{j}', b - 0.025, b + 0.025, Y1 - 0.035, Y1 + 0.035, 0.0, ZC, M['bronze'])
V.box('sill', X0, X1, Y1 - 0.035, Y1 + 0.035, 0.0, 0.03, M['bronze'])
# a recessed cove light along the back wall
V.box('cove', X0 + 0.2, X1 - 0.2, Y0 + 0.05, Y0 + 0.12, ZC - 0.14, ZC - 0.08, V.emission('ccove', (1.0, 0.76, 0.5), 3.0 * lamps + 0.05))

# reading wall on the left: oak shelves filled with books, a desk under the side window
V.box('shelf_back', X0, X0 + 0.04, Y0 + 0.4, -0.2, 0.0, 2.9, M['oakdark'])
rnd = random.Random(7)
book_cols = [(0.62, 0.55, 0.45), (0.2, 0.25, 0.32), (0.75, 0.72, 0.66), (0.45, 0.2, 0.15), (0.3, 0.33, 0.27), (0.82, 0.8, 0.74), (0.55, 0.42, 0.28), (0.12, 0.13, 0.15)]
book_mats = [V.plain(f'book{i}', c, 0.7) for i, c in enumerate(book_cols)]
for r in range(6):
    z = 0.1 + r * 0.46
    V.box(f'shelf{r}', X0, X0 + 0.38, Y0 + 0.4, -0.2, z - 0.03, z, M['oakdark'])
    y = Y0 + 0.45
    while y < -0.3:
        if rnd.random() < 0.1:
            y += rnd.uniform(0.15, 0.5)
            continue
        t = rnd.uniform(0.025, 0.06)
        hh = rnd.uniform(0.24, 0.38)
        d = rnd.uniform(0.17, 0.25)
        V.box(f'b{r}_{y:.2f}', X0 + 0.04, X0 + 0.04 + d, y, y + t, z, z + hh, book_mats[rnd.randrange(len(book_mats))])
        y += t + 0.004
    if r % 2 == 1:
        V.blob(f'vase{r}', (X0 + 0.2, -0.55, z + 0.14), 0.11, (1, 1, 1.3), M['ceramic'], r, 3, 0.05)
for x in (X0, ):
    V.box('shelf_side1', X0, X0 + 0.4, Y0 + 0.36, Y0 + 0.4, 0.0, 2.9, M['oakdark'])
    V.box('shelf_side2', X0, X0 + 0.4, -0.2, -0.16, 0.0, 2.9, M['oakdark'])
# desk and chair by the left end of the glazing
V.box('desk', X0 + 0.5, X0 + 2.1, 2.6, 3.6, 0.73, 0.77, M['oakdark'], 0.008)
for dx in (0.55, 2.05):
    V.box(f'dl{dx}', X0 + dx - 0.03, X0 + dx + 0.03, 2.65, 3.55, 0, 0.73, M['bronze'])
V.box('dchair', X0 + 1.0, X0 + 1.55, 1.9, 2.4, 0.42, 0.48, M['sand'], 0.03)
V.box('dchairb', X0 + 1.0, X0 + 1.55, 1.86, 1.92, 0.48, 0.9, M['sand'], 0.02)
for dx in (1.03, 1.52):
    for dy in (1.93, 2.37):
        V.box(f'dcl{dx}{dy}', X0 + dx - 0.015, X0 + dx + 0.015, dy - 0.015, dy + 0.015, 0, 0.42, M['bronze'])
V.box('book_open', X0 + 1.1, X0 + 1.5, 3.0, 3.3, 0.77, 0.79, M['ceramic'])
V.cylinder('dlamp', X0 + 1.85, 3.4, 0.08, 0.77, 1.2, M['bronze'], 12, 0.012)
V.blob('dlamph', (X0 + 1.85, 3.4, 1.24), 0.09, (1, 1, 0.7), M['lampshade'], 2, 3, 0.0)

# lounge: L-sofa, coffee table on a rug, lounge chairs, floor lamp, potted olive
V.box('rug', -3.6, 2.4, -2.2, 2.0, 0.0, 0.015, M['rug'], 0.005)
V.box('sofa_base', -3.2, 1.6, -3.9, -2.9, 0.0, 0.4, M['linen'], 0.07)
V.box('sofa_back', -3.2, 1.6, -4.2, -3.75, 0.4, 0.8, M['linen'], 0.08)
V.box('sofa_l', -3.2, -2.2, -2.9, -0.6, 0.0, 0.4, M['linen'], 0.07)
V.box('sofa_arm', -3.45, -3.2, -4.2, -0.6, 0.0, 0.62, M['linen'], 0.06)
for x in (-2.5, -1.0, 0.5):
    V.box(f'pillow{x}', x, x + 0.5, -3.75, -3.6, 0.45, 0.88, M['blanket'] if x < 0 else M['boucle'], 0.06)
V.box('ctable', -1.3, 0.5, -1.6, -0.6, 0.0, 0.34, M['travertine'], 0.02)
V.blob('bowl', (-0.6, -1.1, 0.4), 0.16, (1, 1, 0.35), M['ceramic'], 4, 3, 0.0)
V.box('books_t', -1.1, -0.75, -1.35, -1.1, 0.34, 0.42, book_mats[1], 0.004)
for i, (x, y, r) in enumerate(((2.6, -0.4, 0.9), (2.4, 1.3, 1.1))):
    c = V.box(f'lc{i}', -0.4, 0.4, -0.4, 0.4, 0.0, 0.42, M['boucle'], 0.12)
    c.location = (x, y, 0); c.rotation_euler = (0, 0, r)
    b = V.box(f'lcb{i}', -0.4, 0.4, 0.28, 0.42, 0.42, 0.78, M['boucle'], 0.1)
    b.location = (x, y, 0); b.rotation_euler = (0, 0, r)
V.cylinder('flamp', 1.95, -4.1, 0.012, 0.0, 1.55, M['bronze'], 10)
V.cylinder('flamp_base', 1.95, -4.1, 0.16, 0.0, 0.025, M['bronze'], 24)
V.cylinder('flamp_shade', 1.95, -4.1, 0.22, 1.45, 1.75, M['lampshade'], 24, 0.18)
V.cylinder('opot', 5.6, 3.4, 0.38, 0.0, 0.62, M['pot'], 24, 0.45)
V.olive('ol', 5.6, 3.4, 0.6, 0.62, M['olive'], M['bark'], 77)
# art on the back wall
V.box('art1', -1.8, 0.6, Y0 + 0.0, Y0 + 0.04, 1.15, 2.55, M['art1'])
V.box('art1f', -1.84, 0.64, Y0 - 0.01, Y0 + 0.02, 1.11, 2.59, M['oakdark'])

# dining at the right end, with pendants
V.box('dtable', 3.4, 5.8, -3.4, -2.4, 0.74, 0.78, M['oak'], 0.01)
for x in (3.55, 5.65):
    V.box(f'dtl{x}', x - 0.04, x + 0.04, -3.3, -2.5, 0.0, 0.74, M['oak'])
for i, x in enumerate((3.8, 4.6, 5.4)):
    for y, f in ((-3.75, 1), (-2.05, -1)):
        V.box(f'dc{i}{y}', x - 0.22, x + 0.22, y - 0.22, y + 0.22, 0.44, 0.5, M['sand'], 0.03)
        by = y - f * 0.21
        V.box(f'dcb{i}{y}', x - 0.22, x + 0.22, by - 0.025, by + 0.025, 0.5, 0.86, M['sand'], 0.02)
        for dx in (-0.18, 0.18):
            for dy in (-0.18, 0.18):
                V.box(f'dcl{i}{y}{dx}{dy}', x + dx - 0.014, x + dx + 0.014, y + dy - 0.014, y + dy + 0.014, 0, 0.44, M['oakdark'])
for x in (3.9, 4.6, 5.3):
    V.blob(f'pend{x}', (x, -2.9, 1.85), 0.13, (1, 1, 0.8), M['lampshade'], 5, 3, 0.0)
    V.box(f'cord{x}', x - 0.004, x + 0.004, -2.904, -2.896, 1.95, ZC, M['bronze'])
V.blob('vase_d', (4.6, -2.9, 0.92), 0.12, (1, 1, 1.4), M['ceramic'], 9, 3, 0.05)

# sheer curtains gathered at the glazing ends
for x0 in (X0 + 0.05, X1 - 0.75):
    for k in range(7):
        x = x0 + k * 0.1
        V.box(f'cur{x0}{k}', x, x + 0.06, Y1 - 0.25 + 0.04 * math.sin(k * 1.7), Y1 - 0.2 + 0.04 * math.sin(k * 1.7), 0.02, ZC - 0.05, M['sheer'])
if lamps > 0:
    V.area_light('ceil_l', (0, -1, ZC - 0.05), 6, 120 * lamps, size_y=4)

# ------------------------------------------------------------------ bedroom (x 20..26.5): bed against an oak wall, sea to the side
BX0, BX1, BY0 = 20.0, 26.5, -2.5
V.box('b_floor', BX0, BX1, BY0, Y1, -0.05, 0.0, M['oak'])
V.box('b_ceil', BX0 - 0.3, BX1 + 0.3, BY0 - 0.3, Y1 + 0.6, ZC, ZC + 0.4, M['ceil'])
V.box('b_back', BX0 - 0.3, BX1 + 0.3, BY0 - 0.3, BY0, 0, ZC, M['wall'])
V.box('b_left', BX0 - 0.3, BX0, BY0, Y1, 0, ZC, M['wall'])
V.box('b_right', BX1, BX1 + 0.3, BY0, Y1, 0, ZC, M['wall'])
for j in range(3):
    a = BX0 + (BX1 - BX0) * j / 3
    b = BX0 + (BX1 - BX0) * (j + 1) / 3
    V.box(f'bg{j}', a + 0.02, b - 0.02, Y1 - 0.012, Y1 + 0.012, 0.02, ZC - 0.02, M['glass'])
    V.box(f'bm{j}', b - 0.025, b + 0.025, Y1 - 0.035, Y1 + 0.035, 0.0, ZC, M['bronze'])
# oak-panelled bed wall with a warm reading light line
V.box('bwall_oak', BX0, BX0 + 0.06, -1.2, 3.1, 0.0, 2.6, M['oakdark'])
V.box('bwall_led', BX0 + 0.06, BX0 + 0.08, -1.1, 3.0, 2.48, 2.52, V.emission('cled', (1.0, 0.75, 0.5), 2.0 * lamps + 0.3))
V.box('headboard', BX0 + 0.06, BX0 + 0.18, -0.2, 2.1, 0.0, 1.15, M['sand'], 0.04)
V.box('bedbase', BX0 + 0.18, BX0 + 2.35, -0.15, 2.05, 0.0, 0.3, M['oakdark'], 0.02)
V.box('mattress', BX0 + 0.2, BX0 + 2.3, -0.12, 2.02, 0.3, 0.55, M['linen'], 0.08)
V.box('duvet', BX0 + 0.75, BX0 + 2.4, -0.18, 2.08, 0.48, 0.62, M['boucle'], 0.1)
V.box('throw', BX0 + 1.85, BX0 + 2.3, -0.2, 2.1, 0.6, 0.67, M['blanket'], 0.05)
for k, (y0, y1) in enumerate(((-0.05, 0.85), (1.05, 1.95))):
    V.box(f'bpl{k}', BX0 + 0.22, BX0 + 0.42, y0, y1, 0.55, 1.0, M['linen'], 0.08)
    V.box(f'bps{k}', BX0 + 0.42, BX0 + 0.58, y0 + 0.12, y1 - 0.12, 0.55, 0.88, M['sand'], 0.07)
for y in (-0.75, 2.6):
    V.box(f'ns{y}', BX0 + 0.1, BX0 + 0.55, y - 0.3, y + 0.3, 0.0, 0.46, M['oakdark'], 0.02)
    V.blob(f'nlamp{y}', (BX0 + 0.33, y, 1.45), 0.11, (1, 1, 1), M['lampshade'], 7, 3, 0.0)
    V.box(f'ncord{y}', BX0 + 0.326, BX0 + 0.334, y - 0.004, y + 0.004, 1.55, ZC, M['bronze'])
V.blob('nvase', (BX0 + 0.33, 2.55, 0.56), 0.08, (1, 1, 1.3), M['ceramic'], 8, 3, 0.05)
V.box('b_rug', BX0 + 1.4, BX0 + 3.6, -0.9, 2.8, 0.0, 0.015, M['rug'], 0.005)
V.box('bench', BX0 + 2.6, BX0 + 3.05, 0.0, 1.9, 0.0, 0.44, M['oakdark'], 0.02)
c = V.box('b_chair', -0.4, 0.4, -0.4, 0.4, 0.0, 0.42, M['boucle'], 0.12)
c.location = (BX1 - 1.2, 3.2, 0); c.rotation_euler = (0, 0, 2.4)
cb = V.box('b_chairb', -0.4, 0.4, 0.28, 0.42, 0.42, 0.78, M['boucle'], 0.1)
cb.location = (BX1 - 1.2, 3.2, 0); cb.rotation_euler = (0, 0, 2.4)
for x0 in (BX0 + 0.05, BX1 - 0.75):
    for k in range(7):
        x = x0 + k * 0.1
        V.box(f'bcur{x0}{k}', x, x + 0.06, Y1 - 0.25 + 0.04 * math.sin(k * 1.3), Y1 - 0.2 + 0.04 * math.sin(k * 1.3), 0.02, ZC - 0.05, M['sheer'])
V.box('b_terr', BX0 - 2, BX1 + 2, 4.3, 10.5, -0.35, 0.0, M['paving'])

SHOTS = {
    # living room: sofa, lounge chairs and the glazing to the sea
    'living': dict(loc=(-5.6, -4.1, 1.35), tgt=(3.5, 3.6, 1.0), lens=20, sy=0.0),
    # the reading wall and the desk at the window
    'study': dict(loc=(-1.2, -0.4, 1.3), tgt=(-7.0, 1.6, 1.15), lens=22, sy=0.0),
    # dining table and pendants, sea beyond
    'dining': dict(loc=(1.2, -4.1, 1.45), tgt=(5.4, 2.6, 0.95), lens=24, sy=0.0),
    # bedroom from the door corner
    'bedroom': dict(loc=(26.1, -2.15, 1.5), tgt=(20.6, 3.0, 0.75), lens=20, sy=0.0),
    # from the glazing back into the lounge: sofa, art, lamps
    'lounge': dict(loc=(3.2, 3.9, 1.4), tgt=(-2.4, -4.4, 1.0), lens=22, sy=0.0),
}
s = SHOTS[SHOT]
cam = V.camera(SHOT, s['loc'], s['tgt'], s['lens'], s.get('sx', 0.0), s.get('sy', 0.0), s.get('level', True))
t0 = time.time()
V.render(cam, OUT)
print('RENDERED', SHOT, LIGHT, W, H, SPP, round(time.time() - t0, 1), 's')
