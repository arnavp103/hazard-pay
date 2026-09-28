"""Encode offline painter frames with a shared palette; Pillow is capture-only."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

frames, output = map(Path, sys.argv[1:])
metadata = json.loads((frames / 'metadata.json').read_text())
for sequence in metadata['sequences']:
    images = [Image.open(frames / f"{sequence['name']}-{i:03}.png").convert('RGB')
              for i in range(sequence['frames'])]
    # Build a global palette from every exposure, rather than flickering per-frame palettes.
    atlas = Image.new('RGB', (256, 152 * len(images)))
    for i, image in enumerate(images):
        atlas.paste(image.resize((256, 152), Image.Resampling.NEAREST), (0, i * 152))
    palette = atlas.quantize(colors=192, method=Image.Quantize.MEDIANCUT)
    indexed = [image.quantize(palette=palette, dither=Image.Dither.NONE) for image in images]
    # GIF centiseconds: 80,80,90 ms repeats = exact average 12 fps.
    durations = [80 if i % 3 < 2 else 90 for i in range(len(indexed))]
    indexed[0].save(output / f"{sequence['name']}.gif", save_all=True,
                    append_images=indexed[1:], duration=durations, loop=0,
                    disposal=1, optimize=True)
# Contact sheet samples the same native draws. Crop is art only, never labels/time.
frames_to_show = [('hero-motion', 0, 'IDLE'), ('hero-motion', 27, 'WALK / CONTACT'),
                  ('hero-attack', 4, 'LOAD'), ('hero-attack', 8, 'CONTACT'),
                  ('hero-attack', 13, 'FOLLOW THROUGH'), ('hero-motion', 73, 'STAGGER')]
sheet = Image.new('RGB', (1080, 570), '#17252c')
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('DejaVuSansMono.ttf', 13)
except OSError:
    font = ImageFont.load_default()
for i, (name, frame, label) in enumerate(frames_to_show):
    image = Image.open(frames / f'{name}-{frame:03}.png').convert('RGB')
    crop = image.crop((240, 170, 705, 475)).resize((348, 228), Image.Resampling.NEAREST)
    x, y = (i % 3) * 360 + 6, (i // 3) * 285
    sheet.paste(crop, (x, y + 29))
    draw.text((x + 9, y + 8), label, font=font, fill='#b5c5ac')
sheet.save(output / 'action-study.png')
