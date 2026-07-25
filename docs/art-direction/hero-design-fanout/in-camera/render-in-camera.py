#!/usr/bin/env python3
"""
In-camera hero-register captures for the hero-design fanout.

Renders each candidate hero-medic grid onto the REAL grime-market board,
under the REAL fixed 2:1 dimetric camera, at the two hero registers the
pixel-control lane settled on (28 px and 44 px figure height).

Every scene constant below is lifted verbatim from the pixel lane on
branch `prototype/pixel-control-lane` (read-only, via `git show`):

  apps/webapp/src/match-proto/pixel-control-lane/crowd-scene.ts
      STAGE_W = 480, STAGE_H = 270
      CAMERA  = { x: -178, y: -92 }
      small:  halfW 13, halfH 7   fodder 22 px / hero 28 px
      large:  halfW 18, halfH 9   fodder 34 px / hero 44 px
      contact shadow: ellipse(x, y+1, w/2, max(2, w/6)) @ rgb(18 11 16 / .42)
      blit anchor:    top-left = (round(x - w/2), round(y - bottomRow))
  apps/webapp/src/match-proto/style-cohesion-assets/grime-market-board.prototype.png

Deliberately NOT applied, so the sprite is judged as authored:
  - the hero marking ring (approved, but it masks silhouette)
  - the background-aware contour pass (it would rewrite authored pixels)
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


def from_lane(path):
    """Read a file off the pixel lane WITHOUT checking the branch out."""
    return subprocess.run(
        ["git", "-C", REPO, "show", f"{LANE}:{path}"],
        check=True,
        stdout=subprocess.PIPE,
    ).stdout

# --- lane constants ----------------------------------------------------
STAGE_W, STAGE_H = 480, 270
CAMERA = (-178, -92)
SHELL = (0x12, 0x0B, 0x10)

REGISTERS = {
    "28px": dict(hero=28, fodder=22, halfW=13, halfH=7),
    "44px": dict(hero=44, fodder=34, halfW=18, halfH=9),
}

# Feet (contact row) of the subject hero, in stage pixels. One anchor for
# both registers so the only thing that changes between them is size.
ANCHOR = (214, 196)

# Fodder tiles around the hero, in the same dimetric rank/file frame.
# screen dx = (rank - file) * halfW ; screen dy = (rank + file) * halfH
# Two flanking, two behind, two in front — so the hero is both overlapped
# and overlapping, which is the condition it will actually be read in.
FODDER_TILES = [(1, -1), (-1, 1), (-1, -1), (1, 0), (0, 1)]

OUT = sys.argv[1] if len(sys.argv) > 1 else "/tmp/heroctx/out"
BOARD = Image.open(
    io.BytesIO(
        from_lane("apps/webapp/src/match-proto/style-cohesion-assets/grime-market-board.prototype.png")
    )
).convert("RGB")

STYLE_ORDER = [
    "quasimorph-grime",
    "top-heavy-exaggerated",
    "metal-slug-tactics",
    "painterly-cluster",
    "flat-graphic",
    "role-legible",
    "chunky-silhouette",
    "technofantasy-esper",
]

FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 13)
FONT_S = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 11)
FONT_XS = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 9)

# The pixel lane's own hero, authored natively at each register FOR this
# camera (32x47 / 20x30, figure 44 px / 28 px). Carried in as the control:
# it is the only sprite in these sheets that was drawn with crown
# foreshortening, shoulder tops and a staggered contact row.
REFERENCE = "lane-reference-mara"


# --- grid -> rgba ------------------------------------------------------
def grid_rgba(spec):
    """48x64 authored grid -> float RGBA array, alpha 0/1."""
    rows = spec["rows"]
    legend = {k: v for k, v in spec["legend"].items()}
    h = len(rows)
    w = max(len(r) for r in rows)
    out = np.zeros((h, w, 4), dtype=np.float64)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in (" ", ".", ""):
                continue
            hexv = legend.get(ch)
            if hexv is None:
                continue
            v = int(hexv.lstrip("#"), 16)
            out[y, x] = [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255]
    return out


def bbox(rgba):
    ys, xs = np.nonzero(rgba[:, :, 3] > 0)
    return ys.min(), ys.max(), xs.min(), xs.max()


def palette_array(spec):
    cols = []
    for hexv in spec["legend"].values():
        v = int(hexv.lstrip("#"), 16)
        cols.append([(v >> 16) & 255, (v >> 8) & 255, v & 255])
    return np.array(cols, dtype=np.float64)


def downsample(spec, target_h):
    """
    Authored 48x64 -> a `target_h`-tall sprite, the honest way:
    premultiplied box filter (so transparent black never bleeds into the
    contour), alpha thresholded back to hard 0/1, then every surviving
    colour snapped to the design's OWN legend so the result stays
    palette-true pixel art rather than a blurry resample.
    """
    rgba = grid_rgba(spec)
    t, b, l, r = bbox(rgba)
    crop = rgba[t : b + 1, l : r + 1]
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
    rgb = np.dstack([ra / safe, ga / safe, ba / safe])
    rgb = np.clip(rgb, 0, 255)

    # snap to the design's own palette
    pal = palette_array(spec)
    flat = rgb.reshape(-1, 3)
    d = ((flat[:, None, :] - pal[None, :, :]) ** 2).sum(axis=2)
    snapped = pal[d.argmin(axis=1)].reshape(th, tw, 3)

    out = np.zeros((th, tw, 4), dtype=np.uint8)
    out[:, :, :3] = snapped.astype(np.uint8)
    out[:, :, 3] = np.where(mask, 255, 0)

    # trim to the surviving ink so bottomRow is exact
    ys, xs = np.nonzero(out[:, :, 3] > 0)
    return out[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]


# --- board / stage -----------------------------------------------------
def blank_stage():
    st = Image.new("RGB", (STAGE_W, STAGE_H), SHELL)
    st.paste(BOARD, CAMERA)
    return st


def contact_shadow(draw, x, y, foot_w):
    """Identical treatment for every unit, hero or fodder (lane rule)."""
    w = max(6, foot_w)
    rx, ry = w / 2, max(2, w / 6)
    draw.ellipse([x - rx, y + 1 - ry, x + rx, y + 1 + ry], fill=(18, 11, 16, 107))


def foot_width(sprite):
    a = sprite[:, :, 3]
    h = a.shape[0]
    widest = 0
    for y in range(max(0, h - 3), h):
        xs = np.nonzero(a[y])[0]
        if xs.size:
            widest = max(widest, int(xs.max() - xs.min() + 1))
    return widest


def blit(stage, sprite, cx, feet_y):
    """Lane anchor: horizontal centre + contact row."""
    h, w = sprite.shape[0], sprite.shape[1]
    ox = int(round(cx - w / 2))
    oy = int(round(feet_y - (h - 1)))
    img = Image.fromarray(sprite, "RGBA")
    stage.paste(img, (ox, oy), img)
    return ox, oy, w, h


def fodder_block(height):
    """
    Deliberately featureless stand-in at fodder register: a body mass with
    a head notch, 1 px ink contour, neutral plum so it contributes bulk and
    occlusion without competing for the eye. This is scale + occlusion
    company, not art.
    """
    w = max(7, int(round(height * 0.42)))
    if w % 2 == 0:
        w += 1
    a = np.zeros((height, w, 4), dtype=np.uint8)
    # Neutral grey on purpose: a placeholder must not pass for authored art,
    # and it must not borrow the board's plum or a design's chroma.
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
    # 1 px contour
    alpha = a[:, :, 3] > 0
    for y in range(height):
        for x in range(w):
            if not alpha[y, x]:
                continue
            n = [
                (y - 1, x),
                (y + 1, x),
                (y, x - 1),
                (y, x + 1),
            ]
            for ny, nx in n:
                if ny < 0 or ny >= height or nx < 0 or nx >= w or not alpha[ny, nx]:
                    a[y, x] = (*ink, 255)
                    break
    return a


def scene(sprite, reg, with_fodder):
    """One composited 480x270 stage at 1x. Painter's order by contact row."""
    cfg = REGISTERS[reg]
    stage = blank_stage().convert("RGBA")
    shadow_layer = Image.new("RGBA", (STAGE_W, STAGE_H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_layer)

    units = []
    if with_fodder:
        fod = fodder_block(cfg["fodder"])
        for rank, file in FODDER_TILES:
            x = ANCHOR[0] + (rank - file) * cfg["halfW"]
            y = ANCHOR[1] + (rank + file) * cfg["halfH"]
            units.append((y, x, fod))
    units.append((ANCHOR[1], ANCHOR[0], sprite))
    units.sort(key=lambda u: (u[0], u[1]))

    for y, x, spr in units:
        contact_shadow(sd, x, y, foot_width(spr))
    stage = Image.alpha_composite(stage, shadow_layer)

    for y, x, spr in units:
        blit(stage, spr, x, y)
    return stage.convert("RGB")


# --- helpers -----------------------------------------------------------
def loupe(stage, win_w, win_h, factor, feet=ANCHOR, up_bias=0.78):
    """Nearest-neighbour magnifier over the hero, from the 1x stage."""
    cx = feet[0]
    y1 = min(STAGE_H, feet[1] + int(win_h * (1 - up_bias)))
    y0 = max(0, y1 - win_h)
    x0 = max(0, min(STAGE_W - win_w, cx - win_w // 2))
    crop = stage.crop((x0, y0, x0 + win_w, y0 + win_h))
    return crop.resize((win_w * factor, win_h * factor), Image.NEAREST)


def to_gray(im):
    return im.convert("L").convert("RGB")


def label_bar(width, text, sub=None, h=None, bg=(0x1C, 0x12, 0x1A), fg=(0xE6, 0xD8, 0xE0), font=None):
    font = font or FONT
    subs = [] if sub is None else ([sub] if isinstance(sub, str) else list(sub))
    h = h or (18 + 13 * len(subs) if subs else 20)
    bar = Image.new("RGB", (width, h), bg)
    d = ImageDraw.Draw(bar)
    d.text((5, 2), text, font=font, fill=fg)
    for i, line in enumerate(subs):
        d.text((5, 17 + i * 12), line, font=FONT_S, fill=(0xA0, 0x86, 0x98))
    return bar


def text_w(s, font):
    return int(ImageDraw.Draw(Image.new("RGB", (1, 1))).textlength(s, font=font))


def pad(im, px=0, py=0, bg=SHELL):
    out = Image.new("RGB", (im.width + px * 2, im.height + py * 2), bg)
    out.paste(im, (px, py))
    return out


def stack(images, gap=0, bg=SHELL):
    w = max(i.width for i in images)
    h = sum(i.height for i in images) + gap * (len(images) - 1)
    out = Image.new("RGB", (w, h), bg)
    y = 0
    for i in images:
        out.paste(i, (0, y))
        y += i.height + gap
    return out


def row(images, gap=0, bg=SHELL):
    h = max(i.height for i in images)
    w = sum(i.width for i in images) + gap * (len(images) - 1)
    out = Image.new("RGB", (w, h), bg)
    x = 0
    for i in images:
        out.paste(i, (x, 0))
        x += i.width + gap
    return out


def border(im, px=2, color=(0x3D, 0x29, 0x39)):
    out = Image.new("RGB", (im.width + px * 2, im.height + px * 2), color)
    out.paste(im, (px, px))
    return out


# --- measurement -------------------------------------------------------
# The lane's own figure/ground threshold, from crowd-scene.ts: below this
# much Rec.709 luma separation an edge "is inside the background's own
# value band and needs a contour".
CONTOUR_MIN_CONTRAST = 22.0


def luma_of(rgb):
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def measure(sprite, reg):
    """
    Numbers that survive an argument, all taken at the register in question
    against the real board at the real anchor.

    dissolvingEdgePct — share of background-facing silhouette edge pixels
    sitting within CONTOUR_MIN_CONTRAST of the board pixel they abut. This
    is the lane's own test for "this edge does not read".
    """
    h, w = sprite.shape[0], sprite.shape[1]
    a = sprite[:, :, 3] > 0
    rgb = sprite[:, :, :3].astype(float)
    lum = luma_of(rgb)
    board = np.asarray(blank_stage()).astype(float)
    bl = luma_of(board)
    ox = int(round(ANCHOR[0] - w / 2))
    oy = int(round(ANCHOR[1] - (h - 1)))
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
    bottom = a[h - 1]
    runs = int(np.sum(bottom[1:] & ~bottom[:-1])) + int(bottom[0])
    left, right = a[:, : w // 2], a[:, w - w // 2 :]
    lo_l = max(y for y in range(h) if left[y].any())
    lo_r = max(y for y in range(h) if right[y].any())
    return {
        "w": w,
        "h": h,
        "inkPixels": int(a.sum()),
        "coloursSurviving": len({tuple(v) for v in rgb[a].astype(int)}),
        "lumaSpread": round(float(lum[a].std()), 1),
        "dissolvingEdgePct": round(100 * low / max(1, tot), 1),
        "contactRowRuns": runs,
        "footStagger": abs(lo_l - lo_r),
    }


# --- main --------------------------------------------------------------
def lane_reference():
    """
    Pull `maraLargeRows` / `maraSmallRows` and the rust palette straight out
    of the lane's crowd-sprites.ts. This is the only sprite in these sheets
    authored natively at each register FOR this camera, so it is the control.
    """
    import re

    src = from_lane("apps/webapp/src/match-proto/pixel-control-lane/crowd-sprites.ts").decode()
    shared = re.search(r"const sharedRoles: CrowdPalette = \{(.*?)\n\};", src, re.S).group(1)
    pal = dict(re.findall(r'(\w):\s*"(#[0-9a-fA-F]{6})"', shared))
    pal.update({"l": "#ad5638", "L": "#63332a", "i": "#e0a06f"})  # rust livery
    out = {}
    for reg, name in (("44px", "maraLargeRows"), ("28px", "maraSmallRows")):
        block = re.search(r"const " + name + r": string\[\] = \[(.*?)\n\];", src, re.S).group(1)
        out[reg] = {"rows": re.findall(r'"([^"]*)"', block), "legend": pal}
    return out


def load_specs():
    here = os.path.dirname(os.path.abspath(__file__))
    grids = os.environ.get("HP_GRIDS", os.path.join(here, "..", "grids"))
    specs = {}
    for sid in STYLE_ORDER:
        src = os.path.join(grids, sid + ".json")
        with open(src) as f:
            specs[sid] = json.load(f)
        specs[sid]["_source"] = os.path.relpath(src, REPO) if src.startswith(REPO) else src
    ref = lane_reference()
    specs[REFERENCE] = {
        "44px": ref["44px"],
        "28px": ref["28px"],
        "_source": f"{LANE}:crowd-sprites.ts (native at each register, not resampled)",
    }
    return specs


def reference_sprite(specs, reg):
    """Lane control at its native register — no downsample, 1 authored px = 1 screen px."""
    a = grid_rgba(specs[REFERENCE][reg]).astype(np.uint8)
    ys, xs = np.nonzero(a[:, :, 3] > 0)
    return a[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]


LOUPE_W, LOUPE_H = 120, 68
CELL_W, CELL_H = 118, 86


def main():
    specs = load_specs()
    os.makedirs(OUT, exist_ok=True)
    sprites = {}
    report = {}

    for reg in REGISTERS:
        sprites[(REFERENCE, reg)] = reference_sprite(specs, reg)
    report[REFERENCE] = {"source": specs[REFERENCE]["_source"], "native": True}

    for sid in STYLE_ORDER:
        spec = specs[sid]
        report[sid] = {"source": spec["_source"]}
        for reg, cfg in REGISTERS.items():
            spr = downsample(spec, cfg["hero"])
            sprites[(sid, reg)] = spr
            report[sid][reg] = {"w": int(spr.shape[1]), "h": int(spr.shape[0])}
            d = os.path.join(OUT, reg)
            os.makedirs(d, exist_ok=True)

            st = scene(spr, reg, with_fodder=False)
            st.save(os.path.join(d, f"{sid}-{reg}-1x.png"))

            lp = loupe(st, LOUPE_W, LOUPE_H, 4)
            lp.save(os.path.join(d, f"{sid}-{reg}-4x.png"))

            g = stack(
                [
                    label_bar(480, f"{sid} · {reg} · grayscale", "value structure — top: true 1x · bottom: 4x loupe"),
                    to_gray(st),
                    Image.new("RGB", (480, 3), (0x3D, 0x29, 0x39)),
                    to_gray(lp),
                ]
            )
            g.save(os.path.join(d, f"{sid}-{reg}-gray.png"))

            cr = scene(spr, reg, with_fodder=True)
            cr.save(os.path.join(d, f"{sid}-{reg}-crowd.png"))
            loupe(cr, 160, 96, 3).save(os.path.join(d, f"{sid}-{reg}-crowd-3x.png"))

    # --- contact sheets -------------------------------------------------
    for reg, cfg in REGISTERS.items():
        for factor, suffix in ((3, ""), (1, "-true1x")):
            font = FONT if factor > 1 else FONT_XS
            bar_h = 18 if factor > 1 else 12
            cells = []
            order = STYLE_ORDER + [REFERENCE]
            for sid in order:
                st = scene(sprites[(sid, reg)], reg, with_fodder=False)
                crop = st.crop(
                    (
                        ANCHOR[0] - CELL_W // 2,
                        ANCHOR[1] - int(CELL_H * 0.8),
                        ANCHOR[0] - CELL_W // 2 + CELL_W,
                        ANCHOR[1] - int(CELL_H * 0.8) + CELL_H,
                    )
                )
                img = crop.resize((CELL_W * factor, CELL_H * factor), Image.NEAREST)
                is_ref = sid == REFERENCE
                label = "mara — LANE CONTROL" if is_ref else sid
                cw = max(img.width, text_w(label, font) + 10)
                img = pad(img, (cw - img.width) // 2, 0, bg=(0x14, 0x0D, 0x12))
                lb = label_bar(
                    img.width,
                    label,
                    h=bar_h,
                    font=font,
                    bg=(0x35, 0x22, 0x18) if is_ref else (0x1C, 0x12, 0x1A),
                    fg=(0xE0, 0xA0, 0x6F) if is_ref else (0xE6, 0xD8, 0xE0),
                )
                cells.append(
                    border(stack([lb, img]), 1, (0xAD, 0x56, 0x38) if is_ref else (0x3D, 0x29, 0x39))
                )
            grid = stack([row(cells[0:3], gap=8), row(cells[3:6], gap=8), row(cells[6:9], gap=8)], gap=8)
            scale_note = f"{factor}x nearest" if factor > 1 else "TRUE 1x — REAL SIZE"
            title = f"IN-CAMERA CONTACT SHEET — hero {cfg['hero']} px  ({scale_note})"
            subs = [
                "grime-market board · fixed 2:1 dimetric camera (-178,-92) · 480x270 stage",
                "identical anchor and framing for all eight",
                "last cell = the lane's own hero, authored FOR this camera",
            ]
            need = max([text_w(title, FONT)] + [text_w(s, FONT_S) for s in subs]) + 14
            head = label_bar(max(grid.width, need), title, subs, h=56)
            sheet = Image.new("RGB", (head.width + 16, grid.height + head.height + 16), SHELL)
            sheet.paste(head, (0, 0))
            sheet.paste(grid, ((sheet.width - grid.width) // 2, head.height + 8))
            sheet.save(os.path.join(OUT, f"contact-sheet-{reg}{suffix}.png"))

    # --- straight-on vs in-camera ---------------------------------------
    def straight_on(spec, factor=6):
        rgba = grid_rgba(spec).astype(np.uint8)
        im = Image.fromarray(rgba, "RGBA")
        im = im.resize((im.width * factor, im.height * factor), Image.NEAREST)
        bg = Image.new("RGB", im.size, (0x25, 0x18, 0x26))
        bg.paste(im, (0, 0), im)
        return bg

    # Same window size (48x64) and same magnification (6x) on both sides, so
    # the only thing that differs between the panels is the register and the
    # camera — nothing is helped or punished by the zoom.
    for sid in ("role-legible", "painterly-cluster", "chunky-silhouette"):
        so = straight_on(specs[sid], 6)  # 48x64 authored grid @6x = 288x384
        panels = [
            stack([label_bar(so.width, "AS JUDGED", ["straight-on 48x64 @ 6x", "no board, no camera"], h=42), so])
        ]
        for reg in ("44px", "28px"):
            st = scene(sprites[(sid, reg)], reg, with_fodder=False)
            lp = loupe(st, 48, 64, 6, up_bias=0.86)  # 48x64 stage window @6x
            panels.append(
                stack(
                    [
                        label_bar(
                            lp.width,
                            f"IN CAMERA · hero {reg}",
                            ["48x64 stage window @ 6x", "on the grime-market board"],
                            h=42,
                        ),
                        lp,
                    ]
                )
            )
        strip = []
        for reg in ("44px", "28px"):
            st = scene(sprites[(sid, reg)], reg, with_fodder=False)
            strip.append(
                border(st.crop((ANCHOR[0] - 72, ANCHOR[1] - 62, ANCHOR[0] + 72, ANCHOR[1] + 10)), 1)
            )
        body = row([border(p, 1) for p in panels], gap=8)
        foot = row(strip, gap=8)
        w = max(body.width, foot.width)
        head = label_bar(
            w,
            f"{sid} — straight-on vs in-camera",
            [
                "LEFT: the view the previous round graded.   RIGHT: the view the game actually shows.",
                "All three panels are the same 48x64 window at the same 6x magnification.",
            ],
            h=46,
        )
        footlbl = label_bar(w, "TRUE 1x, UNMAGNIFIED — 44 px hero, then 28 px hero", h=20)
        out = pad(stack([head, body, footlbl, foot], gap=6), 8, 8)
        out.save(os.path.join(OUT, f"straight-on-vs-in-camera-{sid}.png"))

    # --- the known defect, shown ---------------------------------------
    # Every candidate is a flat front elevation; the lane control is not.
    # Same register, same magnification, shared guide rows.
    defect_ids = ["role-legible", "painterly-cluster", "quasimorph-grime", "technofantasy-esper"]
    F = 6
    cells = []
    for sid in defect_ids + [REFERENCE]:
        spr = sprites[(sid, "44px")]
        h, w = spr.shape[0], spr.shape[1]
        canvas = Image.new("RGB", (40, 54), (0x2A, 0x1C, 0x28))
        img = Image.fromarray(spr, "RGBA")
        top = 54 - h - 5
        canvas.paste(img, ((40 - w) // 2, top), img)
        big = canvas.resize((40 * F, 54 * F), Image.NEAREST)
        d = ImageDraw.Draw(big)
        for frac, color in ((0.0, (0xE0, 0xA0, 0x6F)), (0.30, (0x2F, 0x9E, 0x96)), (1.0, (0xAD, 0x56, 0x38))):
            y = (top + int(round((h - 1) * frac))) * F + F // 2
            d.line([(0, y), (big.width, y)], fill=color, width=1)
        is_ref = sid == REFERENCE
        lb = label_bar(
            big.width,
            "mara (LANE)" if is_ref else sid[:18],
            ["authored FOR camera" if is_ref else "flat front elevation"],
            h=32,
            font=FONT_XS,
            bg=(0x35, 0x22, 0x18) if is_ref else (0x1C, 0x12, 0x1A),
            fg=(0xE0, 0xA0, 0x6F) if is_ref else (0xE6, 0xD8, 0xE0),
        )
        cells.append(border(stack([lb, big]), 1, (0xAD, 0x56, 0x38) if is_ref else (0x3D, 0x29, 0x39)))
    body = row(cells, gap=8)
    head = label_bar(
        body.width,
        "THE KNOWN DEFECT — front elevation vs drawn-for-camera (hero 44 px @ 6x)",
        [
            "Guides: orange = crown row · teal = 30% down (shoulder line) · rust = contact row. Not fixed this round — measured.",
            "All four candidates present a full frontal FACE at the shoulder line: paired eyes, nose, mouth, both",
            "shoulders as flat front planes. The lane control presents the TOP of a hood — no face, hardware on the",
            "near side only. MEASURED CAVEAT: the contact row is NOT a differentiator — mara's two boots also share",
            "one row (footStagger 0 for all nine), so that item of the brief is lane practice, not a candidate defect.",
        ],
        h=82,
    )
    pad(stack([head, body], gap=6), 8, 8).save(os.path.join(OUT, "known-defect-front-elevation.png"))

    # --- measurements ----------------------------------------------------
    for sid in STYLE_ORDER + [REFERENCE]:
        for reg in REGISTERS:
            report[sid][reg] = {**report[sid].get(reg, {}), **measure(sprites[(sid, reg)], reg)}

    with open(os.path.join(OUT, "in-camera-report.json"), "w") as f:
        json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
