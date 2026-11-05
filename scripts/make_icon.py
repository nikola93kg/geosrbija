#!/usr/bin/env python3
"""Draws the GeoSrbija launcher icon (blue tile, green Serbia silhouette, red pin) into res/mipmap-*."""
import json, math, os
from PIL import Image, ImageDraw

APP = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
src = open(os.path.join(APP, 'assets', 'map.js'), encoding='utf-8').read()
geo = json.loads(src[src.index('{'):src.rindex('}') + 1])

S = 512
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([0, 0, S - 1, S - 1], radius=96, fill=(10, 46, 93, 255))

cos0 = math.cos(math.radians(44))
rings = [r for country in geo['outline'] for r in country]
xs = [p[0] * cos0 for r in rings for p in r]
ys = [-p[1] for r in rings for p in r]
scale = 380 / max(max(xs) - min(xs), max(ys) - min(ys))
ox = (S - (max(xs) - min(xs)) * scale) / 2
oy = (S - (max(ys) - min(ys)) * scale) / 2
polys = [[(ox + (p[0] * cos0 - min(xs)) * scale, oy + (-p[1] - min(ys)) * scale) for p in r] for r in rings]
for pts in polys:  # outline pass first so the Serbia/Kosovo seam is hidden by the fill pass
    d.line(pts + pts[:1], fill=(255, 255, 255, 255), width=16, joint='curve')
for pts in polys:
    d.polygon(pts, fill=(67, 182, 73, 255))

# Red pin roughly over central Serbia
cx, cy, rr = S * 0.5, S * 0.42, 54
d.polygon([(cx - rr * 0.8, cy + rr * 0.45), (cx + rr * 0.8, cy + rr * 0.45), (cx, cy + rr * 2.1)], fill=(214, 40, 40, 255))
d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=(214, 40, 40, 255))
d.ellipse([cx - rr * 0.4, cy - rr * 0.4, cx + rr * 0.4, cy + rr * 0.4], fill=(255, 255, 255, 255))

for bucket, size in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    out = os.path.join(APP, 'res', 'mipmap-' + bucket)
    os.makedirs(out, exist_ok=True)
    img.resize((size, size), Image.Resampling.LANCZOS).save(os.path.join(out, 'ic_launcher.png'), optimize=True)
print('icons written')
