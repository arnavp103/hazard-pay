#!/usr/bin/env python3
"""
Tilted-hero in-camera captures for the hero-design fanout.

The four surviving hero-medic designs were REDRAWN with a true dimetric
down-angle and authored natively at both hero registers (44 px and 28 px
figure height). This script puts them on the real grime-market board, under
the real fixed 2:1 dimetric camera, at 1x — one sprite pixel to one screen
pixel, no resampling anywhere.

Scene constants are lifted from the pixel lane on branch
`prototype/pixel-control-lane` (read-only, via `git show`):

  apps/webapp/src/match-proto/pixel-control-lane/crowd-scene.ts
      STAGE_W = 480, STAGE_H = 270
      small:  halfW 13, halfH 7   fodder 22 px / hero 28 px
      large:  halfW 18, halfH 9   fodder 34 px / hero 44 px
      contact shadow: ellipse(x, y+1, w/2, max(2, w/6)) @ rgb(18 11 16 / .42)
      blit anchor:    top-left = (round(x - w/2), round(y - bottomRow))
      painter's order: ascending contact row
  apps/webapp/src/match-proto/style-cohesion-assets/grime-market-board.prototype.png

ONE constant is deliberately changed from the previous round, and it is the
whole point of this pass:

  CAMERA = (-30, -62)      instead of the lane's (-178, -92)

The lane's own camera parks its anchor on the open middle of the walkable
plane. The previous fanout capture inherited that and put every hero on a
bare dark patch, which is unjudgeable — you cannot tell whether a silhouette
survives a scene from a picture with no scene in it. This camera keeps the
identical projection, aperture, scale and anchor, and only slides the window
over the populated corner of the same board: the left market stack's two
lit/shadow faces behind the squad, its ink contour, the teal and ochre floor
decals underfoot, ground clutter, grime clusters, the overhead cable and
canopy panels, and the open plane to the right. Half of each silhouette
lands on structure and half on the plane, which is the condition the game
will actually read them in.

Deliberately NOT applied, so each sprite is judged as authored:
  - the hero marking ring (approved on the lane, but it masks silhouette)
  - the background-aware contour pass (it rewrites authored pixels)
  - depth palettes / idle pose (clock frozen at 0, no bob, no lean)
"""

import io
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

LANE = "origin/prototype/pixel-control-lane"
REPO = os.environ.get("HP_REPO", os.path.expanduser("~/Downloads/projects/hazard-pay"))
HERE = os.path.dirname(os.path.abspath(__file__))


def from_lane(path):
    """Read a file off the pixel lane WITHOUT checking the branch out."""
    return subprocess.run(
        ["git", "-C", REPO, "show", f"{LANE}:{path}"],
        check=True,
        stdout=subprocess.PIPE,
    ).stdout


# --- lane constants ----------------------------------------------------
STAGE_W, STAGE_H = 480, 270
CAMERA = (-30, -62)          # populated corner of the same board (see docstring)
LANE_CAMERA = (-178, -92)    # what the previous round used
SHELL = (0x12, 0x0B, 0x10)

REGISTERS = {
    "44px": dict(hero=44, fodder=34, halfW=18, halfH=9),
    "28px": dict(hero=28, fodder=22, halfW=13, halfH=7),
}

# Feet (contact row) of the subject hero, in stage pixels. Unchanged from the
# previous round, and identical for both registers, so the only things that
# move between any two captures here are the artwork and its size.
ANCHOR = (214, 196)

# Fodder tiles around the hero in the dimetric rank/file frame.
#   screen dx = (rank - file) * halfW ;  screen dy = (rank + file) * halfH
# Three of the six sit ONE RANK BEHIND the hero (negative depth sum), one of
# them dead astern where the hero's body should hide it. That is the
# depth-occlusion question this sheet exists to expose.
FODDER_TILES = [
    (-1, -1),   # dead astern, one rank back  -> should be occluded
    (-1, 0),    # back-left, one rank back
    (0, -1),    # back-right, one rank back
    (-1, 1),    # left flank, same rank
    (1, -1),    # right flank, same rank
    (1, 0),     # front-right, one rank forward -> occludes the hero
]

STYLE_ORDER = [
    "flat-graphic",
    "chunky-silhouette",
    "quasimorph-grime",
    "metal-slug-tactics",
]

# Glyphs each redraw uses for its own authored cast shadow on the ground.
# These are excluded from the figure bbox so the anchor is taken from the
# BODY, not from the shadow's offset tail — otherwise a design with a longer
# cast shadow would silently stand further left and higher than its peers.
SHADOW_GLYPHS = {
    "flat-graphic": set(",."),
    "chunky-silhouette": set("no"),
    "quasimorph-grime": set("oO"),
    "metal-slug-tactics": set("OJ"),
}

REFERENCE = "lane-reference-mara"

BOARD = Image.open(
    io.BytesIO(
        from_lane("apps/webapp/src/match-proto/style-cohesion-assets/grime-market-board.prototype.png")
    )
).convert("RGB")

FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 13)
FONT_S = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 11)
FONT_XS = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 10)
FONT_BIG = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 17)

INK_EDGE = (0x3D, 0x29, 0x39)
CTRL_EDGE = (0xAD, 0x56, 0x38)


# --- grid -> rgba ------------------------------------------------------
def grid_rgba(spec):
    """Authored grid -> uint8 RGBA. #rrggbb or #rrggbbaa both honoured."""
    rows = spec["rows"]
    legend = spec["legend"]
    h = len(rows)
    w = max(len(r) for r in rows)
    out = np.zeros((h, w, 4), dtype=np.uint8)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == " ":
                continue
            hexv = legend.get(ch)
            if hexv is None:
                continue
            s = hexv.lstrip("#")
            v = int(s, 16)
            if len(s) == 8:
                out[y, x] = [(v >> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255]
            else:
                out[y, x] = [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255]
    return out


def figure_mask(spec, shadow_glyphs):
    """Boolean mask of BODY pixels — authored ground shadow excluded."""
    rows = spec["rows"]
    h = len(rows)
    w = max(len(r) for r in rows)
    m = np.zeros((h, w), dtype=bool)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == " " or ch in shadow_glyphs or ch not in spec["legend"]:
                continue
            m[y, x] = True
    return m


class Sprite:
    """
    A blittable unit. `rgba` is the full authored canvas (body + any authored
    ground shadow); `fx0/fx1/fy1` are the BODY bbox used for anchoring.
    """

    def __init__(self, rgba, fx0, fx1, fy0, fy1, shadow_px=0):
        self.rgba = rgba
        self.fx0, self.fx1, self.fy0, self.fy1 = fx0, fx1, fy0, fy1
        self.fig_w = fx1 - fx0 + 1
        self.fig_h = fy1 - fy0 + 1
        self.shadow_px = int(shadow_px)

    def origin(self, cx, feet_y):
        """Top-left blit origin for the whole canvas, from the lane anchor rule."""
        ox = int(round(cx - self.fig_w / 2)) - self.fx0
        oy = int(feet_y - self.fy1)
        return ox, oy

    def body(self):
        return self.rgba[self.fy0 : self.fy1 + 1, self.fx0 : self.fx1 + 1]

    def foot_width(self):
        a = np.zeros(self.rgba.shape[:2], dtype=bool)
        a[self.fy0 : self.fy1 + 1, self.fx0 : self.fx1 + 1] = (
            self.rgba[self.fy0 : self.fy1 + 1, self.fx0 : self.fx1 + 1, 3] > 0
        )
        widest = 0
        for y in range(max(self.fy0, self.fy1 - 2), self.fy1 + 1):
            xs = np.nonzero(a[y])[0]
            if xs.size:
                widest = max(widest, int(xs.max() - xs.min() + 1))
        return widest


def sprite_from_spec(spec, shadow_glyphs=frozenset()):
    rgba = grid_rgba(spec)
    fm = figure_mask(spec, shadow_glyphs)
    ys, xs = np.nonzero(fm)
    shadow_px = int(((rgba[:, :, 3] > 0) & ~fm).sum())
    return Sprite(rgba, int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max()), shadow_px)


def sprite_from_rgba(rgba):
    ys, xs = np.nonzero(rgba[:, :, 3] > 0)
    return Sprite(rgba, int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max()))


# --- old flat-elevation grids, downsampled exactly as the last round did ---
def palette_array(spec):
    cols = []
    for hexv in spec["legend"].values():
        s = hexv.lstrip("#")
        v = int(s[:6], 16)
        cols.append([(v >> 16) & 255, (v >> 8) & 255, v & 255])
    return np.array(cols, dtype=np.float64)


def downsample(spec, target_h):
    """Verbatim from in-camera/render-in-camera.py so BEFORE stays BEFORE."""
    rgba = grid_rgba(spec).astype(np.float64)
    ys, xs = np.nonzero(rgba[:, :, 3] > 0)
    crop = rgba[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    fh, fw = crop.shape[0], crop.shape[1]
    scale = target_h / fh
    tw = max(1, int(round(fw * scale)))
    th = target_h

    a = crop[:, :, 3] / 255.0
    pm = np.dstack([crop[:, :, i] * a for i in range(3)] + [a])

    def box(chan):
        im = Image.fromarray(chan.astype(np.float32), mode="F")
        return np.asarray(im.resize((tw, th), Image.BOX), dtype=np.float64)

    ra, ga, ba, aa = (box(pm[:, :, i]) for i in range(4))
    mask = aa >= 0.5
    safe = np.where(aa > 1e-6, aa, 1.0)
    rgb = np.clip(np.dstack([ra / safe, ga / safe, ba / safe]), 0, 255)

    pal = palette_array(spec)
    flat = rgb.reshape(-1, 3)
    d = ((flat[:, None, :] - pal[None, :, :]) ** 2).sum(axis=2)
    snapped = pal[d.argmin(axis=1)].reshape(th, tw, 3)

    out = np.zeros((th, tw, 4), dtype=np.uint8)
    out[:, :, :3] = snapped.astype(np.uint8)
    out[:, :, 3] = np.where(mask, 255, 0)
    ys, xs = np.nonzero(out[:, :, 3] > 0)
    return out[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]


# --- board / stage -----------------------------------------------------
def blank_stage(camera=CAMERA):
    st = Image.new("RGB", (STAGE_W, STAGE_H), SHELL)
    st.paste(BOARD, camera)
    return st


def contact_shadow(draw, x, y, foot_w):
    """Identical treatment for every unit, hero or fodder (lane rule)."""
    w = max(6, foot_w)
    rx, ry = w / 2, max(2, w / 6)
    draw.ellipse([x - rx, y + 1 - ry, x + rx, y + 1 + ry], fill=(18, 11, 16, 107))


def fodder_block(height):
    """
    Deliberately featureless stand-in at fodder register — byte-identical
    treatment to the previous round's placeholder so the before/after sheet
    changes only the hero. Neutral grey: a placeholder must not pass for
    authored art and must not borrow a design's chroma.
    """
    w = max(7, int(round(height * 0.42)))
    if w % 2 == 0:
        w += 1
    a = np.zeros((height, w, 4), dtype=np.uint8)
    ink = (0x17, 0x15, 0x1B)
    body = (0x59, 0x54, 0x60)
    lower = (0x3E, 0x3A, 0x46)
    head = (0x6E, 0x68, 0x76)
    head_h = max(3, int(round(height * 0.22)))
    hw = max(3, int(round(w * 0.62)))
    if hw % 2 == 0:
        hw += 1
    hx0 = (w - hw) // 2
    hip = int(round(height * 0.62))
    for y in range(height):
        for x in range(w):
            if y < head_h:
                if hx0 <= x < hx0 + hw:
                    a[y, x] = (*head, 255)
            else:
                a[y, x] = (*(lower if y >= hip else body), 255)
    alpha = a[:, :, 3] > 0
    for y in range(height):
        for x in range(w):
            if not alpha[y, x]:
                continue
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if ny < 0 or ny >= height or nx < 0 or nx >= w or not alpha[ny, nx]:
                    a[y, x] = (*ink, 255)
                    break
    return a


def scene(sprite, reg, with_fodder, camera=CAMERA):
    """One composited 480x270 stage at 1x. Painter's order by contact row."""
    cfg = REGISTERS[reg]
    stage = blank_stage(camera).convert("RGBA")
    shadow_layer = Image.new("RGBA", (STAGE_W, STAGE_H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_layer)

    units = []
    if with_fodder:
        fod = sprite_from_rgba(fodder_block(cfg["fodder"]))
        for rank, file in FODDER_TILES:
            x = ANCHOR[0] + (rank - file) * cfg["halfW"]
            y = ANCHOR[1] + (rank + file) * cfg["halfH"]
            units.append((y, x, fod))
    units.append((ANCHOR[1], ANCHOR[0], sprite))
    units.sort(key=lambda u: (u[0], u[1]))

    for y, x, spr in units:
        contact_shadow(sd, x, y, spr.foot_width())
    stage = Image.alpha_composite(stage, shadow_layer)

    for y, x, spr in units:
        img = Image.fromarray(spr.rgba, "RGBA")
        stage.paste(img, spr.origin(x, y), img)
    return stage.convert("RGB")


# --- sheet helpers -----------------------------------------------------
def to_gray(im):
    return im.convert("L").convert("RGB")


def text_w(s, font):
    return int(ImageDraw.Draw(Image.new("RGB", (1, 1))).textlength(s, font=font))


def label_bar(width, text, sub=None, h=None, bg=(0x1C, 0x12, 0x1A), fg=(0xE6, 0xD8, 0xE0), font=None):
    font = font or FONT
    subs = [] if sub is None else ([sub] if isinstance(sub, str) else list(sub))
    top = font.size + 6
    h = h or (top + 13 * len(subs) + 3)
    bar = Image.new("RGB", (width, h), bg)
    d = ImageDraw.Draw(bar)
    d.text((5, 2), text, font=font, fill=fg)
    for i, line in enumerate(subs):
        d.text((5, top + i * 13), line, font=FONT_S, fill=(0xA0, 0x86, 0x98))
    return bar


def pad(im, px=0, py=0, bg=SHELL):
    out = Image.new("RGB", (im.width + px * 2, im.height + py * 2), bg)
    out.paste(im, (px, py))
    return out


def stack(images, gap=0, bg=SHELL, align="left"):
    w = max(i.width for i in images)
    h = sum(i.height for i in images) + gap * (len(images) - 1)
    out = Image.new("RGB", (w, h), bg)
    y = 0
    for i in images:
        x = 0 if align == "left" else (w - i.width) // 2
        out.paste(i, (x, y))
        y += i.height + gap
    return out


def row(images, gap=0, bg=SHELL, align="top"):
    h = max(i.height for i in images)
    w = sum(i.width for i in images) + gap * (len(images) - 1)
    out = Image.new("RGB", (w, h), bg)
    x = 0
    for i in images:
        y = 0 if align == "top" else (h - i.height) // 2
        out.paste(i, (x, y))
        x += i.width + gap
    return out


def border(im, px=2, color=INK_EDGE):
    out = Image.new("RGB", (im.width + px * 2, im.height + px * 2), color)
    out.paste(im, (px, px))
    return out


# Window on the stage used by every cell of every sheet, so nothing is
# helped or punished by its framing.
SOLO_W, SOLO_H = 132, 100
CROWD_W, CROWD_H = 180, 116


def window(stage, w, h, factor=1, up=0.80):
    y1 = min(STAGE_H, ANCHOR[1] + int(round(h * (1 - up))))
    y0 = max(0, y1 - h)
    x0 = max(0, min(STAGE_W - w, ANCHOR[0] - w // 2))
    crop = stage.crop((x0, y0, x0 + w, y0 + h))
    if factor == 1:
        return crop
    return crop.resize((w * factor, h * factor), Image.NEAREST)


def cell(img, title, subs=None, accent=INK_EDGE, bg=(0x1C, 0x12, 0x1A), fg=(0xE6, 0xD8, 0xE0), font=None):
    font = font or FONT
    subs = subs or []
    w = max(img.width, text_w(title, font) + 12, *( [text_w(s, FONT_S) + 12 for s in subs] or [0]))
    body = pad(img, (w - img.width) // 2, 0, bg=(0x14, 0x0D, 0x12))
    lb = label_bar(body.width, title, subs, h=18 + 13 * len(subs), bg=bg, fg=fg, font=font)
    return border(stack([lb, body]), 1, accent)


# --- measurement -------------------------------------------------------
# The lane's own figure/ground threshold, from crowd-scene.ts: below this
# much Rec.709 luma separation an edge "is inside the background's own value
# band and needs a contour".
CONTOUR_MIN_CONTRAST = 22.0


def luma_of(rgb):
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def measure(sprite, camera=CAMERA):
    """
    dissolvingEdgePct - share of background-facing body-silhouette pixels
    sitting within CONTOUR_MIN_CONTRAST of the board pixel they abut, taken
    at the real anchor against the real patch. The lane's own test for
    "this edge does not read".
    """
    b = sprite.body()
    h, w = b.shape[0], b.shape[1]
    a = b[:, :, 3] > 0
    rgb = b[:, :, :3].astype(float)
    lum = luma_of(rgb)
    board = np.asarray(blank_stage(camera)).astype(float)
    bl = luma_of(board)
    ox = int(round(ANCHOR[0] - w / 2))
    oy = int(ANCHOR[1] - (h - 1))
    low = tot = 0
    for y in range(h):
        for x in range(w):
            if not a[y, x]:
                continue
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and a[ny, nx]:
                    continue
                by, bx = oy + ny, ox + nx
                if not (0 <= by < STAGE_H and 0 <= bx < STAGE_W):
                    continue
                tot += 1
                if abs(lum[y, x] - bl[by, bx]) < CONTOUR_MIN_CONTRAST:
                    low += 1
    # Placement-independent control. The tilted redraws are SHORTER than the
    # flat elevations, so they stand against a different band of background -
    # some of the dissolving-edge improvement above could be that and not the
    # artwork. This repeats the measurement against a uniform field at the
    # median luma of the visible board, which no figure can be lucky about.
    flat_ref = float(np.median(bl))
    low_f = tot_f = 0
    for y in range(h):
        for x in range(w):
            if not a[y, x]:
                continue
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and a[ny, nx]:
                    continue
                tot_f += 1
                if abs(lum[y, x] - flat_ref) < CONTOUR_MIN_CONTRAST:
                    low_f += 1

    bottom = a[h - 1]
    runs = int(np.sum(bottom[1:] & ~bottom[:-1])) + int(bottom[0])
    left, right = a[:, : w // 2], a[:, w - w // 2 :]
    lo_l = max(y for y in range(h) if left[y].any())
    lo_r = max(y for y in range(h) if right[y].any())
    return {
        "w": int(w),
        "h": int(h),
        "inkPixels": int(a.sum()),
        "coloursSurviving": len({tuple(v) for v in rgb[a].astype(int)}),
        "lumaSpread": round(float(lum[a].std()), 1),
        "dissolvingEdgePct": round(100 * low / max(1, tot), 1),
        "dissolvingEdgePctFlatField": round(100 * low_f / max(1, tot_f), 1),
        "contactRowRuns": runs,
        "footStagger": abs(lo_l - lo_r),
    }


def astern_occlusion(sprite, reg):
    """
    How much of the dead-astern fodder (one rank back, same file line) the
    hero's body actually hides. A flat front elevation is a narrow slab and
    hides little; a drawn-for-camera figure has shoulder tops and reads as
    volume, so it should hide more.
    """
    cfg = REGISTERS[reg]
    fod = sprite_from_rgba(fodder_block(cfg["fodder"]))
    fx = ANCHOR[0] + (-1 - -1) * cfg["halfW"]
    fy = ANCHOR[1] + (-1 + -1) * cfg["halfH"]
    fo = fod.origin(fx, fy)
    ho = sprite.origin(ANCHOR[0], ANCHOR[1])

    fmask = np.zeros((STAGE_H, STAGE_W), dtype=bool)
    hmask = np.zeros((STAGE_H, STAGE_W), dtype=bool)

    def stamp(mask, rgba, o):
        a = rgba[:, :, 3] > 0
        for y in range(a.shape[0]):
            for x in range(a.shape[1]):
                if not a[y, x]:
                    continue
                sy, sx = o[1] + y, o[0] + x
                if 0 <= sy < STAGE_H and 0 <= sx < STAGE_W:
                    mask[sy, sx] = True

    stamp(fmask, fod.rgba, fo)
    body = np.zeros_like(sprite.rgba)
    body[sprite.fy0 : sprite.fy1 + 1, sprite.fx0 : sprite.fx1 + 1] = sprite.body()
    stamp(hmask, body, ho)
    tot = int(fmask.sum())
    hidden = int((fmask & hmask).sum())
    # rows of the rear unit visible ABOVE the hero's crown
    crown = ho[1] + sprite.fy0
    top = min(y for y in range(STAGE_H) if fmask[y].any())
    return {
        "asternHiddenPct": round(100 * hidden / max(1, tot), 1),
        "asternPokeAboveCrownPx": int(max(0, crown - top)),
    }


# --- main --------------------------------------------------------------
def lane_reference():
    """
    `maraLargeRows` / `maraSmallRows` + the rust livery straight out of the
    lane's crowd-sprites.ts. The only sprite in these sheets authored
    natively at each register FOR this camera by the lane itself.
    """
    import re

    src = from_lane("apps/webapp/src/match-proto/pixel-control-lane/crowd-sprites.ts").decode()
    shared = re.search(r"const sharedRoles: CrowdPalette = \{(.*?)\n\};", src, re.S).group(1)
    pal = dict(re.findall(r'(\w):\s*"(#[0-9a-fA-F]{6})"', shared))
    pal.update({"l": "#ad5638", "L": "#63332a", "i": "#e0a06f"})
    out = {}
    for reg, name in (("44px", "maraLargeRows"), ("28px", "maraSmallRows")):
        block = re.search(r"const " + name + r": string\[\] = \[(.*?)\n\];", src, re.S).group(1)
        out[reg] = {"rows": re.findall(r'"([^"]*)"', block), "legend": pal}
    return out


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE)
    grids_dir = os.environ.get("HP_TILT_GRIDS", os.path.join(HERE, "grids"))
    old_grids = os.environ.get("HP_OLD_GRIDS", os.path.join(HERE, "..", "grids"))
    old_caps = os.environ.get("HP_OLD_CAPTURES", os.path.join(HERE, "..", "in-camera"))
    os.makedirs(out_dir, exist_ok=True)

    # ---- load ---------------------------------------------------------
    new_specs, sprites, old_sprites = {}, {}, {}
    for sid in STYLE_ORDER:
        for reg, tag in (("44px", "44"), ("28px", "28")):
            with open(os.path.join(grids_dir, sid, f"{tag}.json")) as f:
                spec = json.load(f)
            new_specs[(sid, reg)] = spec
            sprites[(sid, reg)] = sprite_from_spec(spec, SHADOW_GLYPHS[sid])
        with open(os.path.join(old_grids, sid + ".json")) as f:
            oldspec = json.load(f)
        for reg, cfg in REGISTERS.items():
            old_sprites[(sid, reg)] = sprite_from_rgba(downsample(oldspec, cfg["hero"]))

    ref = lane_reference()
    for reg in REGISTERS:
        sprites[(REFERENCE, reg)] = sprite_from_spec(ref[reg])

    report = {
        "camera": {"tilted": list(CAMERA), "previousRound": list(LANE_CAMERA)},
        "anchor": list(ANCHOR),
        "stage": [STAGE_W, STAGE_H],
        "fodderTiles": FODDER_TILES,
        "designs": {},
    }

    # ---- per-design captures ------------------------------------------
    for reg, cfg in REGISTERS.items():
        d = os.path.join(out_dir, reg)
        os.makedirs(d, exist_ok=True)
        for sid in STYLE_ORDER:
            spr = sprites[(sid, reg)]
            solo = scene(spr, reg, with_fodder=False)
            crowd = scene(spr, reg, with_fodder=True)
            solo.save(os.path.join(d, f"{sid}-{reg}-1x.png"))
            window(solo, SOLO_W, SOLO_H, 3).save(os.path.join(d, f"{sid}-{reg}-3x.png"))
            crowd.save(os.path.join(d, f"{sid}-{reg}-crowd.png"))
            window(crowd, CROWD_W, CROWD_H, 3).save(os.path.join(d, f"{sid}-{reg}-crowd-3x.png"))

            gw = CROWD_W * 3
            g = stack([
                label_bar(gw, f"{sid} - {reg} - grayscale",
                          ["value structure only. top: true 1x on the populated patch",
                           "bottom: 3x loupe, hero + six fodder placeholders"]),
                pad(to_gray(solo), (gw - STAGE_W) // 2, 0),
                Image.new("RGB", (gw, 3), INK_EDGE),
                to_gray(window(crowd, CROWD_W, CROWD_H, 3)),
            ], align="center")
            g.save(os.path.join(d, f"{sid}-{reg}-gray.png"))

            old = old_sprites[(sid, reg)]
            m_new = measure(spr)
            m_old = measure(old)
            occ = astern_occlusion(spr, reg)
            occ_old = astern_occlusion(old, reg)
            e = report["designs"].setdefault(sid, {})
            e[reg] = {
                "tilted": {
                    **m_new, **occ,
                    "canvas": [int(spr.rgba.shape[1]), int(spr.rgba.shape[0])],
                    "authoredShadowPx": spr.shadow_px,
                    "heroFodderRatio": round(spr.fig_h / cfg["fodder"], 2),
                },
                "flatElevation": {
                    **m_old, **occ_old,
                    "heroFodderRatio": round(old.fig_h / cfg["fodder"], 2),
                },
            }

        # lane control captures
        spr = sprites[(REFERENCE, reg)]
        solo = scene(spr, reg, with_fodder=False)
        crowd = scene(spr, reg, with_fodder=True)
        solo.save(os.path.join(d, f"{REFERENCE}-{reg}-1x.png"))
        window(solo, SOLO_W, SOLO_H, 3).save(os.path.join(d, f"{REFERENCE}-{reg}-3x.png"))
        crowd.save(os.path.join(d, f"{REFERENCE}-{reg}-crowd.png"))
        window(crowd, CROWD_W, CROWD_H, 3).save(os.path.join(d, f"{REFERENCE}-{reg}-crowd-3x.png"))
        report["designs"].setdefault(REFERENCE, {})[reg] = {
            "tilted": {**measure(spr), **astern_occlusion(spr, reg),
                       "authoredShadowPx": spr.shadow_px,
                       "heroFodderRatio": round(spr.fig_h / cfg["fodder"], 2)}
        }

    # ---- contact sheet per register -----------------------------------
    for reg, cfg in REGISTERS.items():
        order = STYLE_ORDER + [REFERENCE]
        solo_cells, crowd_cells, tiny_cells = [], [], []
        col_w = SOLO_W * 3 + 2
        for sid in order:
            spr = sprites[(sid, reg)]
            is_ref = sid == REFERENCE
            label = "mara - LANE CONTROL" if is_ref else sid
            acc = CTRL_EDGE if is_ref else INK_EDGE
            bg = (0x35, 0x22, 0x18) if is_ref else (0x1C, 0x12, 0x1A)
            fg = (0xE0, 0xA0, 0x6F) if is_ref else (0xE6, 0xD8, 0xE0)
            ratio = spr.fig_h / cfg["fodder"]
            size_note = (f"figure {spr.fig_w}x{spr.fig_h} px  -  {ratio:.2f}x the "
                         f"{cfg['fodder']} px fodder")
            solo = scene(spr, reg, with_fodder=False)
            crowd = scene(spr, reg, with_fodder=True)

            def fit(c):
                return pad(c, (col_w - c.width) // 2, 0) if c.width < col_w else c

            solo_cells.append(fit(cell(window(solo, SOLO_W, SOLO_H, 3), label,
                                       ["alone - 3x nearest", size_note], acc, bg, fg)))
            crowd_cells.append(fit(cell(window(crowd, CROWD_W, CROWD_H, 2), label,
                                        ["+6 fodder, 3 one rank behind - 2x", size_note],
                                        acc, bg, fg)))
            tiny_cells.append(fit(cell(window(crowd, CROWD_W, CROWD_H, 1), label,
                                       ["TRUE 1x - real size"], acc, bg, fg, font=FONT_XS)))
        r1 = row(solo_cells, gap=8)
        r2 = row(crowd_cells, gap=8)
        r3 = row(tiny_cells, gap=8)
        body = stack([r1, r2, r3], gap=10, align="center")
        title = f"TILTED CONTACT SHEET - hero {cfg['hero']} px, authored natively at this register"
        subs = [
            "grime-market board, fixed 2:1 dimetric camera, 480x270 stage, 1x - no resampling anywhere.",
            f"Camera (-30,-62): the populated corner - market stack faces behind, floor decals and clutter underfoot.",
            "Identical anchor (214,196) and identical framing for all five cells.",
            "Row 1: hero alone.  Row 2: hero + six fodder placeholders, THREE of them one rank behind.  Row 3: the same, true 1x.",
            "Last cell is the pixel lane's own Mara, authored FOR this camera - the control this fanout is trying to match.",
            f"Watch the figure height. A down-angle costs apparent height, and the hero tier is carried by size: "
            f"Mara is {sprites[(REFERENCE, reg)].fig_h} px against {cfg['fodder']} px of fodder.",
        ]
        need = max([text_w(title, FONT_BIG)] + [text_w(s, FONT_S) for s in subs]) + 16
        head = label_bar(max(body.width, need), title, subs, font=FONT_BIG)
        sheet = Image.new("RGB", (max(head.width, body.width) + 16, body.height + head.height + 20), SHELL)
        sheet.paste(head, (0, 0))
        sheet.paste(body, ((sheet.width - body.width) // 2, head.height + 10))
        sheet.save(os.path.join(out_dir, f"contact-sheet-{reg}.png"))

    # ---- before / after ------------------------------------------------
    def before_after(reg, factor):
        cfg = REGISTERS[reg]
        rows_out = []
        for sid in STYLE_ORDER:
            # Every cell uses the same window HEIGHT so the four panels of a
            # row are the same size and nothing reads as emphasised.
            wh = CROWD_H
            # 1. what was committed last round: flat elevation, lane camera, bare patch
            old_path = os.path.join(old_caps, reg, f"{sid}-{reg}-1x.png")
            old_stage = Image.open(old_path).convert("RGB")
            c1 = window(old_stage, SOLO_W, wh, factor)
            # 2. the same flat grid, re-rendered on THIS patch - removes the
            #    board confound so the artwork is the only variable
            c2 = window(scene(old_sprites[(sid, reg)], reg, with_fodder=False), SOLO_W, wh, factor)
            # 3. the redraw
            c3 = window(scene(sprites[(sid, reg)], reg, with_fodder=False), SOLO_W, wh, factor)
            # 4. the redraw in company, where depth actually gets tested
            c4 = window(scene(sprites[(sid, reg)], reg, with_fodder=True), CROWD_W, wh, factor)

            mo = report["designs"][sid][reg]["flatElevation"]
            mn = report["designs"][sid][reg]["tilted"]
            cells = [
                cell(c1, "BEFORE - flat elevation",
                     ["as committed last round",
                      "bare plane, lane camera",
                      f"figure {mo['w']}x{mo['h']} px"],
                     (0x5A, 0x2E, 0x2E), (0x2A, 0x14, 0x16), (0xE8, 0xB0, 0xA6)),
                cell(c2, "BEFORE - same grid, this patch",
                     ["board confound removed",
                      f"dissolving edge {mo['dissolvingEdgePct']}%",
                      f"{mo['heroFodderRatio']}x the {cfg['fodder']} px fodder"],
                     (0x5A, 0x2E, 0x2E), (0x2A, 0x14, 0x16), (0xE8, 0xB0, 0xA6)),
                cell(c3, "AFTER - dimetric redraw",
                     ["authored natively at this register",
                      f"dissolving edge {mn['dissolvingEdgePct']}%  (was {mo['dissolvingEdgePct']}%)",
                      f"figure {mn['w']}x{mn['h']} px - {mn['heroFodderRatio']}x fodder "
                      f"(was {mo['heroFodderRatio']}x)"],
                     (0x2E, 0x5A, 0x4A), (0x14, 0x2A, 0x24), (0xA6, 0xE8, 0xD2)),
                cell(c4, "AFTER - in company",
                     [f"astern unit {mn['asternHiddenPct']}% hidden (was {mo['asternHiddenPct']}%)",
                      f"its head clears the crown by {mn['asternPokeAboveCrownPx']}px "
                      f"(was {mo['asternPokeAboveCrownPx']}px)",
                      "three of the six stand one rank behind"],
                     (0x2E, 0x5A, 0x4A), (0x14, 0x2A, 0x24), (0xA6, 0xE8, 0xD2)),
            ]
            band = row(cells, gap=8, align="top")
            name = label_bar(band.width, f"{sid}  -  hero {cfg['hero']} px", h=22,
                             bg=(0x24, 0x17, 0x22), fg=(0xF0, 0xE2, 0xEA), font=FONT_BIG)
            rows_out.append(stack([name, band], gap=3))
        body = stack(rows_out, gap=14, align="center")
        title = f"BEFORE / AFTER - flat front elevation vs true dimetric redraw (hero {cfg['hero']} px)"
        subs = [
            "Same board, same 2:1 dimetric camera, same anchor (214,196), same 1x scale, same six fodder placeholders.",
            "Column 1 is the capture already in docs/art-direction/hero-design-fanout/in-camera/ - it stands on the bare",
            "middle of the plane because that is where the lane camera's anchor lands. Column 2 re-renders that SAME flat",
            "grid on this populated patch, so columns 2 and 3 differ ONLY in the artwork. Column 4 is the depth test:",
            "three of the six placeholders stand one rank behind the hero and must read as behind, not as short.",
            "'Dissolving edge' = share of silhouette edge within 22 luma of the board pixel it abuts (the lane's own threshold).",
            f"'Fodder' is the {cfg['fodder']} px neutral placeholder, unchanged between the two rounds. The lane's own Mara is "
            f"{sprites[(REFERENCE, reg)].fig_h} px, {sprites[(REFERENCE, reg)].fig_h / cfg['fodder']:.2f}x fodder - that is the tier gap to beat.",
        ]
        need = max([text_w(title, FONT_BIG)] + [text_w(s, FONT_S) for s in subs]) + 16
        head = label_bar(max(body.width, need), title, subs, font=FONT_BIG)
        sheet = Image.new("RGB", (max(head.width, body.width) + 16, body.height + head.height + 22), SHELL)
        sheet.paste(head, (0, 0))
        sheet.paste(body, ((sheet.width - body.width) // 2, head.height + 12))
        return sheet

    for reg in REGISTERS:
        before_after(reg, 3).save(os.path.join(out_dir, f"before-after-{reg}.png"))

    both = stack([before_after("44px", 2), Image.new("RGB", (10, 14), SHELL), before_after("28px", 2)],
                 gap=0, align="center")
    both.save(os.path.join(out_dir, "before-after-both-registers.png"))

    with open(os.path.join(out_dir, "tilt-report.json"), "w") as f:
        json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
