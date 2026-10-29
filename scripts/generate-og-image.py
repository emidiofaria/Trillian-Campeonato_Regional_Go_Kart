"""Generates public/og-image.png (1200x630). Run once: python3 scripts/generate-og-image.py"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PILOT_COUNT = len(json.loads((ROOT / 'src/data/pilots.json').read_text(encoding='utf-8')))
W, H = 1200, 630
BG, SURFACE, TEXT, MUTED = '#0d1117', '#161b22', '#e6edf3', '#9aa4b2'
YELLOW, GREEN, RING, BORDER = '#e9be00', '#3fb950', '#82b07a', '#30363d'

img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img)

# Checkered accent band on the right edge.
sq = 30
for row in range(H // sq + 1):
    for col in range(4):
        if (row + col) % 2 == 0:
            x = W - (col + 1) * sq
            d.rectangle([x, row * sq, x + sq - 1, row * sq + sq - 1], fill='#2a313b')
# Thin yellow speed stripes.
d.rectangle([0, H - 14, W - 4 * sq, H - 8], fill=YELLOW)
d.rectangle([0, H - 26, (W - 4 * sq) * 0.6, H - 22], fill=RING)

# Logo with ring.
logo = Image.open(ROOT / 'public/trillian-logo-512.png').convert('RGBA').resize((290, 290), Image.LANCZOS)
cx, cy, r = 920, 300, 160
d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=SURFACE, outline=RING, width=6)
img.paste(logo, (cx - 145, cy - 145), logo)

display = lambda s: ImageFont.truetype(str(ROOT / 'public/fonts/barlow-condensed-latin-700-normal.woff2'), s)
semi = lambda s: ImageFont.truetype(str(ROOT / 'public/fonts/barlow-condensed-latin-600-normal.woff2'), s)
body = lambda s: ImageFont.truetype(str(ROOT / 'public/fonts/inter-latin-wght-normal.woff2'), s)

d.text((80, 110), 'CAMPEONATO DE KARTING', font=semi(34), fill=YELLOW)
d.text((76, 150), 'Kart Cup 2026', font=display(118), fill=TEXT)
d.text((80, 305), f'7 Grandes Prémios · {PILOT_COUNT} pilotos', font=body(30), fill=MUTED)
d.text((80, 350), 'Classificação, calendário e regulamento', font=body(30), fill=MUTED)

# Sponsor pill.
pill = 'Patrocinador oficial: Trillian Driving Coach'
f = semi(30)
tw = d.textlength(pill, font=f)
d.rounded_rectangle([80, 460, 80 + tw + 48, 516], radius=28, outline=GREEN, width=3, fill=SURFACE)
d.text((104, 469), pill, font=f, fill=TEXT)

img.save(ROOT / 'public/og-image.png', optimize=True)
print('wrote public/og-image.png', img.size)
