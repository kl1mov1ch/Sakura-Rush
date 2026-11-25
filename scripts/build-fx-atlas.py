"""Pack Kenney Particle Pack (CC0, kenney.nl) textures into one FX atlas for src/vfx.js.

python3 scripts/build-fx-atlas.py <kenney_particle_pack folder>

The pack ships white-on-black PNGs; each cell stores white with alpha = brightness, so the game
tints it with any colour. The summoning circle (cell 1) is layered from three pack circles.
Cell order must match CELL in src/vfx.js.
"""
import os
import sys

from PIL import Image, ImageChops

SRC = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'art', 'fx-atlas.webp')
CELL, GRID = 256, 4

CELLS = ['circle_03', 'summon', 'magic_03', 'slash_02', 'spark_06', 'star_09', 'star_06', 'muzzle_02',
         'smoke_04', 'fire_01', 'flame_02', 'scorch_02', 'light_02', 'twirl_02', 'trace_04', 'symbol_01']


def lum(name, size=CELL):
    return Image.open(os.path.join(SRC, name + '.png')).convert('L').resize((size, size), Image.LANCZOS)


def summon():
    """Outer ring + pentagon seal + inner star, combined with lighten."""
    out = lum('circle_02')
    out = ImageChops.lighter(out, lum('magic_02').rotate(18))
    inner = lum('magic_01', int(CELL * 0.62))
    pad = Image.new('L', (CELL, CELL))
    pad.paste(inner, ((CELL - inner.width) // 2,) * 2)
    out = ImageChops.lighter(out, pad)
    star = lum('magic_04', int(CELL * 0.4))
    pad = Image.new('L', (CELL, CELL))
    pad.paste(star, ((CELL - star.width) // 2,) * 2)
    return ImageChops.lighter(out, pad)


atlas = Image.new('RGBA', (CELL * GRID, CELL * GRID), (255, 255, 255, 0))
for i, name in enumerate(CELLS):
    a = summon() if name == 'summon' else lum(name)
    cell = Image.merge('RGBA', (Image.new('L', a.size, 255),) * 3 + (a,))
    atlas.paste(cell, ((i % GRID) * CELL, (i // GRID) * CELL))
atlas.save(OUT, 'WEBP', quality=88, method=6)
print('wrote', OUT, os.path.getsize(OUT) // 1024, 'KB')
