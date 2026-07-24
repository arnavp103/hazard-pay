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
BAND_GAIN = 2.55
BAND_COLORS = tuple(
    tuple(channel / BAND_GAIN for channel in band)
    for band in ((0.55, 0.46, 0.58), (1.45, 1.35, 1.28), (2.55, 2.34, 2.05))
)


# --- scene plumbing -------------------------------------------------------

_MATS = {}
_ID_MATS = []
_PARTS = []


def cel_material(hex_color: str):
    """Hard three-band cel emission. Cached per colour so parts share nodes."""
    existing = _MATS.get(hex_color)
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
    ramp.color_ramp.elements[0].position = BAND_STOPS[0]
    ramp.color_ramp.elements[0].color = (*BAND_COLORS[0], 1.0)
    for stop, band in zip(BAND_STOPS[1:], BAND_COLORS[1:]):
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
    emit.inputs["Strength"].default_value = BAND_GAIN
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
    box("thigh", (0.17, 0.36, 0.19), (0, -0.2, 0), cel_material(PANTS), hip)
    knee = empty(f"knee{side}", hip, (0.0, 0.0, -0.38))
    box("shin", (0.15, 0.3, 0.16), (0, -0.16, 0), cel_material(SHIN), knee)
    if side == -1:
        box("shin_tape", (0.175, 0.05, 0.185), (0, -0.12, 0.005), flat_material(TAPE), knee)
    box("boot", (0.24, 0.15, 0.42), (0, -0.385, 0.09), cel_material(BOOT), knee)
    box("toe", (0.245, 0.11, 0.13), (0, -0.41, 0.28), cel_material(METAL), knee)
    box("toe_hi", (0.245, 0.03, 0.04), (0, -0.368, 0.335), flat_material(METAL_HI), knee)
    # Chip-led wear: a notched, scuffed heel block (the r2 critique's lesson).
    box("boot_scuff", (0.09, 0.05, 0.1), (side * 0.07, -0.325, -0.11), flat_material(SCUFF), knee)
    return hip, knee


def build_arm(side, cyber, torso):
    shoulder = empty(f"shoulder{side}", torso, (side * 0.31, 0.0, 0.44))
    box("sleeve", (0.14, 0.3, 0.15), (0, -0.17, 0), cel_material(COAT), shoulder)
    elbow = empty(f"elbow{side}", shoulder, (0.0, 0.0, -0.34))
    if cyber:
        box("forearm", (0.14, 0.27, 0.15), (0, -0.15, 0), cel_material(METAL), elbow)
        box("forearm_spec", (0.035, 0.22, 0.035), (side * 0.06, -0.14, 0.075), flat_material(METAL_HI), elbow)
        box("forearm_dot", (0.04, 0.04, 0.025), (side * 0.02, -0.18, 0.09), flat_material(SIGNAL), elbow)
    else:
        box("forearm", (0.13, 0.26, 0.14), (0, -0.15, 0), cel_material(COAT_DARK), elbow)
        box("wrist_wrap", (0.155, 0.06, 0.165), (0, -0.03, 0.005), flat_material(TAPE), elbow)
    hand = empty(f"hand{side}", elbow, (0.0, 0.0, -0.33))
    if cyber:
        box("fist", (0.2, 0.16, 0.18), (0, -0.06, 0), cel_material(METAL), hand)
        box("knuckle", (0.055, 0.045, 0.17), (0, -0.012, 0.02), flat_material(METAL_HI), hand)
    else:
        box("fist", (0.19, 0.15, 0.17), (0, -0.06, 0), cel_material(SKIN), hand)
    return shoulder, elbow, hand


def cross_plate(width, at, parent, flip=False):
    depth = -0.02 if flip else 0.02
    box("cross_v", (width * 0.36, width * 1.1, 0.03), (at[0], at[1], at[2] + depth * 0.0), flat_material(PALE), parent)
    box("cross_h", (width, width * 0.36, 0.03), at, flat_material(PALE), parent)


def build_injector(hand):
    tool = empty("tool", hand, (0.0, -0.04, -0.08))
    cylinder("inj_body", 0.065, 0.4, (0, -0.02, 0.16), cel_material(METAL), tool)
    box("inj_gleam", (0.03, 0.03, 0.34), (0, 0.05, 0.16), flat_material(METAL_HI), tool)
    box("inj_tank", (0.1, 0.1, 0.14), (0, 0.07, 0.05), cel_material(LIVERY), tool)
    box("inj_grip", (0.06, 0.12, 0.07), (0, -0.1, 0.02), cel_material(BOOT), tool)
    tip = empty("tip", tool, (0.0, -0.4, -0.02))
    needle = cylinder("inj_needle", 0.042, 0.12, (0, 0, 0), flat_material(SIGNAL), tip)
    return tip, needle


def build_medic():
    root = empty("root")
    pelvis = empty("pelvis", root, (0.0, 0.0, 0.9))
    box("hem", (0.46, 0.26, 0.32), (0, 0.02, 0), cel_material(COAT_DARK), pelvis)
    box("holster", (0.12, 0.18, 0.1), (0.26, -0.04, 0.06), cel_material(HOLSTER), pelvis)

    torso = empty("torso", pelvis, (0.0, 0.0, 0.12))
    box("chest", (0.5, 0.44, 0.34), (0, 0.28, 0), cel_material(COAT), torso)
    box("pocket", (0.16, 0.13, 0.03), (-0.16, 0.16, 0.18), flat_material(COAT_DARK), torso)
    # Chest rig + cross plate + strap + steel buckle.
    box("chest_rig", (0.28, 0.26, 0.07), (0.06, 0.24, 0.19), cel_material(LIVERY), torso)
    cross_plate(0.13, (0.06, 0.24, 0.24), torso)
    box("strap", (0.56, 0.07, 0.03), (-0.02, 0.3, 0.185), flat_material(STRAP), torso, rot=(0, 0, 0.55))
    box("buckle", (0.09, 0.08, 0.035), (-0.14, 0.36, 0.2), flat_material(METAL), torso)
    box("buckle_hi", (0.09, 0.025, 0.025), (-0.14, 0.39, 0.215), flat_material(METAL_HI), torso)
    # Field pack.
    box("pack", (0.38, 0.44, 0.2), (0, 0.22, -0.27), cel_material(PACK), torso)
    box("pack_plate", (0.24, 0.28, 0.05), (-0.02, 0.22, -0.39), cel_material(LIVERY), torso)
    cross_plate(0.12, (-0.02, 0.26, -0.425), torso, flip=True)
    box("stencil_bar", (0.15, 0.03, 0.025), (-0.02, 0.09, -0.428), flat_material(STENCIL), torso)
    for sx in (-0.06, -0.02, 0.02):
        box("stencil_tick", (0.02, 0.05, 0.025), (sx, 0.045, -0.428), flat_material(STENCIL), torso)
    box("pack_scuff", (0.22, 0.06, 0.16), (0.05, 0.42, -0.27), flat_material(SCUFF), torso)
    box("pack_worn", (0.05, 0.3, 0.05), (-0.2, 0.22, -0.28), flat_material(LIVERY_DK), torso)
    box("pack_signal", (0.05, 0.05, 0.035), (0.13, 0.38, -0.375), flat_material(SIGNAL), torso)
    box("aerial", (0.035, 0.34, 0.035), (0.15, 0.56, -0.3), flat_material(AERIAL), torso)

    head = empty("head", torso, (0.0, 0.0, 0.46))
    box("neck", (0.14, 0.1, 0.13), (0, 0.02, 0), cel_material(SKIN), head)
    box("hood", (0.36, 0.34, 0.34), (0, 0.17, -0.02), cel_material(HOOD), head)
    box("face", (0.24, 0.18, 0.08), (0, 0.13, 0.15), cel_material(SKIN), head)
    box("brow", (0.27, 0.09, 0.1), (0, 0.205, 0.15), flat_material(BROW), head)
    box("visor", (0.2, 0.04, 0.025), (0, 0.16, 0.2), flat_material(SIGNAL), head)

    shoulder_l, elbow_l, hand_l = build_arm(-1, True, torso)
    shoulder_r, elbow_r, hand_r = build_arm(1, False, torso)
    box("pad", (0.24, 0.11, 0.26), (-0.04, 0.06, 0), cel_material(LIVERY), shoulder_l)
    box("pad_chip", (0.085, 0.05, 0.1), (-0.14, 0.09, 0.09), flat_material(LIVERY_DK), shoulder_l)

    tip, needle = build_injector(hand_r)

    hip_l, knee_l = build_leg(-1, root)
    hip_r, knee_r = build_leg(1, root)
    box("kneepad", (0.16, 0.12, 0.08), (0, -0.04, 0.1), cel_material(KNEEPAD), knee_r)

    return {
        "root": root, "pelvis": pelvis, "torso": torso, "head": head,
        "shoulderL": shoulder_l, "elbowL": elbow_l,
        "shoulderR": shoulder_r, "elbowR": elbow_r,
        "hipL": hip_l, "kneeL": knee_l, "hipR": hip_r, "kneeR": knee_r,
        "tip": tip, "needle": needle,
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


def idle_pose(frame, count):
    """8 frames at 8 fps: breath + weight shift + one held glance beat."""
    pose = empty_pose()
    phase = frame / count
    breath = math.sin(phase * TAU)
    sway = math.sin(phase * TAU - 0.9)
    pose["rot"]["torso"] = (0.055 * breath, 0.04 * sway, 0.06 * sway)
    pose["rot"]["shoulderL"] = (-0.07 * breath, 0, 0.05 * sway)
    pose["rot"]["shoulderR"] = (-0.07 * breath, 0, -0.05 * sway)
    pose["dip"] = 0.045 * (0.5 - 0.5 * breath)
    pose["sway"] = 0.05 * sway
    # Held glance: two frames out of eight look off-axis, then snap back.
    glance = 0.34 if frame in (3, 4) else (0.12 if frame == 5 else 0.0)
    pose["rot"]["head"] = (0.03 * breath, glance, 0.04 * sway)
    # One injector check per loop, on the two frames after the glance.
    if frame in (6, 7):
        pose["rot"]["elbowR"] = (-0.22 if frame == 6 else -0.1, 0, 0)
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
        pose["rot"]["torso"] = (0.26 * strike, 0.45 - 0.85 * strike, 0)
        pose["rot"]["shoulderR"] = (0.68 - 2.0 * strike, 0, 0)
        pose["rot"]["elbowR"] = (-0.68 + 0.52 * strike, 0, 0)
        pose["rot"]["head"] = (0.12 * strike, -0.22 + 0.3 * strike, 0)
        pose["rot"]["hipL"] = (0.58 * strike, 0, 0)
        pose["rot"]["kneeL"] = (-0.38 * strike, 0, 0)
        pose["rot"]["hipR"] = (-0.52 * strike, 0, 0)
        pose["rot"]["shoulderL"] = (0.36 * strike, 0, 0.16 * strike)
        pose["lunge"] = -0.1 + 0.4 * strike
        # f4 stretches into contact, f5 squashes hard, f6-f8 HOLD the hit.
        pose["squash"] = {4: 1.10, 5: 0.80}.get(frame, 0.84)
        pose["flash"] = frame >= 5
        pose["spark"] = frame == 5
    else:
        back = 1.0 - (frame - 8) / 3.0
        pose["rot"]["torso"] = (0.26 * back, -0.4 * back, 0)
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

    tip_scale = 2.9 if pose["spark"] else (1.9 if pose["flash"] else 1.0)
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
