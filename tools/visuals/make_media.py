#!/usr/bin/env python3
"""Turns the rendered stills into the site's films and images.

Each still is graded (gentle S-curve, a touch of colour, vignette), then films are cut as slow push-ins
and drifts (Ken Burns) that dissolve into one another and close into a seamless loop.

usage: python3 tools/visuals/make_media.py tools/visuals/out . [film|image ...]
"""
import os, subprocess, sys
import numpy as np
from PIL import Image

STILLS, ROOT = sys.argv[1], sys.argv[2]
ONLY = set(sys.argv[3:])
OUT_W, OUT_H, FPS = 1600, 900, 30
SRC_W, SRC_H = 1760, 990          # stills are reduced to this, so a 1.0-1.1 zoom maps ~1:1 onto 1600x900
T, F = 5.0, 1.2                    # seconds each shot holds, dissolve length

# shot = (still, zoom from, zoom to, (centre x, y) from, (centre x, y) to), centres as fractions of the frame
FILMS = {
    'villas': [
        ('villa-a-east-blue', 1.0, 1.08, (0.5, 0.52), (0.46, 0.5)),
        ('villa-b-hero-sunset', 1.08, 1.0, (0.56, 0.5), (0.5, 0.5)),
        ('villa-a-front-sunset', 1.0, 1.08, (0.5, 0.5), (0.52, 0.47)),
    ],
    'residences': [
        ('villa-a-west-blue', 1.0, 1.08, (0.55, 0.5), (0.6, 0.48)),
        ('villa-b-front-blue', 1.08, 1.0, (0.5, 0.46), (0.5, 0.5)),
        ('interior-living-sunset', 1.0, 1.08, (0.45, 0.5), (0.52, 0.5)),
    ],
    'homes': [
        ('villa-a-pergola-sunset', 1.0, 1.08, (0.5, 0.5), (0.56, 0.48)),
        ('interior-dining-sunset', 1.08, 1.0, (0.58, 0.48), (0.5, 0.5)),
        ('villa-b-garden-golden', 1.0, 1.08, (0.5, 0.5), (0.44, 0.48)),
    ],
}
# still -> (output, width, height, focus x)
IMAGES = {
    'interior-bedroom-morning': ('img/benefits/healthcare.jpg', 1100, 1100, 0.5),
    'villa-b-detail-sunset': ('img/benefits/investment.jpg', 1100, 1100, 0.42),
    'villa-a-pool-sunset': ('img/benefits/lifestyle.jpg', 1100, 1100, 0.5),
    'interior-study-golden': ('img/benefits/education.jpg', 1100, 1100, 0.32),
}

def grade(name):
    im = Image.open(os.path.join(STILLS, name + '.png')).convert('RGB')
    x = np.asarray(im).astype(np.float32) / 255.0
    # gentle S-curve on luminance, keeping hue
    luma = (0.2126 * x[..., 0] + 0.7152 * x[..., 1] + 0.0722 * x[..., 2])[..., None]
    s = 1 / (1 + np.exp(-5.0 * (luma - 0.5)))
    s = (s - 1 / (1 + np.exp(2.5))) / (1 / (1 + np.exp(-2.5)) - 1 / (1 + np.exp(2.5)))
    target = 0.55 * s + 0.45 * luma
    x = x * (target / np.maximum(luma, 1e-4))
    # a touch more colour
    luma = (0.2126 * x[..., 0] + 0.7152 * x[..., 1] + 0.0722 * x[..., 2])[..., None]
    x = luma + (x - luma) * 1.12
    # soft vignette
    h, w = x.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2) / np.sqrt(2)
    x = x * (1 - 0.22 * r ** 2.2)[..., None]
    return Image.fromarray((np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8))

def shot_frame(src, u, spec):
    """Frame of a shot at local time u (0 .. T+F seconds)."""
    _, z0, z1, c0, c1 = spec
    k = u / (T + F)
    z = z0 + (z1 - z0) * k
    cx = (c0[0] + (c1[0] - c0[0]) * k) * SRC_W
    cy = (c0[1] + (c1[1] - c0[1]) * k) * SRC_H
    cw, ch = SRC_W / z, SRC_H / z
    cx = min(max(cx, cw / 2), SRC_W - cw / 2)
    cy = min(max(cy, ch / 2), SRC_H - ch / 2)
    a, e = cw / OUT_W, ch / OUT_H
    data = (a, 0, cx - cw / 2 + 0.5 * a - 0.5, 0, e, cy - ch / 2 + 0.5 * e - 0.5)
    return np.asarray(src.transform((OUT_W, OUT_H), Image.Transform.AFFINE, data, resample=Image.Resampling.BICUBIC)).astype(np.float32)

def make_film(name, shots):
    srcs = [grade(s[0]).resize((SRC_W, SRC_H), Image.Resampling.LANCZOS) for s in shots]
    n = len(shots)
    total = int(round(n * T * FPS))
    mp4 = os.path.join(ROOT, 'video', name + '.mp4')
    webm = os.path.join(ROOT, 'video', name + '.webm')
    cmd = ['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{OUT_W}x{OUT_H}', '-r', str(FPS), '-i', '-',
           '-map', '0', '-c:v', 'libx264', '-preset', 'slow', '-tune', 'film', '-crf', '21', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.0', '-g', '60', '-movflags', '+faststart', mp4,
           '-map', '0', '-c:v', 'libvpx-vp9', '-crf', '35', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-g', '60', '-pix_fmt', 'yuv420p', webm]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    poster = None
    for f in range(total):
        t = f / FPS
        i = int(t // T)
        u = t - i * T + F               # shot i shows its local time F .. T+F over [i*T, (i+1)*T)
        frame = shot_frame(srcs[i], u, shots[i])
        nxt = (i + 1) % n
        head = t - (i + 1) * T + F      # the next shot fades in over the last F seconds of this one
        if head > 0:
            w = head / F
            w = w * w * (3 - 2 * w)
            frame = frame * (1 - w) + shot_frame(srcs[nxt], head, shots[nxt]) * w
        out = np.clip(frame + 0.5, 0, 255).astype(np.uint8)
        if f == 0:
            poster = out
        proc.stdin.write(out.tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise SystemExit(f'ffmpeg failed for {name}')
    Image.fromarray(poster).save(os.path.join(ROOT, 'img', 'hero', name + '.jpg'), quality=84, optimize=True, progressive=True)
    print(name, 'film', total / FPS, 's', os.path.getsize(mp4) // 1024, 'KB mp4', os.path.getsize(webm) // 1024, 'KB webm')

def make_image(still, spec):
    out, w, h, fx = spec
    im = grade(still)
    W, H = im.size
    scale = max(w / W, h / H)
    cw, ch = w / scale, h / scale
    cx = min(max(fx * W, cw / 2), W - cw / 2)
    box = (int(round(cx - cw / 2)), int(round((H - ch) / 2)), int(round(cx + cw / 2)), int(round((H + ch) / 2)))
    im = im.crop(box).resize((w, h), Image.Resampling.LANCZOS)
    path = os.path.join(ROOT, out)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, quality=82, optimize=True, progressive=True)
    print(out, os.path.getsize(path) // 1024, 'KB')

for name, shots in FILMS.items():
    if not ONLY or name in ONLY:
        make_film(name, shots)
for still, spec in IMAGES.items():
    if not ONLY or still in ONLY or spec[0] in ONLY:
        make_image(still, spec)
