"""Blender-side of the #82 bake-off lane: low-poly field medic -> pixel sprites.

Runs inside Blender's embedded interpreter (`blender -b -P medic_bake.py --
<spec.json>`). Everything outside this file is TypeScript; this script owns
only what `bpy` can own — scene, rig, poses, camera, render — and hands the
result back as a manifest JSON file (never stdout: Blender is chatty).

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

# --- minimum feature size -------------------------------------------------
# A finding, not a fudge. The rival rig was authored for a REAL-TIME 60-px
# view, where a 0.03-unit stencil tick is half a pixel of harmless texture
# that temporal motion smooths over. Baked at 16 art px per world unit with a
# point sampling filter, that same tick becomes a single hard pixel that flicks
# on and off between facings — noise, not detail. So every decorative feature
# is floored at ~1.2 art px, and the features that cannot be grown without
# lying about the kit (the unit stencil) are dropped outright.
ART_PX = 1.0 / 16.0
MIN_FEATURE = ART_PX * 1.2


def feat(*dims):
    """Floor each dimension at the minimum readable feature size."""
    return tuple(max(d, MIN_FEATURE) for d in dims)

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


def cel_material(hex_color: str, bands=None):
    """Hard three-band cel emission. Cached per colour so parts share nodes."""
    existing = _MATS.get(hex_color)
    if existing is not None:
        return existing
    multipliers = bands or BAND_MULTIPLIERS

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

    _MATS[hex_color] = mat
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
        box("shin_tape", feat(0.175, 0.06, 0.185), (0, -0.12, 0.005), flat_material(TAPE), knee)
    box("boot", (0.24, 0.15, 0.42), (0, -0.385, 0.09), cel_material(BOOT, CLOTH_BANDS), knee)
    box("toe", (0.245, 0.11, 0.13), (0, -0.41, 0.28), cel_material(METAL, METAL_BANDS), knee)
    # Chip-led wear: a notched, scuffed heel block (the r2 critique's lesson).
    box("boot_scuff", feat(0.09, 0.05, 0.1), (side * 0.07, -0.325, -0.115), flat_material(SCUFF), knee)
    return hip, knee


def build_arm(side, cyber, torso):
    shoulder = empty(f"shoulder{side}", torso, (side * 0.31, 0.0, 0.44))
    box("sleeve", (0.14, 0.3, 0.15), (0, -0.17, 0), cel_material(COAT, CLOTH_BANDS), shoulder)
    elbow = empty(f"elbow{side}", shoulder, (0.0, 0.0, -0.34))
    if cyber:
        box("forearm", (0.14, 0.27, 0.15), (0, -0.15, 0), cel_material(METAL, METAL_BANDS), elbow)
    else:
        box("forearm", (0.13, 0.26, 0.14), (0, -0.15, 0), cel_material(COAT_DARK, CLOTH_BANDS), elbow)
        box("wrist_wrap", feat(0.155, 0.07, 0.165), (0, -0.03, 0.005), flat_material(TAPE), elbow)
    hand = empty(f"hand{side}", elbow, (0.0, 0.0, -0.33))
    if cyber:
        box("fist", (0.2, 0.16, 0.18), (0, -0.06, 0), cel_material(METAL, METAL_BANDS), hand)
    else:
        box("fist", (0.19, 0.15, 0.17), (0, -0.06, 0), cel_material(SKIN), hand)
    return shoulder, elbow, hand


def cross_plate(width, at, parent, flip=False):
    """The pale cross: the mark that must survive grayscale and 31 px."""
    del flip
    box("cross_v", feat(width * 0.4, width * 1.15, 0.03), at, flat_material(PALE), parent)
    box("cross_h", feat(width, width * 0.4, 0.03), at, flat_material(PALE), parent)


def build_injector(hand):
    tool = empty("tool", hand, (0.0, -0.04, -0.08))
    cylinder("inj_body", 0.065, 0.4, (0, -0.02, 0.16), cel_material(METAL, METAL_BANDS), tool)
    box("inj_gleam", feat(0.03, 0.03, 0.34), (0, 0.055, 0.16), flat_material(METAL_HI), tool)
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
    box("kit_lid", feat(0.26, 0.06, 0.20), (-0.31, 0.15, 0.05), cel_material(LIVERY_DK), pelvis)
    cross_plate(0.14, (-0.31, 0.02, 0.16), pelvis)
    cross_plate(0.14, (-0.31, 0.02, -0.06), pelvis)
    box("kit_sling", feat(0.07, 0.5, 0.07), (-0.22, 0.32, 0.11), flat_material(STRAP), pelvis, rot=(0, 0, -0.5))

    torso = empty("torso", pelvis, (0.0, 0.0, 0.12))
    box("chest", (0.5, 0.44, 0.34), (0, 0.28, 0), cel_material(COAT, CLOTH_BANDS), torso)
    box("pocket", feat(0.16, 0.13, 0.03), (-0.16, 0.15, 0.185), flat_material(COAT_DARK), torso)
    # Chest rig + cross plate + strap + steel buckle.
    box("chest_rig", (0.33, 0.30, 0.08), (0.05, 0.235, 0.19), cel_material(LIVERY), torso)
    cross_plate(0.17, (0.05, 0.235, 0.245), torso)
    box("strap", feat(0.56, 0.085, 0.03), (-0.02, 0.3, 0.19), flat_material(STRAP), torso, rot=(0, 0, 0.55))
    box("buckle", (0.09, 0.08, 0.035), (-0.14, 0.36, 0.2), flat_material(METAL), torso)
    # Field pack.
    box("pack", (0.40, 0.46, 0.30), (0, 0.22, -0.32), cel_material(PACK, CLOTH_BANDS), torso)
    box("pack_plate", (0.26, 0.30, 0.05), (-0.02, 0.22, -0.47), cel_material(LIVERY), torso)
    cross_plate(0.15, (-0.02, 0.25, -0.505), torso, flip=True)
    # The rival's three-tick unit stencil is 0.3 art px per tick — dropped, and
    # its history re-spent as one readable painted bar.
    box("stencil_bar", feat(0.17, 0.05, 0.025), (-0.02, 0.055, -0.51), flat_material(STENCIL), torso)
    box("pack_scuff", feat(0.22, 0.07, 0.16), (0.05, 0.44, -0.32), flat_material(SCUFF), torso)
    box("pack_worn", feat(0.085, 0.32, 0.085), (-0.21, 0.22, -0.33), flat_material(LIVERY_DK), torso)

    head = empty("head", torso, (0.0, 0.0, 0.46))
    box("neck", (0.14, 0.1, 0.13), (0, 0.02, 0), cel_material(SKIN), head)
    box("hood", (0.36, 0.34, 0.34), (0, 0.17, -0.02), cel_material(HOOD, CLOTH_BANDS), head)
    box("face", (0.24, 0.18, 0.08), (0, 0.13, 0.15), cel_material(SKIN), head)
    box("brow", (0.27, 0.09, 0.1), (0, 0.205, 0.15), flat_material(BROW), head)
    box("visor", feat(0.2, 0.055, 0.025), (0, 0.155, 0.205), flat_material(SIGNAL), head)

    shoulder_l, elbow_l, hand_l = build_arm(-1, True, torso)
    shoulder_r, elbow_r, hand_r = build_arm(1, False, torso)
    box("pad", (0.24, 0.11, 0.26), (-0.04, 0.06, 0), cel_material(LIVERY), shoulder_l)
    box("pad_chip", feat(0.085, 0.06, 0.1), (-0.14, 0.09, 0.095), flat_material(LIVERY_DK), shoulder_l)

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


CLIPS = {"idle": idle_pose, "attack": attack_pose, "pivot": pivot_pose}


def apply_pose(rig, pose, facing):
    for name in JOINTS:
        bind = BIND.get(name, (0.0, 0.0, 0.0))
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
    rig["burst"].scale = (burst, burst, burst)
    rig["tip"].scale = (tip_scale, tip_scale, tip_scale)
    rig["needle"].data.materials[0] = flat_material(SIGNAL_HOT if pose["flash"] else SIGNAL)


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


def main():
    started = time.time()
    argv = sys.argv[sys.argv.index("--") + 1:]
    with open(argv[0], encoding="utf-8") as fh:
        spec = json.load(fh)

    scene = setup_scene(spec)
    rig = build_medic()
    setup_camera(spec)

    out_dir = spec["workDir"]
    facings = spec["facings"]
    frames = []
    render_seconds = 0.0

    for clip in spec["clips"]:
        name = clip["name"]
        count = clip["frames"]
        poser = CLIPS[name]
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
        "version": 1,
        "generator": f"blender {bpy.app.version_string}",
        "engine": f"{scene.render.engine}/{scene.cycles.device}",
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
