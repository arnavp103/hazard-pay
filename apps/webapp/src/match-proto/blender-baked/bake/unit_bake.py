"""Blender-side of the #82 bake-off lane: low-poly units -> pixel sprites.

Runs inside Blender's embedded interpreter (`blender -b -P unit_bake.py --
<spec.json>`). Everything outside this file is TypeScript; this script owns
only what `bpy` can own — scene, rig, poses, camera, render — and hands the
result back as a manifest JSON file (never stdout: Blender is chatty).

Round 4 added the fodder tier (#69's two-tier ruling): the same seam now bakes
three rigs — the hero medic plus two fodder archetypes that must part on
SILHOUETTE alone (a broad shield-carrying brute, a narrow long-barrelled
marksman) — at any requested world scale. Tier separation is a slight size
boost plus higher detail density; the third lever, hero marking, is drawn in
pixel space by the TypeScript compiler rather than modelled here, because a
ring authored at exactly one art pixel is not something geometry can promise.

Design notes that matter:

* CYCLES/CPU. EEVEE crashes headless here (EGL_BAD_MATCH) and is 12x slower
  under llvmpipe.
* Materials are pure EMISSION driven by a hard three-band ColorRamp on
  normal-dot-key. That reproduces the rival lane's `MeshToonMaterial` ramp
  exactly, needs no lights, is noise-free at 1 sample, and renders in ~3 ms.
* `view_transform = "Standard"` plus an sRGB->linear conversion on every
  authored hex means the output byte equals the authored byte. Palette
  quantization downstream is then honest.
* Two passes per frame: the shaded colour pass and a flat per-part ID pass.
  The ID pass is what lets the TypeScript compiler ink internal part
  boundaries at 1 art-pixel — geometry outline shells are sub-pixel at this
  resolution and would simply vanish.
* World mapping from the rival Three.js rig: blender = (x, -z, y), so a
  Three euler (rx, ry, rz) becomes (rx, -rz, ry).
"""

import json
import math
import sys
import time

import bmesh
import bpy
import mathutils

TAU = math.pi * 2.0

# --- colour ---------------------------------------------------------------


def srgb_to_linear(channel: float) -> float:
    if channel <= 0.04045:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def hex_to_linear(value: str) -> tuple:
    raw = value.lstrip("#")
    parts = [int(raw[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple(srgb_to_linear(p) for p in parts)


# --- rig palette ----------------------------------------------------------
# Same identity kit as the rival real-time lane so the two 3D-derived lanes
# differ only in the bake, not in the character.

COAT = "#3f4b49"
COAT_DARK = "#333d3c"
PANTS = "#3a3841"
SHIN = "#312f37"
BOOT = "#221f26"
SKIN = "#a96e51"
HOOD = "#3b2936"
BROW = "#241a22"
METAL = "#8b8f99"
METAL_HI = "#c6cad4"
# Toe caps sit at the busiest, least important end of a 31-px figure; a
# darker steel keeps the material read without letting the feet outshine
# the head and kit.
TOE_METAL = "#5f636d"
LIVERY = "#a6533f"
LIVERY_DK = "#7d3d2f"
PALE = "#cfc3b0"
TAPE = "#b2a791"
STENCIL = "#8d8470"
SIGNAL = "#2f9e96"
SIGNAL_HOT = "#c5fff1"
PACK = "#454049"
STRAP = "#2c2530"
HOLSTER = "#221b25"
KNEEPAD = "#7d4136"
AERIAL = "#1a1218"
SCUFF = "#312c36"
# --- fodder-only materials ------------------------------------------------
# Fodder wears the muted 70%. Two rules drive these away from the hero kit,
# and neither of them is tier marking:
#   * 36 units each carrying an emissive optic would spend the whole 5% signal
#     budget on ambient decoration, which #68 forbids outright. Fodder optics
#     are therefore DARK, and the only fodder emission in the roster is the
#     marksman muzzle flash, which exists for one frame.
#   * the brute shield is the largest single mass in the crowd. As bright
#     steel it out-values everything including the board; as a dark slab it
#     does what a shield should do at 11 px, which is make a shape.
# Fodder cloth is deliberately a step LIGHTER than the hero coat. At 11 px a
# 1 px plum-black contour takes the outer ring of a 7 px-wide body, so a unit
# authored at the hero's value simply becomes a hole in the board. Legs stay
# dark: a light torso over dark legs is the one internal value break that
# still reads when the whole figure is eleven pixels tall.
# Round 5. The cofounder's read of the round-4 crowd was "the color of the
# troops also seems pretty lacking in detail", and the atlas agrees with him in
# numbers: measured over all eight idle facings at the large register, a brute
# was 43.7% plum-black contour and a marksman 54.6%, and the eight commonest
# colours on either unit contained no warm entry at all — the whole roster was
# grey-violet, and the brightest thing on a fodder unit was a 3-px specular
# highlight on its blade. Three things follow, and none of them spend the 5%
# signal budget, because none of them are emissive:
#
#   * a real VALUE LADDER down the figure — light pauldron, mid cloth, dark
#     hem, darker leg, darkest boot — so the silhouette has internal structure
#     instead of one mass with confetti on it;
#   * a LIVERY mass big enough to survive at eleven art pixels. It is in the
#     rust ramp, which `FACTION_B_LIVERY` already remaps to steel, so it is the
#     first thing on a fodder unit that tells the two armies apart at a glance
#     and it costs no extra render to do it;
#   * a GRIME value at the hem and the boots, which is where a soldier's kit
#     actually gets dirty, and which doubles as the bottom rung of the ladder.
#
# The blade and barrel come DOWN. `METAL_BANDS`' lit rung clips and is then
# normalised back to saturation by `band_headroom`, so every metal part in the
# roster resolves to near-white; on a 60-px hero that is a cybernetic arm, on an
# 11-px fodder unit it is the loudest thing on screen for no reason.
FODDER_CLOTH = "#55635e"
FODDER_CLOTH_DK = "#39423f"
FODDER_PLATE = "#585460"
# Pulled down from #6f6b7a after the first round-5 loupe: pauldrons plus a
# plated shield rim put three light masses across the top of an 11-px unit and
# the brute read as a pile of grey boxes rather than as a soldier. The value
# ladder needs a top rung, not a spotlight.
FODDER_PAULDRON = "#5b5766"
FODDER_SHIELD = "#2e2a33"
FODDER_TRIM = "#8a4436"
# Chosen by working the cel bands backwards, not by eye: under CLOTH_BANDS this
# base resolves to rust-1 / rust-2 / rust-3 for shadow / mid / lit. Landing ON
# the rust ramp is the whole point — `FACTION_B_LIVERY` remaps rust-1..4 to
# steel-1..4, so a torso in this colour is the one mass that tells the two
# armies apart, and the second army still costs zero renders. A first pass put
# the livery on a chest PANEL instead; measured, it was five pixels at the large
# register and 0% of the small one, which is what "lacking in detail" looks like
# in numbers. The livery has to be the torso or it is not there at all.
FODDER_LIVERY = "#7e3a2c"
FODDER_LIVERY_DK = "#582822"
FODDER_GRIME = "#26222c"
FODDER_STEEL = "#4a4e58"
FODDER_OPTIC = "#241a22"
# Round 6. Thin limbs are two or three art pixels wide at every register below
# `xl`, and a 3-px limb in the same value as the torso is not a limb, it is a
# bulge. The sleeve therefore goes a clear step DARKER than the cloth so the
# negative space between arm and torso has a dark edge on its outer side as well
# as its inner one — the gap reads even in the facings where it closes to zero.
FODDER_SLEEVE = "#2f353a"
FODDER_GLOVE = "#1e2226"

# --- metal-slug-tactics hero ----------------------------------------------
# Round 6. The cofounder asked to see the hero redrawn in the design a parallel
# exploration produced (`docs/art-direction/hero-design-fanout`, style
# `metal-slug-tactics`). That artifact is a 2D pixel grid at 28 and 44 rows; this
# is a 3D rig, so what crosses over is the design's INTENT, not its pixels:
#
#   * two goggle lenses either side of a real nose block, with a mouth and a
#     chin under them — the grid spends five of its forty-four rows on a face
#     that is doing something, where every other candidate spends one on a visor;
#   * OVERSIZED gear: a helmet brim wider than the shoulders and boots wider
#     than the calves, so the silhouette has three distinct widths down its
#     height instead of tapering smoothly;
#   * arms that leave the body at the shoulder and come back at the wrist. An
#     independent cold judge measured this candidate as having the deepest
#     negative space of the eight (2-5 px on both sides across seventeen rows)
#     and the only genuinely asymmetric pose (mask symmetry 0.614 against
#     0.72-0.89 for the rest). Both are preserved deliberately;
#   * ink-like contours and clustered shading, which this lane already has in
#     `ink.ts` and `consolidate.ts` and does not need to re-invent.
#
# Its known defect, which the same judge found and this rig has to fix: it
# FLOATS. The grid's contact span is 8 px under a 32 px body, the narrowest in
# the set, so the figure hovers over its own drop shadow. The boots below are
# long, wide and splayed for exactly that reason, and the contact span is
# measured per register in round-6-negative-space.json rather than asserted.
MST_COAT = "#414f4c"
MST_COAT_DK = "#2f3a39"
MST_COAT_LT = "#5c6a65"
# The sleeve is the rust ramp on purpose: it is the one warm mass on the figure
# and it is on the ARMS, which is what makes the arm/torso window read as two
# different materials meeting a gap rather than as one shape with a notch in it.
MST_SLEEVE = "#a8503a"
MST_SLEEVE_DK = "#7a3a2c"
MST_GLOVE = "#48212a"
MST_TROUSER = "#4b4655"
MST_TROUSER_DK = "#2f2b38"
MST_BOOT = "#5c4c45"
MST_BOOT_DK = "#2b252b"
MST_STRAP = "#241a28"
MST_SKIN = "#d6875c"
MST_SKIN_DK = "#8a4a38"
MST_LENS = "#e8ded0"

# --- minimum feature size -------------------------------------------------
# A finding, not a fudge. The rival rig was authored for a REAL-TIME 60-px
# view, where a 0.03-unit stencil tick is half a pixel of harmless texture
# that temporal motion smooths over. Baked at 16 art px per world unit with a
# point sampling filter, that same tick becomes a single hard pixel that flicks
# on and off between facings — noise, not detail. So every decorative feature
# is floored at ~1.2 art px, and the features that cannot be grown without
# lying about the kit (the unit stencil) are dropped outright.
ART_PX = 1.0 / 16.0
# Rig-LOCAL minimum feature size, rebound per bake by `set_unit_scale`. A rig
# rendered at 0.31x has to floor its details at 1/0.31 of the authored size to
# still land ~1.2 art px on screen. This is the whole reason a procedural rig
# can be re-rendered at a new size for free while a hand-authored sprite has
# to be redrawn: the minimum readable feature is a property of the OUTPUT
# resolution, and only a generator can honour it at every scale.
MIN_FEATURE = ART_PX * 1.2
# A decorative feature that cannot reach the floor without more growth than
# this is not drawn at all. Inflating a 0.055-unit visor slit fourfold is not
# "the artist chose a bigger mark", it is a deformity; a pixel artist working
# at 14 px simply omits the pocket. Every omission is counted and reported.
MAX_DETAIL_GROWTH = 1.75
_DROPPED = [0]


def set_unit_scale(scale):
    """Rebind the readable-feature floor for a rig about to be scaled."""
    global MIN_FEATURE
    MIN_FEATURE = (ART_PX * 1.2) / scale


def feat(*dims):
    """Floor each dimension at the minimum readable feature size."""
    return tuple(max(d, MIN_FEATURE) for d in dims)


def readable(size):
    """Can this decorative feature reach the floor without lying about it?"""
    return max(size) * MAX_DETAIL_GROWTH >= MIN_FEATURE

# Key direction (surface -> light), the rival lane's key mapped into Blender.
KEY = (0.6245, -0.039, 0.7807)
# Three-band ramp thresholds on u = dot * 0.5 + 0.5, matching cel.ts's
# 16-texel gradient map (shadow < 9/16, mid < 13/16, lit above).
BAND_STOPS = (0.0, 9.0 / 16.0, 13.0 / 16.0)
# Linear-space band multipliers. The rival lane's three.js stack multiplies
# base colour by roughly (0.80 / 2.57 / 4.13) once its key intensity of 12
# and mauve ambient are worked through Lambert's 1/pi — which CLIPS every
# saturated lit surface to the same near-white. Clipping is fatal here: the
# quantizer downstream needs distinct band colours to land on distinct
# palette entries. So the bands below keep the rival's value STRUCTURE
# (deep cool shadow, clear mid, warm lit) with the top pulled just under
# saturation, widening the ramp instead of blowing it out.
BAND_MULTIPLIERS = ((0.62, 0.52, 0.66), (1.70, 1.58, 1.50), (3.00, 2.75, 2.40))
BAND_GAIN = 3.10
BAND_COLORS = tuple(
    tuple(channel / BAND_GAIN for channel in band) for band in BAND_MULTIPLIERS
)


def band_headroom(base_linear, top=None):
    """Per-material gain that puts the LIT band exactly at saturation, no higher.

    A flat gain would clip the rust livery's lit band and drag its hue toward
    pink while leaving the dark cloth needlessly dim. Scaling each material by
    its own headroom keeps hue exact, maximises the value spread every material
    gets, and — the part that matters downstream — stops several saturated
    materials from collapsing onto the same near-white palette entry.
    """
    peak = max(base * band for base, band in zip(base_linear, top or BAND_MULTIPLIERS[2]))
    return 1.0 if peak <= 1.0 else 1.0 / peak


# --- scene plumbing -------------------------------------------------------

_MATS = {}
_ID_MATS = []
_PARTS = []


# Cloth and metal have to part on VALUE, not hue. The i1/i2 critiques both
# measured the nearest pair across the material boundary at two luminance
# levels apart -- the same grey twice -- because both families were riding the
# same band multipliers over base colours only a hue rotation apart. Giving
# each family its own band range puts a clear stop between the brightest cloth
# and the darkest metal, which is the only separation that survives a 22-px
# figure.
# Per-band warm/cool tint, kept identical across families so only the VALUE
# range differs: the two materials must part on luminance, not on a new hue.
BAND_TINT = tuple(
    tuple(channel / band[0] for channel in band) for band in BAND_MULTIPLIERS
)


def band_range(shadow, mid, lit):
    """Turn a scalar shadow/mid/lit range into tinted per-channel bands."""
    return tuple(
        tuple(level * channel for channel in tint)
        for level, tint in zip((shadow, mid, lit), BAND_TINT)
    )


CLOTH_BANDS = band_range(0.64, 1.58, 2.58)
METAL_BANDS = band_range(1.50, 2.35, 3.10)
# Fodder metal. The top rung is chosen to stay UNDER the clip point so
# `band_headroom` leaves it alone: a fodder blade should read as a hard edge in
# the crowd, not as the brightest object in the frame.
FODDER_METAL_BANDS = band_range(0.80, 1.55, 2.30)


def cel_material(hex_color: str, bands=None):
    """Hard three-band cel emission. Cached per colour AND band range.

    Keying the cache on colour alone was a latent bug: asking for the same hex
    under two band ranges silently returned whichever was built first. Nothing
    in the round-1..4 rigs did that, so this changes no existing pixel — but
    round 5 puts cloth and metal ramps on adjacent greys and would have hit it.
    """
    multipliers = bands or BAND_MULTIPLIERS
    cache_key = f"{hex_color}|{multipliers[2]}"
    existing = _MATS.get(cache_key)
    if existing is not None:
        return existing

    mat = bpy.data.materials.new(f"cel_{hex_color.lstrip('#')}")
    mat.use_nodes = True
    tree = mat.node_tree
    tree.nodes.clear()

    geom = tree.nodes.new("ShaderNodeNewGeometry")
    dot = tree.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = KEY
    tree.links.new(geom.outputs["Normal"], dot.inputs[0])

    remap = tree.nodes.new("ShaderNodeMath")
    remap.operation = "MULTIPLY_ADD"
    remap.inputs[1].default_value = 0.5
    remap.inputs[2].default_value = 0.5
    tree.links.new(dot.outputs["Value"], remap.inputs[0])

    ramp = tree.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    while len(ramp.color_ramp.elements) > 1:
        ramp.color_ramp.elements.remove(ramp.color_ramp.elements[-1])
    normalised = tuple(tuple(c / BAND_GAIN for c in band) for band in multipliers)
    ramp.color_ramp.elements[0].position = BAND_STOPS[0]
    ramp.color_ramp.elements[0].color = (*normalised[0], 1.0)
    for stop, band in zip(BAND_STOPS[1:], normalised[1:]):
        element = ramp.color_ramp.elements.new(stop)
        element.color = (*band, 1.0)
    tree.links.new(remap.outputs["Value"], ramp.inputs["Fac"])

    tint = tree.nodes.new("ShaderNodeMixRGB")
    tint.blend_type = "MULTIPLY"
    tint.inputs["Fac"].default_value = 1.0
    tint.inputs["Color1"].default_value = (*hex_to_linear(hex_color), 1.0)
    tree.links.new(ramp.outputs["Color"], tint.inputs["Color2"])

    emit = tree.nodes.new("ShaderNodeEmission")
    # Gain lives on Strength, not in the ramp: ColorRamp stops clamp at 1.0.
    emit.inputs["Strength"].default_value = BAND_GAIN * band_headroom(
        hex_to_linear(hex_color), multipliers[2],
    )
    tree.links.new(tint.outputs["Color"], emit.inputs["Color"])
    out = tree.nodes.new("ShaderNodeOutputMaterial")
    tree.links.new(emit.outputs["Emission"], out.inputs["Surface"])

    _MATS[cache_key] = mat
    return mat


def flat_material(hex_color: str):
    """Unlit emission for the scarce signal accents and pure-ink props."""
    key = f"flat:{hex_color}"
    existing = _MATS.get(key)
    if existing is not None:
        return existing

    mat = bpy.data.materials.new(f"flat_{hex_color.lstrip('#')}")
    mat.use_nodes = True
    tree = mat.node_tree
    tree.nodes.clear()
    emit = tree.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = (*hex_to_linear(hex_color), 1.0)
    out = tree.nodes.new("ShaderNodeOutputMaterial")
    tree.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    _MATS[key] = mat
    return mat


def id_material(index: int):
    """Flat emission encoding a part id in the red channel (exact 8-bit)."""
    while len(_ID_MATS) <= index:
        slot = len(_ID_MATS)
        mat = bpy.data.materials.new(f"id_{slot:03d}")
        mat.use_nodes = True
        tree = mat.node_tree
        tree.nodes.clear()
        emit = tree.nodes.new("ShaderNodeEmission")
        emit.inputs["Color"].default_value = (
            srgb_to_linear(slot / 255.0), 0.0, 0.0, 1.0,
        )
        out = tree.nodes.new("ShaderNodeOutputMaterial")
        tree.links.new(emit.outputs["Emission"], out.inputs["Surface"])
        _ID_MATS.append(mat)
    return _ID_MATS[index]


def empty(name: str, parent=None, location=(0.0, 0.0, 0.0)):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_size = 0.05
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    obj.location = location
    return obj


def _register(obj, mat):
    """Give a part its own mesh material slot and a stable ink id."""
    index = len(_PARTS) + 1  # 0 is reserved for background
    obj.data.materials.append(mat)
    _PARTS.append((obj, mat, id_material(index)))
    return obj


def box(name, size, at, mat, parent, rot=None):
    """Box. `size`/`at`/`rot` are given in THREE order/axes (w, h, d)."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    obj.scale = (size[0], size[2], size[1])
    obj.location = (at[0], -at[2], at[1])
    if rot is not None:
        obj.rotation_euler = (rot[0], -rot[2], rot[1])
    return _register(obj, mat)


def detail_box(name, size, at, mat, parent, rot=None):
    """A decorative box: drawn at the readable floor, or not drawn at all.

    Structural masses (chest, legs, head, weapon) always draw. Everything that
    only carries surface history goes through here, so shrinking the rig
    prunes the trim instead of turning it into sub-pixel confetti that flicks
    on and off between facings.
    """
    if not readable(size):
        _DROPPED[0] += 1
        return None
    return box(name, feat(*size), at, mat, parent, rot=rot)


def cylinder(name, radius, length, at, mat, parent, axis="z"):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=10,
        radius1=radius, radius2=radius, depth=length,
    )
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = (at[0], -at[2], at[1])
    if axis == "z":  # THREE +Z (forward) -> Blender -Y
        obj.rotation_euler = (math.pi / 2, 0.0, 0.0)
    return _register(obj, mat)


# --- rig ------------------------------------------------------------------


def build_leg(side, root):
    hip = empty(f"hip{side}", root, (side * 0.13, 0.0, 0.84))
    box("thigh", (0.17, 0.36, 0.19), (0, -0.2, 0), cel_material(PANTS, CLOTH_BANDS), hip)
    knee = empty(f"knee{side}", hip, (0.0, 0.0, -0.38))
    box("shin", (0.15, 0.3, 0.16), (0, -0.16, 0), cel_material(SHIN, CLOTH_BANDS), knee)
    if side == -1:
        detail_box("shin_tape", (0.175, 0.06, 0.185), (0, -0.12, 0.005), flat_material(TAPE), knee)
    box("boot", (0.24, 0.15, 0.42), (0, -0.385, 0.09), cel_material(BOOT, CLOTH_BANDS), knee)
    box("toe", (0.245, 0.11, 0.13), (0, -0.41, 0.28), cel_material(METAL, METAL_BANDS), knee)
    # Chip-led wear: a notched, scuffed heel block (the r2 critique's lesson).
    detail_box("boot_scuff", (0.09, 0.05, 0.1), (side * 0.07, -0.325, -0.115), flat_material(SCUFF), knee)
    return hip, knee


def build_arm(side, cyber, torso):
    shoulder = empty(f"shoulder{side}", torso, (side * 0.31, 0.0, 0.44))
    box("sleeve", (0.14, 0.3, 0.15), (0, -0.17, 0), cel_material(COAT, CLOTH_BANDS), shoulder)
    elbow = empty(f"elbow{side}", shoulder, (0.0, 0.0, -0.34))
    if cyber:
        box("forearm", (0.14, 0.27, 0.15), (0, -0.15, 0), cel_material(METAL, METAL_BANDS), elbow)
    else:
        box("forearm", (0.13, 0.26, 0.14), (0, -0.15, 0), cel_material(COAT_DARK, CLOTH_BANDS), elbow)
        detail_box("wrist_wrap", (0.155, 0.07, 0.165), (0, -0.03, 0.005), flat_material(TAPE), elbow)
    hand = empty(f"hand{side}", elbow, (0.0, 0.0, -0.33))
    if cyber:
        box("fist", (0.2, 0.16, 0.18), (0, -0.06, 0), cel_material(METAL, METAL_BANDS), hand)
    else:
        box("fist", (0.19, 0.15, 0.17), (0, -0.06, 0), cel_material(SKIN), hand)
    return shoulder, elbow, hand


def cross_plate(width, at, parent, flip=False):
    """The pale cross: the mark that must survive grayscale and 31 px."""
    del flip
    detail_box("cross_v", (width * 0.4, width * 1.15, 0.03), at, flat_material(PALE), parent)
    detail_box("cross_h", (width, width * 0.4, 0.03), at, flat_material(PALE), parent)


def build_injector(hand):
    tool = empty("tool", hand, (0.0, -0.04, -0.08))
    cylinder("inj_body", 0.065, 0.4, (0, -0.02, 0.16), cel_material(METAL, METAL_BANDS), tool)
    detail_box("inj_gleam", (0.03, 0.03, 0.34), (0, 0.055, 0.16), flat_material(METAL_HI), tool)
    box("inj_tank", (0.1, 0.1, 0.14), (0, 0.07, 0.05), cel_material(LIVERY), tool)
    box("inj_grip", (0.06, 0.12, 0.07), (0, -0.1, 0.02), cel_material(BOOT, CLOTH_BANDS), tool)
    tip = empty("tip", tool, (0.0, -0.4, -0.02))
    needle = cylinder("inj_needle", 0.042, 0.12, (0, 0, 0), flat_material(SIGNAL), tip)
    burst = empty("burst", tool, (0.0, -0.52, -0.02))
    box("burst_core", (0.20, 0.20, 0.06), (0, 0, 0), flat_material(SIGNAL_HOT), burst)
    box("burst_bar", (0.34, 0.07, 0.05), (0, 0, 0), flat_material(SIGNAL), burst)
    return tip, needle, burst


def build_medic():
    root = empty("root")
    pelvis = empty("pelvis", root, (0.0, 0.0, 0.9))
    box("hem", (0.46, 0.26, 0.32), (0, 0.02, 0), cel_material(COAT_DARK, CLOTH_BANDS), pelvis)
    box("holster", (0.12, 0.18, 0.1), (0.26, -0.04, 0.06), cel_material(HOLSTER), pelvis)
    # Slung medkit. The r1 critique found no medic in any of eight facings —
    # a cross the size of three pixels is a colour patch, not an identity. This
    # is a mass that leaves the body outline, so the read survives grayscale
    # and survives being 21 px wide.
    box("kit", (0.26, 0.24, 0.20), (-0.31, 0.02, 0.05), cel_material(LIVERY), pelvis)
    detail_box("kit_lid", (0.26, 0.06, 0.20), (-0.31, 0.15, 0.05), cel_material(LIVERY_DK), pelvis)
    cross_plate(0.14, (-0.31, 0.02, 0.16), pelvis)
    cross_plate(0.14, (-0.31, 0.02, -0.06), pelvis)
    detail_box("kit_sling", (0.07, 0.5, 0.07), (-0.22, 0.32, 0.11), flat_material(STRAP), pelvis, rot=(0, 0, -0.5))

    torso = empty("torso", pelvis, (0.0, 0.0, 0.12))
    box("chest", (0.5, 0.44, 0.34), (0, 0.28, 0), cel_material(COAT, CLOTH_BANDS), torso)
    detail_box("pocket", (0.16, 0.13, 0.03), (-0.16, 0.15, 0.185), flat_material(COAT_DARK), torso)
    # Chest rig + cross plate + strap + steel buckle.
    box("chest_rig", (0.33, 0.30, 0.08), (0.05, 0.235, 0.19), cel_material(LIVERY), torso)
    cross_plate(0.17, (0.05, 0.235, 0.245), torso)
    detail_box("strap", (0.56, 0.085, 0.03), (-0.02, 0.3, 0.19), flat_material(STRAP), torso, rot=(0, 0, 0.55))
    box("buckle", (0.09, 0.08, 0.035), (-0.14, 0.36, 0.2), flat_material(METAL), torso)
    # Field pack.
    box("pack", (0.40, 0.46, 0.30), (0, 0.22, -0.32), cel_material(PACK, CLOTH_BANDS), torso)
    box("pack_plate", (0.26, 0.30, 0.05), (-0.02, 0.22, -0.47), cel_material(LIVERY), torso)
    cross_plate(0.15, (-0.02, 0.25, -0.505), torso, flip=True)
    # The rival's three-tick unit stencil is 0.3 art px per tick — dropped, and
    # its history re-spent as one readable painted bar.
    detail_box("stencil_bar", (0.17, 0.05, 0.025), (-0.02, 0.055, -0.51), flat_material(STENCIL), torso)
    detail_box("pack_scuff", (0.22, 0.07, 0.16), (0.05, 0.44, -0.32), flat_material(SCUFF), torso)
    detail_box("pack_worn", (0.085, 0.32, 0.085), (-0.21, 0.22, -0.33), flat_material(LIVERY_DK), torso)

    head = empty("head", torso, (0.0, 0.0, 0.46))
    box("neck", (0.14, 0.1, 0.13), (0, 0.02, 0), cel_material(SKIN), head)
    box("hood", (0.36, 0.34, 0.34), (0, 0.17, -0.02), cel_material(HOOD, CLOTH_BANDS), head)
    box("face", (0.24, 0.18, 0.08), (0, 0.13, 0.15), cel_material(SKIN), head)
    box("brow", (0.27, 0.09, 0.1), (0, 0.205, 0.15), flat_material(BROW), head)
    detail_box("visor", (0.2, 0.055, 0.025), (0, 0.155, 0.205), flat_material(SIGNAL), head)

    shoulder_l, elbow_l, hand_l = build_arm(-1, True, torso)
    shoulder_r, elbow_r, hand_r = build_arm(1, False, torso)
    box("pad", (0.24, 0.11, 0.26), (-0.04, 0.06, 0), cel_material(LIVERY), shoulder_l)
    detail_box("pad_chip", (0.085, 0.06, 0.1), (-0.14, 0.09, 0.095), flat_material(LIVERY_DK), shoulder_l)

    tip, needle, burst = build_injector(hand_r)

    hip_l, knee_l = build_leg(-1, root)
    hip_r, knee_r = build_leg(1, root)
    box("kneepad", (0.16, 0.12, 0.08), (0, -0.04, 0.1), cel_material(KNEEPAD), knee_r)

    return {
        "root": root, "pelvis": pelvis, "torso": torso, "head": head,
        "shoulderL": shoulder_l, "elbowL": elbow_l,
        "shoulderR": shoulder_r, "elbowR": elbow_r,
        "hipL": hip_l, "kneeL": knee_l, "hipR": hip_r, "kneeR": knee_r,
        "tip": tip, "needle": needle, "burst": burst,
        "_bind": BIND,
    }


# --- fodder tier ----------------------------------------------------------
# Two archetypes that have to be told apart at ELEVEN art pixels, where
# neither material nor colour survives. Everything is spent on gross shape:
#
#   brute    — wide, low, short-legged, carrying a tall slab shield that
#              doubles the body's width on one side;
#   marksman — narrow, upright, with a long barrel breaking the silhouette
#              forward at chest height and an aerial spiking above the head.
#
# They share one cloth palette on purpose. Round 4's question is whether
# SILHOUETTE alone separates two fodder archetypes, so letting colour do the
# work would answer a different one. Faction livery is applied downstream as a
# palette-index remap, which costs no render at all.

# Round 6, and the sign matters: the euler goes THREE (rx, ry, rz) -> Blender
# (rx, -rz, ry), so a point hanging at -Z under a joint swings to +X for rz > 0.
# The left shoulder sits at -X, so an OUTWARD left arm needs rz NEGATIVE and an
# outward right arm needs rz positive. Rounds 4-5 had both signs the other way
# round: every arm in the roster was rolled a little ACROSS the body, which is
# exactly why no fodder unit had daylight beside its torso at any register.
BRUTE_BIND = {
    "elbowL": (-0.22, 0, 0.07),
    "elbowR": (-0.50, 0, 0.16),
    "head": (0.12, 0, 0),
    # Legs splay outward from the hip, so the gap between them is widest at the
    # boot — the part of the figure that has the ground behind it rather than
    # the other leg.
    "hipL": (0.05, 0, -0.13),
    "hipR": (-0.05, 0, 0.15),
    "kneeL": (-0.08, 0, 0),
    "kneeR": (-0.08, 0, 0),
    "shoulderL": (0.08, 0, -0.20),
    "shoulderR": (-0.22, 0, 0.52),
    "torso": (0.13, 0.06, 0),
}

MARKSMAN_BIND = {
    # Both elbows break forward while the shoulders roll out: the arms leave the
    # body line at the shoulder, come back at the wrist, and the window they
    # enclose is a triangle rather than a slot. A slot closes the moment the
    # figure turns; a triangle keeps some width through more of the facing ring.
    "elbowL": (-0.58, 0, -0.20),
    "elbowR": (-0.50, 0, 0.22),
    "head": (-0.05, 0, 0),
    "hipL": (0.14, 0, -0.10),
    "hipR": (-0.12, 0.12, 0.13),
    "kneeL": (-0.18, 0, 0),
    "kneeR": (-0.07, 0, 0),
    "shoulderL": (-0.30, 0, -0.62),
    "shoulderR": (-0.20, 0, 0.58),
    "torso": (0.10, 0.22, 0),
}


def build_fodder_legs(side, root, hip_z, thigh, shin, boot, mat_a, mat_b, hip_x=0.15,
                     boot_mat=BOOT):
    hip = empty(f"hip{side}", root, (side * hip_x, 0.0, hip_z))
    box("thigh", thigh, (0, -thigh[1] / 2 - 0.02, 0), cel_material(mat_a, CLOTH_BANDS), hip)
    knee = empty(f"knee{side}", hip, (0.0, 0.0, -(thigh[1] + 0.02)))
    box("shin", shin, (0, -shin[1] / 2, 0), cel_material(mat_b, CLOTH_BANDS), knee)
    box("boot", boot, (0, -shin[1] - boot[1] / 2 + 0.02, 0.05),
        cel_material(boot_mat, CLOTH_BANDS), knee)
    return hip, knee


def build_brute():
    """Heavy melee fodder — round 6: the same archetype, thin and tall.

    The cofounder's round-5 note is a taste direction, not a measurement, and it
    runs the opposite way to every cold critique this lane has had: "make it
    thinner and taller and play around with negative space between arms and
    torso, and legs". So the brute keeps its two archetype events — the slab
    shield outside the body line and the widest shoulders in the roster — and
    loses the bulk everywhere else. Chest 0.96 -> 0.58 wide, hem 0.72 -> 0.36,
    limbs a third thinner, and the whole rig ~15% taller.

    Three deliberate consequences, all of them measured in round-6-negative-
    space.json rather than asserted here:

      * "heavy" can no longer be carried by width, so it moves entirely onto the
        shield and the pauldrons;
      * the arm/torso window and the leg gap are now real geometry, wide enough
        to survive the 1-px contour dilation ONLY above the `large` register;
      * a 0.58-wide chest at the small register is four art pixels of torso, so
        the value ladder inside it has fewer rungs to spend.
    """
    root = empty("root")
    pelvis = empty("pelvis", root, (0.0, 0.0, 1.10))
    # The hem is the narrowest part of the body on purpose: it is the mass the
    # leg gap has to open BELOW, and every millimetre of skirt is a row of
    # daylight that never happens.
    box("hem", (0.36, 0.30, 0.26), (0, 0.0, 0), cel_material(PANTS, CLOTH_BANDS), pelvis)
    detail_box("hem_wear", (0.34, 0.11, 0.24), (0, -0.13, 0.0),
               cel_material(FODDER_GRIME, CLOTH_BANDS), pelvis)

    torso = empty("torso", pelvis, (0.0, 0.0, 0.20))
    box("chest", (0.58, 0.60, 0.34), (0, 0.26, 0),
        cel_material(FODDER_LIVERY, CLOTH_BANDS), torso)
    box("plate", (0.44, 0.34, 0.10), (0, 0.34, 0.17), cel_material(FODDER_PLATE, CLOTH_BANDS), torso)
    box("tabard", (0.20, 0.56, 0.08), (0, 0.02, 0.19),
        cel_material(FODDER_LIVERY_DK, CLOTH_BANDS), torso)
    detail_box("plate_chip", (0.13, 0.11, 0.05), (-0.14, 0.20, 0.21), flat_material(SCUFF), torso)
    box("collar", (0.44, 0.14, 0.28), (0, 0.56, -0.02), cel_material(COAT_DARK, CLOTH_BANDS), torso)

    head = empty("head", torso, (0.0, 0.0, 0.66))
    box("helm", (0.32, 0.30, 0.30), (0, 0.12, -0.02), cel_material(HOOD, CLOTH_BANDS), head)
    detail_box("slit", (0.22, 0.05, 0.03), (0, 0.09, 0.15), flat_material(FODDER_OPTIC), head)

    # Shoulders sit WIDER than the chest by more than half a chest width. That
    # offset plus the outward roll in BRUTE_BIND is the whole negative-space
    # mechanism: the arm leaves at the shoulder and the torso does not follow.
    shoulder_l = empty("shoulderL", torso, (-0.44, 0.0, 0.54))
    box("pauldL", (0.26, 0.18, 0.28), (-0.03, 0.05, 0),
        cel_material(FODDER_PAULDRON, CLOTH_BANDS), shoulder_l)
    box("armL", (0.16, 0.34, 0.17), (0, -0.20, 0),
        cel_material(FODDER_SLEEVE, CLOTH_BANDS), shoulder_l)
    elbow_l = empty("elbowL", shoulder_l, (0.0, 0.0, -0.40))
    box("foreL", (0.14, 0.30, 0.15), (0, -0.16, 0), cel_material(FODDER_GLOVE, CLOTH_BANDS), elbow_l)
    # The shield goes narrower and TALLER with the rig. It is still the widest
    # single event on the unit, but it is now a plank rather than a door, which
    # is what stops a thin figure being re-fattened by the thing it carries.
    box("shield", (0.26, 1.00, 0.15), (-0.22, -0.14, 0.16),
        cel_material(FODDER_SHIELD, CLOTH_BANDS), elbow_l)
    box("shield_rim", (0.30, 0.14, 0.17), (-0.22, -0.64, 0.16),
        cel_material(FODDER_PLATE, CLOTH_BANDS), elbow_l)
    detail_box("shield_mark", (0.15, 0.28, 0.06), (-0.22, -0.12, 0.24),
               cel_material(FODDER_LIVERY, CLOTH_BANDS), elbow_l)

    shoulder_r = empty("shoulderR", torso, (0.44, 0.0, 0.54))
    box("pauldR", (0.26, 0.18, 0.28), (0.03, 0.05, 0),
        cel_material(FODDER_PAULDRON, CLOTH_BANDS), shoulder_r)
    box("armR", (0.16, 0.34, 0.17), (0, -0.20, 0),
        cel_material(FODDER_SLEEVE, CLOTH_BANDS), shoulder_r)
    elbow_r = empty("elbowR", shoulder_r, (0.0, 0.0, -0.40))
    box("foreR", (0.14, 0.30, 0.15), (0, -0.16, 0), cel_material(SKIN), elbow_r)
    hand_r = empty("handR", elbow_r, (0.0, 0.0, -0.32))
    box("haft", (0.08, 0.26, 0.08), (0, -0.10, 0.02), cel_material(BOOT, CLOTH_BANDS), hand_r)
    box("cleaver", (0.11, 0.56, 0.36), (0, -0.42, 0.13),
        cel_material(FODDER_STEEL, FODDER_METAL_BANDS), hand_r)

    hip_l, knee_l = build_fodder_legs(
        -1, root, 0.96, (0.18, 0.42, 0.20), (0.16, 0.40, 0.18), (0.26, 0.16, 0.38),
        PANTS, FODDER_GRIME, hip_x=0.23, boot_mat=BOOT,
    )
    hip_r, knee_r = build_fodder_legs(
        1, root, 0.96, (0.18, 0.42, 0.20), (0.16, 0.40, 0.18), (0.26, 0.16, 0.38),
        PANTS, FODDER_GRIME, hip_x=0.23, boot_mat=BOOT,
    )

    return {
        "root": root, "pelvis": pelvis, "torso": torso, "head": head,
        "shoulderL": shoulder_l, "elbowL": elbow_l,
        "shoulderR": shoulder_r, "elbowR": elbow_r,
        "hipL": hip_l, "kneeL": knee_l, "hipR": hip_r, "kneeR": knee_r,
        "_bind": BRUTE_BIND,
    }


def build_marksman():
    """Ranged fodder: a narrow upright with a long barrel and an aerial.

    Round 5 lengthens the legs, narrows the chest and pushes the barrel a third
    of a body-length further forward, so the archetype is a vertical line with
    one horizontal spike rather than a slightly thinner brute.
    """
    root = empty("root")
    pelvis = empty("pelvis", root, (0.0, 0.0, 1.24))
    box("hem", (0.24, 0.26, 0.22), (0, 0.0, 0), cel_material(PANTS, CLOTH_BANDS), pelvis)
    detail_box("hem_wear", (0.22, 0.09, 0.20), (0, -0.11, 0.0),
               cel_material(FODDER_GRIME, CLOTH_BANDS), pelvis)

    torso = empty("torso", pelvis, (0.0, 0.0, 0.16))
    # Round 5 widened this to 0.38 because a 0.34 torso was "70% contour with
    # eighteen interior pixels". Round 6 takes it back DOWN to 0.32 and buys the
    # interior back with height instead: the chest is 0.62 tall against round 5's
    # 0.52, so the same pixel count is spread over a taller, narrower column. It
    # is the one trade that satisfies "thinner and taller" without emptying the
    # figure out, and it only works because the register ladder now goes up to 56.
    box("chest", (0.32, 0.62, 0.26), (0, 0.28, 0),
        cel_material(FODDER_LIVERY, CLOTH_BANDS), torso)
    box("sash", (0.34, 0.13, 0.06), (0, 0.26, 0.13),
        cel_material(FODDER_LIVERY_DK, CLOTH_BANDS), torso, rot=(0, 0, 0.62))
    detail_box("bandolier", (0.30, 0.08, 0.04), (0, 0.08, 0.13), flat_material(STRAP), torso,
               rot=(0, 0, 0.6))
    box("pack", (0.18, 0.56, 0.15), (0, 0.24, -0.19), cel_material(PACK, CLOTH_BANDS), torso)
    box("aerial", (0.05, 0.66, 0.05), (0.09, 0.80, -0.19), cel_material(AERIAL), torso,
        rot=(0, 0, -0.13))

    head = empty("head", torso, (0.0, 0.0, 0.62))
    box("cowl", (0.22, 0.30, 0.24), (0, 0.12, -0.01),
        cel_material(FODDER_LIVERY, CLOTH_BANDS), head)
    detail_box("optic", (0.16, 0.06, 0.03), (0, 0.10, 0.13), flat_material(FODDER_OPTIC), head)

    # Shoulders at +/-0.26 against a 0.32 chest: the arm hangs entirely outside
    # the torso column before the outward roll is applied at all.
    shoulder_l = empty("shoulderL", torso, (-0.30, 0.0, 0.52))
    box("pauldL", (0.16, 0.13, 0.17), (-0.01, 0.05, 0),
        cel_material(FODDER_PAULDRON, CLOTH_BANDS), shoulder_l)
    box("armL", (0.11, 0.32, 0.12), (0, -0.18, 0),
        cel_material(FODDER_SLEEVE, CLOTH_BANDS), shoulder_l)
    elbow_l = empty("elbowL", shoulder_l, (0.0, 0.0, -0.34))
    box("foreL", (0.11, 0.26, 0.12), (0, -0.14, 0), cel_material(FODDER_GLOVE, CLOTH_BANDS), elbow_l)

    shoulder_r = empty("shoulderR", torso, (0.30, 0.0, 0.52))
    box("pauldR", (0.16, 0.13, 0.17), (0.01, 0.05, 0),
        cel_material(FODDER_PAULDRON, CLOTH_BANDS), shoulder_r)
    box("armR", (0.11, 0.32, 0.12), (0, -0.18, 0),
        cel_material(FODDER_SLEEVE, CLOTH_BANDS), shoulder_r)
    elbow_r = empty("elbowR", shoulder_r, (0.0, 0.0, -0.34))
    box("foreR", (0.11, 0.26, 0.12), (0, -0.14, 0), cel_material(SKIN), elbow_r)

    # The barrel rides the TORSO, not the hand: at this size a weapon that
    # swings with a 3-px forearm reads as jitter rather than as a weapon.
    weapon = empty("weapon", torso, (0.13, 0.10, 0.13))
    box("barrel", (0.09, 0.09, 1.34), (0, 0, 0.66),
        cel_material(FODDER_STEEL, FODDER_METAL_BANDS), weapon)
    box("stock", (0.09, 0.17, 0.30), (0, -0.05, -0.14), cel_material(BOOT, CLOTH_BANDS), weapon)
    detail_box("scope", (0.07, 0.11, 0.19), (0, 0.11, 0.18),
               cel_material(FODDER_PLATE, CLOTH_BANDS), weapon)
    muzzle = empty("muzzle", weapon, (0.0, 0.02, 1.28))
    box("flash_core", (0.16, 0.16, 0.14), (0, 0, 0), flat_material(SIGNAL_HOT), muzzle)
    box("flash_bar", (0.30, 0.06, 0.10), (0, 0, 0), flat_material(SIGNAL), muzzle)

    hip_l, knee_l = build_fodder_legs(
        -1, root, 1.10, (0.13, 0.50, 0.15), (0.12, 0.46, 0.14), (0.20, 0.14, 0.32),
        PANTS, SHIN, hip_x=0.19, boot_mat=FODDER_GRIME,
    )
    hip_r, knee_r = build_fodder_legs(
        1, root, 1.10, (0.13, 0.50, 0.15), (0.12, 0.46, 0.14), (0.20, 0.14, 0.32),
        PANTS, SHIN, hip_x=0.19, boot_mat=FODDER_GRIME,
    )

    return {
        "root": root, "pelvis": pelvis, "torso": torso, "head": head,
        "shoulderL": shoulder_l, "elbowL": elbow_l,
        "shoulderR": shoulder_r, "elbowR": elbow_r,
        "hipL": hip_l, "kneeL": knee_l, "hipR": hip_r, "kneeR": knee_r,
        "muzzle": muzzle,
        "_bind": MARKSMAN_BIND,
    }


def build_ranger():
    """The metal-slug-tactics hero, as a rig rather than as a redraw.

    Read alongside `build_medic`: same seam, same camera, same clips, same
    materials system. Everything that differs is proportion and pose, which is
    the whole argument for a procedural lane — a second hero silhouette cost one
    function and about eleven seconds of Blender, where a hand-authored lane owes
    a full second character at every register on the ladder.
    """
    root = empty("root")

    # Legs first: this rig's contact patch is load-bearing, not an afterthought.
    hip_l, knee_l = build_fodder_legs(
        -1, root, 1.02, (0.19, 0.44, 0.21), (0.17, 0.42, 0.19), (0.30, 0.16, 0.44),
        MST_TROUSER, MST_TROUSER_DK, hip_x=0.24, boot_mat=MST_BOOT,
    )
    hip_r, knee_r = build_fodder_legs(
        1, root, 1.02, (0.19, 0.44, 0.21), (0.17, 0.42, 0.19), (0.30, 0.16, 0.44),
        MST_TROUSER, MST_TROUSER_DK, hip_x=0.24, boot_mat=MST_BOOT,
    )
    # A dark sole under each boot. It is the bottom rung of the value ladder and
    # it is also the thing that makes contact legible: a light boot ending in
    # nothing reads as hovering, a light boot ending in a hard dark line reads as
    # standing on something.
    for knee, side in ((knee_l, -1), (knee_r, 1)):
        box("sole", (0.32, 0.07, 0.46), (0, -0.60, 0.02),
            cel_material(MST_BOOT_DK, CLOTH_BANDS), knee)
        detail_box("boot_cuff", (0.33, 0.09, 0.34), (0, -0.44, -0.04),
                   cel_material(MST_STRAP, CLOTH_BANDS), knee)
        del side

    pelvis = empty("pelvis", root, (0.0, 0.0, 1.16))
    box("belt", (0.34, 0.16, 0.28), (0, 0.0, 0), cel_material(MST_STRAP, CLOTH_BANDS), pelvis)
    detail_box("buckle", (0.09, 0.09, 0.04), (0.0, 0.0, 0.16), flat_material(METAL), pelvis)

    torso = empty("torso", pelvis, (0.0, 0.0, 0.18))
    # 0.44 wide against a 2.3-unit rig: narrower, proportionally, than anything
    # else in the roster. The negative space is bought here first and only then
    # widened by the shoulder offset.
    box("chest", (0.44, 0.62, 0.30), (0, 0.28, 0), cel_material(MST_COAT, CLOTH_BANDS), torso)
    box("chest_shade", (0.17, 0.58, 0.09), (-0.11, 0.28, 0.16),
        cel_material(MST_COAT_DK, CLOTH_BANDS), torso)
    # The grid's white chest emblem. It is `pale`, the only bright neutral in the
    # palette, and it is the single largest non-cloth mass on the front of the
    # figure — which is what stops a narrow torso reading as an empty column.
    detail_box("emblem", (0.15, 0.13, 0.04), (0.06, 0.30, 0.17), flat_material(PALE), torso)
    box("collar", (0.40, 0.13, 0.30), (0, 0.58, -0.01), cel_material(MST_COAT_DK, CLOTH_BANDS), torso)
    detail_box("harness", (0.46, 0.07, 0.04), (0, 0.20, 0.16), flat_material(MST_STRAP), torso,
               rot=(0, 0, 0.5))
    box("pack", (0.28, 0.42, 0.20), (0, 0.26, -0.22), cel_material(MST_COAT_DK, CLOTH_BANDS), torso)
    detail_box("pack_roll", (0.30, 0.14, 0.16), (0, 0.50, -0.22),
               cel_material(MST_SLEEVE_DK, CLOTH_BANDS), torso)

    head = empty("head", torso, (0.0, 0.0, 0.66))
    box("neck", (0.14, 0.10, 0.13), (0, 0.0, 0), cel_material(MST_SKIN_DK), head)
    # Face, mouth, chin. Three masses where every other rig in this lane has one
    # block and a visor slit.
    box("face", (0.26, 0.22, 0.11), (0, 0.13, 0.11), cel_material(MST_SKIN), head)
    detail_box("mouth", (0.12, 0.05, 0.03), (0, 0.10, 0.17), flat_material(MST_STRAP), head)
    box("chin", (0.17, 0.09, 0.09), (0, 0.03, 0.10), cel_material(MST_SKIN_DK), head)
    # The helmet. The brim is the design's signature and it is deliberately wider
    # than the shoulders: an oversized silhouette event at the TOP of the figure
    # is what a reader finds first in a crowd.
    box("helm", (0.36, 0.28, 0.34), (0, 0.30, -0.03), cel_material(MST_COAT_LT, CLOTH_BANDS), head)
    box("brim", (0.54, 0.09, 0.48), (0, 0.19, 0.04), cel_material(MST_COAT_DK, CLOTH_BANDS), head)
    detail_box("brim_lip", (0.50, 0.05, 0.07), (0, 0.15, 0.24), flat_material(MST_STRAP), head)
    # Goggle strap, then two lenses either side of a nose block that stands
    # PROUD of them — that protrusion is what puts a real cast shadow between the
    # lenses instead of a painted-on dark pixel.
    box("goggle", (0.34, 0.11, 0.30), (0, 0.24, 0.02), cel_material(MST_STRAP, CLOTH_BANDS), head)
    detail_box("lens_l", (0.11, 0.08, 0.05), (-0.08, 0.24, 0.15), flat_material(MST_LENS), head)
    detail_box("lens_r", (0.11, 0.08, 0.05), (0.08, 0.24, 0.15), flat_material(MST_LENS), head)
    box("nose", (0.07, 0.16, 0.09), (0, 0.20, 0.17), cel_material(MST_SKIN_DK), head)

    # Arms. Shoulders sit at +/-0.34 against a 0.22 chest half-width, and
    # RANGER_BIND rolls them further out; the window between arm and torso is
    # bounded above by the pauldron and open below, which is exactly the shape
    # the source grid draws.
    shoulder_l = empty("shoulderL", torso, (-0.38, 0.0, 0.52))
    box("pauldL", (0.24, 0.16, 0.26), (-0.02, 0.06, 0), cel_material(MST_COAT_LT, CLOTH_BANDS),
        shoulder_l)
    box("sleeveL", (0.15, 0.34, 0.16), (0, -0.19, 0), cel_material(MST_SLEEVE, CLOTH_BANDS),
        shoulder_l)
    elbow_l = empty("elbowL", shoulder_l, (0.0, 0.0, -0.38))
    box("foreL", (0.14, 0.30, 0.15), (0, -0.16, 0), cel_material(MST_SLEEVE_DK, CLOTH_BANDS),
        elbow_l)
    detail_box("cuffL", (0.16, 0.07, 0.17), (0, -0.03, 0), flat_material(MST_STRAP), elbow_l)
    hand_l = empty("handL", elbow_l, (0.0, 0.0, -0.34))
    box("fistL", (0.16, 0.14, 0.15), (0, -0.05, 0), cel_material(MST_GLOVE, CLOTH_BANDS), hand_l)

    shoulder_r = empty("shoulderR", torso, (0.38, 0.0, 0.52))
    box("pauldR", (0.24, 0.16, 0.26), (0.02, 0.06, 0), cel_material(MST_COAT_LT, CLOTH_BANDS),
        shoulder_r)
    box("sleeveR", (0.15, 0.34, 0.16), (0, -0.19, 0), cel_material(MST_SLEEVE, CLOTH_BANDS),
        shoulder_r)
    elbow_r = empty("elbowR", shoulder_r, (0.0, 0.0, -0.38))
    box("foreR", (0.14, 0.30, 0.15), (0, -0.16, 0), cel_material(MST_SLEEVE_DK, CLOTH_BANDS),
        elbow_r)
    detail_box("cuffR", (0.16, 0.07, 0.17), (0, -0.03, 0), flat_material(MST_STRAP), elbow_r)
    hand_r = empty("handR", elbow_r, (0.0, 0.0, -0.34))
    box("fistR", (0.16, 0.14, 0.15), (0, -0.05, 0), cel_material(MST_GLOVE, CLOTH_BANDS), hand_r)

    # The teal emitter. Named `tip`/`needle`/`burst` so `apply_pose` drives it
    # with the medic's own emission budget rules and no new branch: one bright
    # frame of contact, one dim frame, effectively invisible otherwise.
    tool = empty("tool", hand_r, (0.0, -0.06, -0.06))
    cylinder("emit_body", 0.07, 0.36, (0, -0.02, 0.16), cel_material(METAL, METAL_BANDS), tool)
    box("emit_grip", (0.08, 0.14, 0.09), (0, -0.10, 0.01), cel_material(MST_STRAP, CLOTH_BANDS),
        tool)
    detail_box("emit_band", (0.09, 0.09, 0.05), (0, 0.02, 0.24), flat_material(MST_SLEEVE), tool)
    tip = empty("tip", tool, (0.0, -0.02, 0.36))
    needle = cylinder("emit_core", 0.045, 0.11, (0, 0, 0), flat_material(SIGNAL), tip)
    burst = empty("burst", tool, (0.0, -0.02, 0.50))
    box("burst_core", (0.20, 0.20, 0.06), (0, 0, 0), flat_material(SIGNAL_HOT), burst)
    box("burst_bar", (0.34, 0.07, 0.05), (0, 0, 0), flat_material(SIGNAL), burst)

    return {
        "root": root, "pelvis": pelvis, "torso": torso, "head": head,
        "shoulderL": shoulder_l, "elbowL": elbow_l,
        "shoulderR": shoulder_r, "elbowR": elbow_r,
        "hipL": hip_l, "kneeL": knee_l, "hipR": hip_r, "kneeR": knee_r,
        "tip": tip, "needle": needle, "burst": burst,
        "_bind": RANGER_BIND,
    }


# --- pose engine ----------------------------------------------------------
# Baked clips are SHORT on purpose: every frame costs 8 atlas cells. The
# rival real-time lane can afford a 4.8 s idle at 8 poses/sec (38 unique
# poses); a baked lane cannot, so the acting is re-authored to fit 8/12/6
# frames. That compression is a finding, not an accident.

BIND = {
    "elbowL": (-0.28, 0, 0),
    "elbowR": (-0.55, 0, 0),
    "head": (0.04, 0, 0),
    "hipL": (0.1, 0, 0),
    "hipR": (-0.08, 0.15, 0),
    "kneeL": (-0.12, 0, 0),
    "kneeR": (-0.06, 0, 0),
    "shoulderL": (0.12, 0, 0.06),
    "shoulderR": (-0.15, 0, -0.08),
    "torso": (0.07, 0.1, 0),
}

# The asymmetric stance, kept because it is the source design's rarest property:
# an independent judge measured its mask symmetry at 0.614 where every other
# candidate in the fan-out sat between 0.72 and 0.89. Nothing here mirrors —
# different shoulder roll, different elbow break, different hip angle, weight on
# the left leg. It costs nothing (a bind table is ten tuples) and it is the
# difference between a character and a mannequin standing at attention.
RANGER_BIND = {
    "elbowL": (-0.46, 0, -0.20),
    "elbowR": (-0.86, 0.10, 0.16),
    "head": (0.03, -0.16, 0),
    "hipL": (0.16, 0, -0.15),
    "hipR": (-0.20, 0.16, 0.19),
    "kneeL": (-0.10, 0, 0),
    "kneeR": (-0.22, 0, 0),
    "shoulderL": (0.10, 0, -0.60),
    "shoulderR": (-0.30, 0, 0.50),
    "torso": (0.05, 0.14, -0.04),
}

JOINTS = ("torso", "head", "shoulderL", "elbowL", "shoulderR", "elbowR",
          "hipL", "kneeL", "hipR", "kneeR", "pelvis")


def empty_pose():
    return {"rot": {}, "lunge": 0.0, "dip": 0.0, "sway": 0.0,
            "squash": 1.0, "flash": False, "spark": False}


# Stepped idle. The r1 critique measured ONE native pixel of head travel across
# the whole cycle while 25-33% of interior pixels churned on every step — an
# outline that stands still inside a body that shimmers, which is the worst
# combination available and the most expensive. These are authored per-frame
# values with held beats, so the SILHOUETTE moves ~3 art px and the interior
# holds.
IDLE_LIFT = (0.00, 0.00, 0.07, 0.15, 0.19, 0.19, 0.11, 0.04)
IDLE_GLANCE = (0.0, 0.0, 0.0, 0.30, 0.30, 0.30, 0.10, 0.0)


def idle_pose(frame, count):
    """8 frames at 8 fps: a real breath lift, a held glance, one kit check."""
    del count
    pose = empty_pose()
    lift = IDLE_LIFT[frame]
    pose["dip"] = -lift
    # Chest and shoulders follow the lift rather than running on their own
    # sine, so nothing moves that the outline does not also move.
    pose["rot"]["torso"] = (-0.16 * lift, 0.0, 0.0)
    pose["rot"]["shoulderL"] = (-0.25 * lift, 0, 0)
    pose["rot"]["shoulderR"] = (-0.25 * lift, 0, 0)
    pose["rot"]["head"] = (-0.10 * lift, IDLE_GLANCE[frame], 0)
    if frame in (6, 7):
        pose["rot"]["elbowR"] = (-0.24 if frame == 6 else -0.12, 0, 0)
    pose["flash"] = frame == 6
    return pose


def attack_pose(frame, count):
    """12 frames at 12 fps: coil, held anticipation, lunge, HIT-STOP, recover."""
    pose = empty_pose()
    if frame <= 3:
        coil = min(1.0, frame / 2.0)
        pose["rot"]["torso"] = (-0.06 * coil, 0.45 * coil, 0)
        pose["rot"]["shoulderR"] = (0.68 * coil, 0, -0.12 * coil)
        pose["rot"]["elbowR"] = (-0.68 * coil, 0, 0)
        pose["rot"]["head"] = (0, -0.22 * coil, 0)
        pose["rot"]["hipR"] = (-0.2 * coil, 0, 0)
        pose["lunge"] = -0.1 * coil
        pose["squash"] = 1.0 + 0.03 * coil
    elif frame <= 8:
        strike = min(1.0, (frame - 3) / 2.0)
        pose["rot"]["torso"] = (0.10 * strike, 0.45 - 0.85 * strike, 0)
        pose["rot"]["shoulderR"] = (0.68 - 2.25 * strike, 0, 0)
        pose["rot"]["elbowR"] = (-0.68 + 0.66 * strike, 0, 0)
        pose["rot"]["head"] = (0.12 * strike, -0.22 + 0.3 * strike, 0)
        pose["rot"]["hipL"] = (0.58 * strike, 0, 0)
        pose["rot"]["kneeL"] = (-0.38 * strike, 0, 0)
        pose["rot"]["hipR"] = (-0.52 * strike, 0, 0)
        pose["rot"]["shoulderL"] = (0.36 * strike, 0, 0.16 * strike)
        pose["lunge"] = -0.1 + 0.4 * strike
        # f4 stretches into contact, f5 squashes, f6-f8 HOLD the hit. The
        # squash is shallower than the rival's: at 31 px a 0.80 squash stops
        # reading as weight and starts reading as the figure collapsing.
        pose["squash"] = {4: 1.08, 5: 0.88}.get(frame, 0.91)
        pose["flash"] = frame >= 5
        pose["spark"] = frame == 5
    else:
        back = 1.0 - (frame - 8) / 3.0
        pose["rot"]["torso"] = (0.10 * back, -0.4 * back, 0)
        pose["rot"]["shoulderR"] = (-1.32 * back, 0, 0)
        pose["rot"]["elbowR"] = (-0.16 * back, 0, 0)
        pose["rot"]["hipL"] = (0.58 * back, 0, 0)
        pose["rot"]["kneeL"] = (-0.38 * back, 0, 0)
        pose["rot"]["hipR"] = (-0.52 * back, 0, 0)
        pose["lunge"] = 0.3 * back
    return pose


def pivot_pose(frame, count):
    """6 frames at 12 fps, played on every facing change.

    The rival lane's r2 critique flagged a missing vertical HOP in its turn.
    A baked clip can simply author one: crouch, lift (feet off), apex,
    land hard, settle. `facingLead` is consumed by the runtime, which shows
    the OLD facing for the anticipation frames so the head/body lead reads.
    """
    pose = empty_pose()
    lift = (0.0, -0.05, 0.16, 0.2, -0.06, 0.0)[frame]
    pose["dip"] = -lift
    settle = (0.0, 0.0, 0.0, 0.0, 1.0, 0.45)[frame]
    antic = (0.35, 1.0, 0.55, 0.2, 0.0, 0.0)[frame]
    pose["rot"]["torso"] = (0.04 - 0.09 * antic, -0.22 * antic, 0.3 * settle)
    pose["rot"]["head"] = (0.02, -1.0 * antic + 0.45 * settle, 0)
    pose["rot"]["hipL"] = (0.4 * settle + 0.18 * antic, 0, 0.1 * antic)
    pose["rot"]["kneeL"] = (-0.5 * settle - 0.22 * antic, 0, 0)
    pose["rot"]["hipR"] = (-0.12 * settle - 0.14 * antic, 0, 0)
    pose["rot"]["kneeR"] = (-0.3 * antic, 0, 0)
    pose["rot"]["shoulderL"] = (0, 0, 0.18 * settle)
    pose["rot"]["shoulderR"] = (0, 0, -0.18 * settle)
    pose["squash"] = 1.0 + 0.06 * (frame == 2) - 0.12 * (frame == 4)
    return pose


# --- fodder clips ---------------------------------------------------------
# Four frames at 6 fps, twice over. `idle` and `idle_b` are NOT the same beat
# resampled: one breathes on the vertical, the other shifts weight and scans
# on the horizontal. That distinction is the entire point — playback phase
# offset changes when a unit moves, and only a second baked clip changes what
# it does. At 8 facings a fodder idle costs 32 cells of ~500 px, which is what
# makes buying a second one reasonable.

FODDER_LIFT = (0.0, 0.07, 0.12, 0.05)
FODDER_SWAY = (0.0, 0.055, 0.02, -0.045)
FODDER_SCAN = (0.0, -0.34, -0.34, 0.16)


def fodder_idle(frame, count):
    """Vertical beat: settle, breathe in, hold, fall."""
    del count
    pose = empty_pose()
    lift = FODDER_LIFT[frame]
    pose["dip"] = -lift
    pose["rot"]["torso"] = (-0.18 * lift, 0.0, 0.0)
    pose["rot"]["head"] = (-0.14 * lift, 0.0, 0.0)
    pose["rot"]["shoulderL"] = (-0.30 * lift, 0, 0)
    pose["rot"]["shoulderR"] = (-0.30 * lift, 0, 0)
    return pose


def fodder_idle_b(frame, count):
    """Horizontal beat: shift weight onto one leg and scan the line."""
    del count
    pose = empty_pose()
    sway = FODDER_SWAY[frame]
    pose["sway"] = sway
    pose["rot"]["torso"] = (0.02, 1.6 * sway, -0.8 * sway)
    pose["rot"]["head"] = (0.0, FODDER_SCAN[frame], 0.0)
    pose["rot"]["hipL"] = (0.0, 0.0, -2.2 * sway)
    pose["rot"]["hipR"] = (0.0, 0.0, -2.2 * sway)
    pose["rot"]["shoulderR"] = (0.0, 0.0, -1.4 * sway)
    return pose


def brute_attack(frame, count):
    """6 frames at 10 fps: coil, swing, held contact, recover."""
    del count
    pose = empty_pose()
    if frame <= 1:
        coil = frame / 1.0
        pose["rot"]["torso"] = (-0.10 * coil, 0.42 * coil, 0)
        pose["rot"]["shoulderR"] = (0.55 * coil, 0, -0.45 * coil)
        pose["rot"]["shoulderL"] = (0, 0, 0.18 * coil)
        pose["lunge"] = -0.12 * coil
    elif frame <= 3:
        swing = (frame - 1) / 1.0
        pose["rot"]["torso"] = (0.12 * swing, 0.42 - 0.95 * swing, 0)
        pose["rot"]["shoulderR"] = (0.55 - 1.85 * swing, 0, -0.45 + 0.30 * swing)
        pose["rot"]["shoulderL"] = (0, 0, 0.18 - 0.34 * swing)
        pose["rot"]["hipL"] = (0.42 * swing, 0, 0)
        pose["lunge"] = -0.12 + 0.46 * swing
        # Contact squashes; the shield arm counter-rotates so the wide
        # silhouette narrows for exactly one frame and then opens again.
        pose["squash"] = 1.10 if frame == 2 else 0.90
        pose["flash"] = frame == 3
    else:
        back = 1.0 - (frame - 3) / 2.0
        pose["rot"]["torso"] = (0.12 * back, -0.5 * back, 0)
        pose["rot"]["shoulderR"] = (-1.30 * back, 0, -0.15 * back)
        pose["rot"]["hipL"] = (0.42 * back, 0, 0)
        pose["lunge"] = 0.34 * back
    return pose


def marksman_attack(frame, count):
    """6 frames at 10 fps: level the barrel, fire, absorb, re-level."""
    del count
    pose = empty_pose()
    if frame <= 1:
        raise_ = frame / 1.0
        pose["rot"]["torso"] = (-0.14 * raise_, -0.10 * raise_, 0)
        pose["rot"]["head"] = (-0.08 * raise_, 0, 0)
        pose["lunge"] = -0.03 * raise_
    elif frame <= 3:
        # One frame of muzzle flash and one of recoil. The 5% emission budget
        # exists for this and nothing else on a fodder unit.
        pose["rot"]["torso"] = (-0.14 + 0.24 * (frame - 2), -0.10, 0)
        pose["rot"]["head"] = (-0.08, 0, 0)
        pose["lunge"] = -0.03 - 0.10 * (frame - 2)
        pose["squash"] = 1.04 if frame == 2 else 0.97
        pose["spark"] = frame == 2
        pose["flash"] = frame == 3
    else:
        back = 1.0 - (frame - 3) / 2.0
        pose["rot"]["torso"] = (0.10 * back, -0.10 * back, 0)
        pose["lunge"] = -0.13 * back
    return pose


RIGS = {
    "brute": build_brute,
    "marksman": build_marksman,
    "medic": build_medic,
    "ranger": build_ranger,
}

CLIPS = {
    "brute": {"attack": brute_attack, "idle": fodder_idle, "idle_b": fodder_idle_b},
    "marksman": {"attack": marksman_attack, "idle": fodder_idle, "idle_b": fodder_idle_b},
    "medic": {"attack": attack_pose, "idle": idle_pose, "pivot": pivot_pose},
    "ranger": {"attack": attack_pose, "idle": idle_pose, "pivot": pivot_pose},
}


def apply_pose(rig, pose, facing):
    bind_table = rig["_bind"]
    for name in JOINTS:
        bind = bind_table.get(name, (0.0, 0.0, 0.0))
        delta = pose["rot"].get(name, (0.0, 0.0, 0.0))
        rx = bind[0] + delta[0]
        ry = bind[1] + delta[1]
        rz = bind[2] + delta[2]
        # THREE euler (rx, ry, rz) -> Blender (rx, -rz, ry).
        rig[name].rotation_euler = (rx, -rz, ry)

    root = rig["root"]
    root.rotation_euler = (0.0, 0.0, facing)
    root.location = (
        pose["lunge"] * math.sin(facing) + pose["sway"],
        -pose["lunge"] * math.cos(facing),
        -pose["dip"],
    )
    spread = 1.0 + (1.0 - pose["squash"]) * 0.7
    root.scale = (spread, spread, pose["squash"])

    # Emission budget (#68: ~5% max). The rival can afford a 2.9x tip pop at
    # 60 px; the same multiplier here is a solid teal slab across a fifth of
    # the figure's width, and it stops reading as a flash.
    tip_scale = 2.0 if pose["spark"] else (1.35 if pose["flash"] else 1.0)
    # The burst is the only thing in the rig allowed to be bright, and it exists
    # for exactly the two frames of contact. r1: "nothing spends any part of the
    # 5% emission budget on the one moment the budget exists for."
    burst = 1.0 if pose["spark"] else (0.62 if pose["flash"] else 0.001)
    if "burst" in rig:
        rig["burst"].scale = (burst, burst, burst)
        rig["tip"].scale = (tip_scale, tip_scale, tip_scale)
        rig["needle"].data.materials[0] = flat_material(SIGNAL_HOT if pose["flash"] else SIGNAL)
    # The fodder marksman's muzzle flash rides the same budget: one bright
    # frame, one dim frame, invisible otherwise.
    if "muzzle" in rig:
        flash = 1.0 if pose["spark"] else (0.5 if pose["flash"] else 0.001)
        rig["muzzle"].scale = (flash, flash, flash)


# --- camera + render ------------------------------------------------------

# Camera basis for the 2:1 dimetric ortho view (30 deg elevation, 45 deg
# azimuth), in Blender's Z-up world.
CAM_DIR = (0.61237, -0.61237, 0.5)
CAM_RIGHT = (0.70711, 0.70711, 0.0)
CAM_UP = (-0.35355, 0.35355, 0.86603)


def setup_camera(spec):
    cell = spec["cell"]
    ppu = spec["pixelsPerUnit"]
    anchor = spec["anchor"]
    dx = -(anchor["x"] - cell["width"] / 2.0) / ppu
    dy = -(cell["height"] / 2.0 - anchor["y"]) / ppu
    target = tuple(CAM_RIGHT[i] * dx + CAM_UP[i] * dy for i in range(3))

    data = bpy.data.cameras.new("bake_cam")
    data.type = "ORTHO"
    data.sensor_fit = "HORIZONTAL"
    data.ortho_scale = cell["width"] / ppu
    data.clip_start = 0.1
    data.clip_end = 200.0
    cam = bpy.data.objects.new("bake_cam", data)
    cam.location = tuple(target[i] + CAM_DIR[i] * 60.0 for i in range(3))
    cam.rotation_euler = (math.radians(60.0), 0.0, math.radians(45.0))
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    return cam


def setup_scene(spec):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 1
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.use_denoising = False
    scene.cycles.max_bounces = 0
    scene.render.film_transparent = True
    # Effectively a point sample per pixel: hard pixel edges, no AA fringe
    # for the quantizer to smear into off-palette colours.
    scene.render.filter_size = 0.01
    scene.render.resolution_x = spec["cell"]["width"] * spec["supersample"]
    scene.render.resolution_y = spec["cell"]["height"] * spec["supersample"]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 0
    # Authored hex in, identical hex out — the quantizer downstream must see
    # the colours we wrote, not a tone-mapped approximation of them.
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    return scene


def set_pass(mode):
    for obj, cel_mat, id_mat in _PARTS:
        obj.data.materials[0] = id_mat if mode == "id" else cel_mat


def authored_height_units(rig, mount, facings):
    """How tall this rig DRAWS at unit scale, in world units, over the facing ring.

    Projected onto the camera's up axis rather than measured in world Z, because
    those are not the same number: the camera is a 2:1 dimetric ortho, so a
    horizontal extent contributes 0.354 of itself to the sprite's height and a
    vertical one contributes 0.866. The marksman's barrel is horizontal and its
    aerial is vertical; taking world Z would have called it 45 art px tall when
    it draws 41, and every tier ratio downstream would inherit the error.

    Maxed over the eight facings for the same reason `standingArtPx` is: the cell
    has to hold the tallest one, and a ratio quoted from the shortest facing is a
    ratio quoted from the flattering facing.

    Round 5 shipped a real arithmetic bug that this exists to close. Every rig
    was scaled by `bodyArtPx / HERO_BODY_ART_PX`, where the constant is the
    MEDIC's authored height — so two rigs asked for "the same 22 px" drew at
    different heights, and the hero:ranged size ratio fell from a clean 1.27 to
    1.08 at the small register the moment round 5 lengthened the marksman. The
    fix is arithmetic, and it needs the one number Python is in a position to
    know: how tall the rig actually is. TypeScript reads this back and asserts it
    against its own table, so the table can never silently drift again.
    """
    tallest = 0.0
    for facing in range(facings):
        apply_pose(rig, empty_pose(), -facing * (TAU / facings))
        bpy.context.view_layer.update()
        low = None
        high = None
        for obj, _cel, _id in _PARTS:
            for corner in obj.bound_box:
                point = obj.matrix_world @ mathutils.Vector(corner)
                up = point.x * CAM_UP[0] + point.y * CAM_UP[1] + point.z * CAM_UP[2]
                low = up if low is None else min(low, up)
                high = up if high is None else max(high, up)
        if low is not None and high is not None:
            tallest = max(tallest, high - low)
    return tallest / max(1e-9, mount.scale.z)


def main():
    started = time.time()
    argv = sys.argv[sys.argv.index("--") + 1:]
    with open(argv[0], encoding="utf-8") as fh:
        spec = json.load(fh)

    unit = spec.get("unit", "medic")
    unit_scale = float(spec.get("unitScale", 1.0))

    scene = setup_scene(spec)
    # Rebind the readable-feature floor BEFORE the rig is built: the pruning
    # decision is geometry, not a render setting.
    set_unit_scale(unit_scale)
    rig = RIGS[unit]()
    # A mount above the root carries the tier's size boost, so `apply_pose`
    # keeps owning root scale (squash) and root location (lunge) unchanged and
    # both end up correctly scaled by being children of it.
    mount = empty("mount")
    rig["root"].parent = mount
    mount.scale = (unit_scale, unit_scale, unit_scale)
    setup_camera(spec)

    authored_height = authored_height_units(rig, mount, spec["facings"])

    out_dir = spec["workDir"]
    facings = spec["facings"]
    frames = []
    render_seconds = 0.0
    posers = CLIPS[unit]

    for clip in spec["clips"]:
        name = clip["name"]
        count = clip["frames"]
        poser = posers[name]
        for frame in range(count):
            pose = poser(frame, count)
            for facing in range(facings):
                yaw = -facing * (TAU / facings)
                apply_pose(rig, pose, yaw)
                bpy.context.view_layer.update()
                stem = f"{name}_{frame:02d}_{facing}"
                clock = time.time()
                set_pass("cel")
                scene.render.filepath = f"{out_dir}/{stem}.png"
                bpy.ops.render.render(write_still=True)
                set_pass("id")
                scene.render.filepath = f"{out_dir}/{stem}.id.png"
                bpy.ops.render.render(write_still=True)
                render_seconds += time.time() - clock
                frames.append({
                    "clip": name,
                    "frame": frame,
                    "facing": facing,
                    "color": f"{stem}.png",
                    "id": f"{stem}.id.png",
                })

    manifest = {
        "version": 2,
        "generator": f"blender {bpy.app.version_string}",
        "engine": f"{scene.render.engine}/{scene.cycles.device}",
        "unit": unit,
        "unitScale": unit_scale,
        "droppedDetails": _DROPPED[0],
        "authoredHeightUnits": round(authored_height, 4),
        "cell": spec["cell"],
        "supersample": spec["supersample"],
        "pixelsPerUnit": spec["pixelsPerUnit"],
        "anchor": spec["anchor"],
        "facings": facings,
        "partCount": len(_PARTS),
        "clips": [{"name": c["name"], "frames": c["frames"], "fps": c["fps"]} for c in spec["clips"]],
        "frames": frames,
        "timing": {
            "renderSeconds": round(render_seconds, 3),
            "totalSeconds": round(time.time() - started, 3),
            "renderCount": len(frames) * 2,
        },
    }
    with open(spec["manifestPath"], "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)


main()
