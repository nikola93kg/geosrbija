#!/usr/bin/env python3
"""Draws the GeoSrbija launcher icon using assets/img/geoSrbija.png over a rounded navy tile."""
import os
from PIL import Image, ImageDraw

APP = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
S = 512
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([0, 0, S - 1, S - 1], radius=104, fill=(10, 46, 93, 255))

logo = Image.open(os.path.join(APP, 'assets', 'img', 'geoSrbija.png')).convert('RGBA')
lw, lh = logo.size
tw = int(S * 0.88)
th = int(lh * tw / lw)
logo = logo.resize((tw, th), Image.Resampling.LANCZOS)
img.paste(logo, ((S - tw) // 2, (S - th) // 2), logo)

for bucket, size in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    out = os.path.join(APP, 'res', 'mipmap-' + bucket)
    os.makedirs(out, exist_ok=True)
    img.resize((size, size), Image.Resampling.LANCZOS).save(os.path.join(out, 'ic_launcher.png'), optimize=True)
print('icons written')
