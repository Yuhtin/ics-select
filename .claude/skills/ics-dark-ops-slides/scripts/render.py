#!/usr/bin/env python3
"""Renderiza um deck (modo ?print=1) com o Chrome headless, corta um PNG por slide
e monta um contact sheet pra conferir tudo numa leva só.

uso: python3 render.py <deck.html> [out_dir]
"""
import os, subprocess, sys
from PIL import Image

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
W, H, GAP = 1280, 720, 24

deck = os.path.abspath(sys.argv[1])
out = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(deck), "_render"))
os.makedirs(out, exist_ok=True)

n = open(deck, encoding="utf-8").read().count('<section class="slide')
total_h = n * (H + GAP)
subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                "--force-device-scale-factor=1", f"--window-size={W},{total_h}",
                "--virtual-time-budget=12000", f"--screenshot={out}/all.png",
                f"file://{deck}?print=1"], check=True, capture_output=True)

im = Image.open(f"{out}/all.png")
for i in range(n):
    y = i * (H + GAP)
    im.crop((0, y, W, y + H)).save(f"{out}/s{i+1:02d}.png")

cols, tw, th = 2, 640, 360
rows = (n + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * th), (30, 30, 30))
for i in range(n):
    sheet.paste(Image.open(f"{out}/s{i+1:02d}.png").resize((tw, th), Image.LANCZOS), ((i % cols) * tw, (i // cols) * th))
sheet.save(f"{out}/sheet.jpg", quality=88)
print(f"{n} slides -> {out}/sheet.jpg (+ s01..s{n:02d}.png)")
