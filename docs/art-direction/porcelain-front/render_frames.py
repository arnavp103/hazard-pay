"""Render an inclusive frame range from the saved scene with Blender 4.5.

blender -b porcelain-front.blend -t 4 --python render_frames.py -- \
  --output /absolute/frames --start 1 --end 863
"""
import argparse
import os
import sys

import bpy

parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
parser.add_argument('--start', type=int, default=1)
parser.add_argument('--end', type=int, default=863)
parser.add_argument('--samples', type=int, default=16)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
os.makedirs(args.output, exist_ok=True)
scene = bpy.context.scene
scene.eevee.taa_render_samples = args.samples
scene.render.threads_mode = 'FIXED'
scene.render.threads = 4
scene.render.image_settings.file_format = 'PNG'
scene.render.resolution_percentage = 100
scene.frame_start = args.start
scene.frame_end = args.end
scene.frame_step = 2
scene.render.filepath = os.path.join(args.output, 'frame_')
bpy.ops.render.render(animation=True)
