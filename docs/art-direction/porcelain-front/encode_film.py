"""Encode the complete scene and five compact browser chapters with FFmpeg."""
import pathlib
import subprocess
import sys

frames = pathlib.Path(sys.argv[1]).resolve()
output = pathlib.Path(sys.argv[2]).resolve()
output.mkdir(parents=True, exist_ok=True)
expected = [frames / f'frame_{frame:04}.png' for frame in range(1, 864, 2)]
missing = [str(path) for path in expected if not path.is_file()]
if missing:
    raise SystemExit(f'Missing {len(missing)} required frames, first: {missing[0]}')
source = ['-framerate', '12', '-pattern_type', 'glob', '-i', str(frames / 'frame_*.png')]
base = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y']
subprocess.run(base + source + ['-frames:v', '864', '-vf', 'fps=24', '-c:v', 'libx264', '-threads', '2', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(output / 'porcelain-front-full.mp4')], check=True)
chapters = [(0, 8), (8, 9), (17, 7), (24, 6), (30, 6)]
for index, (start, duration) in enumerate(chapters, 1):
    options = source + ['-ss', str(start), '-t', str(duration), '-vf', 'scale=576:324,format=yuv420p', '-c:v', 'libvpx-vp9', '-b:v', '72k', '-row-mt', '1', '-threads', '2', '-passlogfile', str(output / f'chapter-{index}')]
    subprocess.run(base + options + ['-pass', '1', '-f', 'null', '/dev/null'], check=True)
    subprocess.run(base + options + ['-pass', '2', str(output / f'chapter-{index}.webm')], check=True)
print('Encoded all 36 seconds: 432 distinct source frames, 864 master frames, five complete chapters.')
