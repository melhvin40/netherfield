# Small procedural toolkit for architectural stills in Blender (bpy 5.0, Cycles CPU).
import bpy, bmesh, math, random
from mathutils import Vector, noise, Matrix

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene

def render_setup(w, h, samples=128, exposure=0.0, threshold=0.02):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    cy = sc.cycles
    cy.device = 'CPU'
    cy.samples = samples
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = threshold
    cy.use_denoising = True
    try:
        cy.denoiser = 'OPENIMAGEDENOISE'
    except Exception as e:
        print('denoiser:', e)
    cy.max_bounces = 10
    cy.diffuse_bounces = 4
    cy.glossy_bounces = 4
    cy.transmission_bounces = 8
    cy.transparent_max_bounces = 16
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    cy.blur_glossy = 1.0
    cy.sample_clamp_indirect = 8
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.exposure = exposure
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_depth = '16'
    sc.render.threads_mode = 'FIXED'
    sc.render.threads = 4
    return sc

# ---------------------------------------------------------------- world
def sky(elev_deg, rot_deg, strength=1.0, aerosol=1.0, air=1.0, ozone=1.0, sun_disc=True, sun_intensity=1.0, altitude=30.0):
    sc = bpy.context.scene
    w = bpy.data.worlds.new('Sky')
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes['Background']
    s = nt.nodes.new('ShaderNodeTexSky')
    s.sky_type = 'MULTIPLE_SCATTERING'
    s.sun_elevation = math.radians(elev_deg)
    s.sun_rotation = math.radians(rot_deg)
    s.altitude = altitude
    s.air_density = air
    s.aerosol_density = aerosol
    s.ozone_density = ozone
    s.sun_disc = sun_disc
    s.sun_intensity = sun_intensity
    nt.links.new(s.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = strength
    return s

def sun_dir(elev_deg, rot_deg):
    # direction the light travels FROM (pointing at the sun), Blender sky convention
    e, r = math.radians(elev_deg), math.radians(rot_deg)
    return Vector((math.cos(e) * math.sin(r), math.cos(e) * math.cos(r), math.sin(e)))

def sun_lamp(elev_deg, rot_deg, strength, color=(1, 1, 1), angle=0.6):
    d = sun_dir(elev_deg, rot_deg)
    l = bpy.data.lights.new('Sun', 'SUN')
    l.energy = strength
    l.color = color
    l.angle = math.radians(angle)
    o = bpy.data.objects.new('Sun', l)
    bpy.context.scene.collection.objects.link(o)
    o.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    return o

def area_light(name, loc, size, energy, color=(1.0, 0.72, 0.45), rot=(0, 0, 0), shape='RECTANGLE', size_y=None):
    l = bpy.data.lights.new(name, 'AREA')
    l.energy = energy
    l.color = color
    l.shape = shape
    l.size = size
    if size_y is not None:
        l.size_y = size_y
    o = bpy.data.objects.new(name, l)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    return o

def point_light(name, loc, energy, color=(1.0, 0.7, 0.42), radius=0.1):
    l = bpy.data.lights.new(name, 'POINT')
    l.energy = energy
    l.color = color
    l.shadow_soft_size = radius
    o = bpy.data.objects.new(name, l)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    return o

# ---------------------------------------------------------------- materials
def _mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes['Principled BSDF']
    return m, nt, p

def _tex_coord(nt, kind='Object'):
    tc = nt.nodes.new('ShaderNodeTexCoord')
    return tc.outputs[kind]

def _noise(nt, vec, scale, detail=6.0, rough=0.55):
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = scale
    n.inputs['Detail'].default_value = detail
    n.inputs['Roughness'].default_value = rough
    nt.links.new(vec, n.inputs['Vector'])
    return n

def _mix_col(nt, fac, a, b):
    m = nt.nodes.new('ShaderNodeMix')
    m.data_type = 'RGBA'
    if isinstance(fac, float):
        m.inputs['Factor'].default_value = fac
    else:
        nt.links.new(fac, m.inputs['Factor'])
    for sock, val in ((m.inputs[6], a), (m.inputs[7], b)):
        if isinstance(val, tuple):
            sock.default_value = (*val, 1.0) if len(val) == 3 else val
        else:
            nt.links.new(val, sock)
    return m.outputs[2]

def _ramp(nt, fac, stops):
    r = nt.nodes.new('ShaderNodeValToRGB')
    nt.links.new(fac, r.inputs['Fac'])
    els = r.color_ramp.elements
    while len(els) < len(stops):
        els.new(0.5)
    for el, (pos, col) in zip(els, stops):
        el.position = pos
        el.color = (*col, 1.0) if len(col) == 3 else col
    return r.outputs['Color']

def _bump(nt, height, strength, dist=0.1, normal=None):
    b = nt.nodes.new('ShaderNodeBump')
    b.inputs['Strength'].default_value = strength
    b.inputs['Distance'].default_value = dist
    nt.links.new(height, b.inputs['Height'])
    if normal is not None:
        nt.links.new(normal, b.inputs['Normal'])
    return b.outputs['Normal']

def plain(name, color, rough=0.5, metallic=0.0, spec=0.5, coat=0.0, sheen=0.0):
    m, nt, p = _mat(name)
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Specular IOR Level'].default_value = spec
    p.inputs['Coat Weight'].default_value = coat
    p.inputs['Sheen Weight'].default_value = sheen
    return m

def plaster(name, color=(0.86, 0.84, 0.80), var=0.04, bump=0.06, scale=1.0):
    m, nt, p = _mat(name)
    co = _tex_coord(nt)
    n1 = _noise(nt, co, 0.6 * scale, 4, 0.5)
    n2 = _noise(nt, co, 18 * scale, 8, 0.6)
    c2 = tuple(max(0, c - var) for c in color)
    col = _mix_col(nt, n1.outputs['Fac'], color, c2)
    nt.links.new(col, p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = 0.88
    p.inputs['Specular IOR Level'].default_value = 0.3
    nt.links.new(_bump(nt, n2.outputs['Fac'], bump, 0.02), p.inputs['Normal'])
    return m

def stone(name, base=(0.55, 0.47, 0.38), scale=2.2, mortar=(0.62, 0.58, 0.52)):
    m, nt, p = _mat(name)
    co = _tex_coord(nt)
    warp = _noise(nt, co, 1.2, 3, 0.5)
    vadd = nt.nodes.new('ShaderNodeVectorMath'); vadd.operation = 'ADD'
    sc = nt.nodes.new('ShaderNodeVectorMath'); sc.operation = 'SCALE'
    sc.inputs['Scale'].default_value = 0.25
    nt.links.new(warp.outputs['Color'], sc.inputs[0])
    nt.links.new(co, vadd.inputs[0]); nt.links.new(sc.outputs[0], vadd.inputs[1])
    vor = nt.nodes.new('ShaderNodeTexVoronoi'); vor.feature = 'DISTANCE_TO_EDGE'
    vor.inputs['Scale'].default_value = scale
    nt.links.new(vadd.outputs[0], vor.inputs['Vector'])
    vcol = nt.nodes.new('ShaderNodeTexVoronoi'); vcol.feature = 'F1'
    vcol.inputs['Scale'].default_value = scale
    nt.links.new(vadd.outputs[0], vcol.inputs['Vector'])
    edge = _ramp(nt, vor.outputs['Distance'], [(0.0, (0, 0, 0)), (0.06, (1, 1, 1))])
    stone_var = _ramp(nt, vcol.outputs['Color'], [(0.0, tuple(c * 0.75 for c in base)), (0.5, base), (1.0, tuple(min(1, c * 1.22) for c in base))])
    grain = _noise(nt, co, 25, 8, 0.7)
    col = _mix_col(nt, edge, mortar, stone_var)
    col2 = _mix_col(nt, 0.25, col, grain.outputs['Color'])
    nt.links.new(col2, p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = 0.85
    h = nt.nodes.new('ShaderNodeMath'); h.operation = 'ADD'
    nt.links.new(edge, h.inputs[0]); nt.links.new(grain.outputs['Fac'], h.inputs[1])
    nt.links.new(_bump(nt, h.outputs[0], 0.5, 0.05), p.inputs['Normal'])
    return m

def paving(name, base=(0.78, 0.72, 0.62), tile=0.9, rough=0.55):
    m, nt, p = _mat(name)
    co = _tex_coord(nt)
    b = nt.nodes.new('ShaderNodeTexBrick')
    b.offset = 0.5
    b.inputs['Scale'].default_value = 1.0 / tile
    b.inputs['Mortar Size'].default_value = 0.004
    b.inputs['Brick Width'].default_value = 1.0
    b.inputs['Row Height'].default_value = 0.5
    b.inputs['Color1'].default_value = (*base, 1)
    b.inputs['Color2'].default_value = (*tuple(c * 0.93 for c in base), 1)
    b.inputs['Mortar'].default_value = (*tuple(c * 0.8 for c in base), 1)
    nt.links.new(co, b.inputs['Vector'])
    n = _noise(nt, co, 6, 6, 0.6)
    col = _mix_col(nt, 0.12, b.outputs['Color'], n.outputs['Color'])
    nt.links.new(col, p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = rough
    inv = nt.nodes.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'
    inv.inputs[0].default_value = 1.0
    nt.links.new(b.outputs['Fac'], inv.inputs[1])
    nt.links.new(_bump(nt, inv.outputs[0], 0.3, 0.02), p.inputs['Normal'])
    return m

def wood(name, base=(0.36, 0.22, 0.12), scale=3.0, rough=0.5, stretch=(1, 1, 18)):
    m, nt, p = _mat(name)
    co = _tex_coord(nt)
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = stretch
    nt.links.new(co, mp.inputs['Vector'])
    n = _noise(nt, mp.outputs['Vector'], scale, 8, 0.6)
    col = _ramp(nt, n.outputs['Fac'], [(0.3, tuple(c * 0.7 for c in base)), (0.5, base), (0.7, tuple(min(1, c * 1.25) for c in base))])
    nt.links.new(col, p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = rough
    nt.links.new(_bump(nt, n.outputs['Fac'], 0.08, 0.01), p.inputs['Normal'])
    return m

def glass(name, tint=(0.92, 0.95, 0.95), rough=0.0):
    # thin architectural glazing: refracts for camera rays, lets light and shadows through
    m, nt, p = _mat(name)
    p.inputs['Base Color'].default_value = (*tint, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Transmission Weight'].default_value = 1.0
    p.inputs['IOR'].default_value = 1.45
    out = nt.nodes['Material Output']
    lp = nt.nodes.new('ShaderNodeLightPath')
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mx = nt.nodes.new('ShaderNodeMixShader')
    add = nt.nodes.new('ShaderNodeMath'); add.operation = 'MAXIMUM'
    nt.links.new(lp.outputs['Is Shadow Ray'], add.inputs[0])
    nt.links.new(lp.outputs['Is Diffuse Ray'], add.inputs[1])
    nt.links.new(add.outputs[0], mx.inputs['Fac'])
    nt.links.new(p.outputs['BSDF'], mx.inputs[1])
    nt.links.new(tr.outputs['BSDF'], mx.inputs[2])
    nt.links.new(mx.outputs['Shader'], out.inputs['Surface'])
    return m

def water(name, tint=(0.75, 0.93, 0.92), wave=2.5, strength=0.12):
    m, nt, p = _mat(name)
    co = _tex_coord(nt)
    p.inputs['Base Color'].default_value = (*tint, 1)
    p.inputs['Roughness'].default_value = 0.01
    p.inputs['Transmission Weight'].default_value = 1.0
    p.inputs['IOR'].default_value = 1.333
    n = _noise(nt, co, wave, 4, 0.5)
    nt.links.new(_bump(nt, n.outputs['Fac'], strength, 0.05), p.inputs['Normal'])
    out = nt.nodes['Material Output']
    lp = nt.nodes.new('ShaderNodeLightPath')
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    tr.inputs['Color'].default_value = (*tint, 1)
    mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lp.outputs['Is Shadow Ray'], mx.inputs['Fac'])
    nt.links.new(p.outputs['BSDF'], mx.inputs[1])
    nt.links.new(tr.outputs['BSDF'], mx.inputs[2])
    nt.links.new(mx.outputs['Shader'], out.inputs['Surface'])
    return m

def sea(name, deep=(0.004, 0.03, 0.05), wave=0.08, fine=1.2, strength=0.35):
    m, nt, p = _mat(name)
    co = _tex_coord(nt)
    p.inputs['Base Color'].default_value = (*deep, 1)
    p.inputs['Roughness'].default_value = 0.035
    p.inputs['IOR'].default_value = 1.333
    p.inputs['Specular IOR Level'].default_value = 0.6
    n1 = _noise(nt, co, wave, 6, 0.6)
    n2 = _noise(nt, co, fine, 4, 0.5)
    add = nt.nodes.new('ShaderNodeMath'); add.operation = 'ADD'
    nt.links.new(n1.outputs['Fac'], add.inputs[0])
    sc = nt.nodes.new('ShaderNodeMath'); sc.operation = 'MULTIPLY'; sc.inputs[1].default_value = 0.35
    nt.links.new(n2.outputs['Fac'], sc.inputs[0])
    nt.links.new(sc.outputs[0], add.inputs[1])
    nt.links.new(_bump(nt, add.outputs[0], strength, 0.4), p.inputs['Normal'])
    return m

def emission(name, color=(1.0, 0.72, 0.45), strength=6.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL':
            nt.nodes.remove(n)
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = (*color, 1)
    e.inputs['Strength'].default_value = strength
    nt.links.new(e.outputs['Emission'], nt.nodes['Material Output'].inputs['Surface'])
    return m

def foliage(name, color=(0.06, 0.1, 0.04), var=0.35, scale=3.0):
    m, nt, p = _mat(name)
    co = _tex_coord(nt)
    n = _noise(nt, co, scale, 6, 0.65)
    dark = tuple(c * (1 - var) for c in color)
    light = tuple(min(1, c * (1 + var * 1.6)) for c in color)
    col = _ramp(nt, n.outputs['Fac'], [(0.35, dark), (0.65, light)])
    nt.links.new(col, p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = 0.75
    p.inputs['Subsurface Weight'].default_value = 0.15
    p.inputs['Sheen Weight'].default_value = 0.4
    n2 = _noise(nt, co, scale * 12, 4, 0.6)
    nt.links.new(_bump(nt, n2.outputs['Fac'], 0.6, 0.05), p.inputs['Normal'])
    return m

def gravel(name, base=(0.62, 0.6, 0.56), scale=40.0):
    m, nt, p = _mat(name)
    co = _tex_coord(nt)
    vor = nt.nodes.new('ShaderNodeTexVoronoi')
    vor.inputs['Scale'].default_value = scale
    nt.links.new(co, vor.inputs['Vector'])
    col = _ramp(nt, vor.outputs['Color'], [(0.0, tuple(c * 0.7 for c in base)), (0.5, base), (1.0, tuple(min(1, c * 1.15) for c in base))])
    nt.links.new(col, p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = 0.8
    nt.links.new(_bump(nt, vor.outputs['Distance'], 0.8, 0.02), p.inputs['Normal'])
    return m

def grass(name, color=(0.06, 0.1, 0.03)):
    m, nt, p = _mat(name)
    co = _tex_coord(nt)
    n1 = _noise(nt, co, 1.5, 4, 0.5)
    n2 = _noise(nt, co, 220, 2, 0.5)
    col = _ramp(nt, n1.outputs['Fac'], [(0.3, tuple(c * 0.7 for c in color)), (0.7, tuple(min(1, c * 1.4) for c in color))])
    col2 = _mix_col(nt, n2.outputs['Fac'], col, tuple(min(1, c * 1.6) for c in color))
    nt.links.new(col2, p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = 0.95
    p.inputs['Specular IOR Level'].default_value = 0.15
    p.inputs['Sheen Weight'].default_value = 0.15
    nt.links.new(_bump(nt, n2.outputs['Fac'], 1.0, 0.02), p.inputs['Normal'])
    return m

def terrain_mat(name, rock=(0.5, 0.42, 0.33), dry=(0.42, 0.37, 0.22), scrub=(0.12, 0.14, 0.06)):
    m, nt, p = _mat(name)
    co = _tex_coord(nt)
    n1 = _noise(nt, co, 0.08, 6, 0.6)
    n2 = _noise(nt, co, 0.6, 8, 0.65)
    n3 = _noise(nt, co, 9.0, 8, 0.7)
    c1 = _ramp(nt, n1.outputs['Fac'], [(0.42, rock), (0.58, dry)])
    sc = _ramp(nt, n2.outputs['Fac'], [(0.55, (0, 0, 0)), (0.62, (1, 1, 1))])
    col = _mix_col(nt, sc, c1, scrub)
    col2 = _mix_col(nt, 0.2, col, n3.outputs['Color'])
    nt.links.new(col2, p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = 0.92
    h = nt.nodes.new('ShaderNodeMath'); h.operation = 'ADD'
    nt.links.new(n2.outputs['Fac'], h.inputs[0]); nt.links.new(n3.outputs['Fac'], h.inputs[1])
    nt.links.new(_bump(nt, h.outputs[0], 0.7, 0.3), p.inputs['Normal'])
    return m

def tiles(name, base=(0.3, 0.55, 0.58), glow=0.0, glow_col=(0.25, 0.75, 0.85), tile=0.05):
    m, nt, p = _mat(name)
    co = _tex_coord(nt)
    b = nt.nodes.new('ShaderNodeTexBrick')
    b.offset = 0.0
    b.inputs['Scale'].default_value = 1 / tile
    b.inputs['Mortar Size'].default_value = 0.06
    b.inputs['Brick Width'].default_value = 1.0
    b.inputs['Row Height'].default_value = 1.0
    b.inputs['Color1'].default_value = (*base, 1)
    b.inputs['Color2'].default_value = (*tuple(c * 0.92 for c in base), 1)
    b.inputs['Mortar'].default_value = (*tuple(min(1, c * 1.3) for c in base), 1)
    nt.links.new(co, b.inputs['Vector'])
    nt.links.new(b.outputs['Color'], p.inputs['Base Color'])
    p.inputs['Roughness'].default_value = 0.2
    if glow > 0:
        p.inputs['Emission Color'].default_value = (*glow_col, 1)
        p.inputs['Emission Strength'].default_value = glow
    return m

# ---------------------------------------------------------------- geometry
def _link(obj, coll=None):
    (coll or bpy.context.scene.collection).objects.link(obj)
    return obj

def mesh_obj(name, verts, faces, mat=None, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    if smooth:
        for poly in me.polygons:
            poly.use_smooth = True
    o = bpy.data.objects.new(name, me)
    if mat:
        me.materials.append(mat)
    return _link(o)

def box(name, x0, x1, y0, y1, z0, z1, mat=None, bevel=0.0, seg=3):
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    o = mesh_obj(name, v, f, mat)
    if bevel > 0:
        md = o.modifiers.new('bevel', 'BEVEL')
        md.width = bevel
        md.segments = seg
        md.limit_method = 'ANGLE'
        md.harden_normals = True
        for poly in o.data.polygons:
            poly.use_smooth = True
    return o

def cylinder(name, cx, cy, r, z0, z1, mat=None, n=24, r_top=None, smooth=True):
    r_top = r if r_top is None else r_top
    verts, faces = [], []
    for i in range(n):
        a = 2 * math.pi * i / n
        verts.append((cx + r * math.cos(a), cy + r * math.sin(a), z0))
    for i in range(n):
        a = 2 * math.pi * i / n
        verts.append((cx + r_top * math.cos(a), cy + r_top * math.sin(a), z1))
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, n + j, n + i))
    faces.append(tuple(range(n - 1, -1, -1)))
    faces.append(tuple(range(n, 2 * n)))
    o = mesh_obj(name, verts, faces, mat)
    if smooth:
        for k, poly in enumerate(o.data.polygons):
            poly.use_smooth = k < n
    return o

def blob(name, center, radius, scale=(1, 1, 1), mat=None, seed=0, subdiv=3, disp=0.35, freq=1.6):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    off = Vector((seed * 7.31, seed * 3.17, seed * 5.71))
    for v in bm.verts:
        d = v.co.normalized()
        nval = noise.fractal(d * freq + off, 0.6, 2.0, 4)
        lump = 1.0 + disp * nval
        v.co = Vector((d.x * scale[0], d.y * scale[1], d.z * scale[2])) * radius * lump
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    if mat:
        me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    o.location = center
    return _link(o)

def instance(src, name, loc, rot_z=0.0, scale=1.0):
    o = bpy.data.objects.new(name, src.data)
    o.location = loc
    o.rotation_euler = (0, 0, rot_z)
    o.scale = (scale, scale, scale)
    o.modifiers.clear()
    for md in src.modifiers:
        n = o.modifiers.new(md.name, md.type)
        for attr in ('width', 'segments', 'limit_method'):
            if hasattr(md, attr):
                setattr(n, attr, getattr(md, attr))
    return _link(o)

def grid_terrain(name, x0, x1, y0, y1, nx, ny, hfun, mat):
    verts, faces = [], []
    for j in range(ny + 1):
        y = y0 + (y1 - y0) * j / ny
        for i in range(nx + 1):
            x = x0 + (x1 - x0) * i / nx
            verts.append((x, y, hfun(x, y)))
    w = nx + 1
    for j in range(ny):
        for i in range(nx):
            a = j * w + i
            faces.append((a, a + 1, a + w + 1, a + w))
    return mesh_obj(name, verts, faces, mat, smooth=True)

def camera(name, loc, target, lens=24, shift_x=0.0, shift_y=0.0, level=True, roll=0.0):
    c = bpy.data.cameras.new(name)
    c.lens = lens
    c.sensor_width = 36
    c.shift_x = shift_x
    c.shift_y = shift_y
    c.clip_start = 0.1
    c.clip_end = 60000
    o = bpy.data.objects.new(name, c)
    _link(o)
    o.location = loc
    d = Vector(target) - Vector(loc)
    yaw = math.atan2(d.y, d.x) - math.pi / 2
    if level:
        pitch = math.pi / 2
    else:
        pitch = math.pi / 2 + math.atan2(d.z, math.hypot(d.x, d.y))
    o.rotation_euler = (pitch, roll, yaw)
    return o

def render(cam, path):
    sc = bpy.context.scene
    sc.camera = cam
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)

# ---------------------------------------------------------------- vegetation
def cypress(name, x, y, z, h, mat, seed=0):
    o = blob(name, (x, y, z + h * 0.5), 1.0, (h * 0.085, h * 0.085, h * 0.5), mat, seed, 4, 0.18, 2.4)
    return o

def olive(name, x, y, z, s, leaf, bark, seed=0):
    rnd = random.Random(seed)
    parts = []
    parts.append(cylinder(name + '_t', x, y, 0.22 * s, z, z + 1.6 * s, bark, 10, 0.16 * s))
    for k in range(14):
        a = rnd.uniform(0, 2 * math.pi)
        rr = rnd.uniform(0.2, 1.6) * s
        cz = z + rnd.uniform(1.8, 3.3) * s
        parts.append(blob(f'{name}_c{k}', (x + rr * math.cos(a), y + rr * math.sin(a), cz), rnd.uniform(0.45, 0.8) * s, (1.3, 1.3, 0.75), leaf, seed * 10 + k, 4, 0.5, 3.0))
    return parts

def umbrella_pine(name, x, y, z, s, leaf, bark, seed=0):
    rnd = random.Random(seed)
    parts = [cylinder(name + '_t', x, y, 0.25 * s, z, z + 7.0 * s, bark, 10, 0.16 * s)]
    for k in range(5):
        a = rnd.uniform(0, 2 * math.pi)
        rr = rnd.uniform(0.5, 2.2) * s
        parts.append(blob(f'{name}_c{k}', (x + rr * math.cos(a), y + rr * math.sin(a), z + rnd.uniform(7.2, 8.0) * s), rnd.uniform(1.6, 2.4) * s, (1.4, 1.4, 0.45), leaf, seed * 10 + k, 3, 0.4, 2.0))
    return parts

def shrub(name, x, y, z, r, mat, seed=0):
    return blob(name, (x, y, z + r * 0.55), r, (1.15, 1.15, 0.75), mat, seed, 3, 0.4, 2.2)
