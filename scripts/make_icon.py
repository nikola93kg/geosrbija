#!/usr/bin/env python3
"""Generates mipmap-*/ic_launcher.png from assets/img/app_icon_geosrbija.png."""
import os
from PIL import Image

APP = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
img = Image.open(os.path.join(APP, 'assets', 'img', 'app_icon_geosrbija.png')).convert('RGBA')

for bucket, size in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    out = os.path.join(APP, 'res', 'mipmap-' + bucket)
    os.makedirs(out, exist_ok=True)
    img.resize((size, size), Image.Resampling.LANCZOS).save(os.path.join(out, 'ic_launcher.png'), optimize=True)
print('icons written')
