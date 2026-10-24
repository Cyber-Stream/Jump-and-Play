"""Build browser-compatible H.264 media and lightweight posters from the originals."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess, sys, json
root = Path(__file__).resolve().parents[1]
ffmpeg = root / '.video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'
output = root / 'assets/media'
output.mkdir(exist_ok=True)
jobs = [
    ('hero-mobile-v2', root/'jumpplay-hero.mp4', 480, 854, True),
    ('hero-desktop-v2', root/'jumpplay-hero.mp4', 1280, 832, True),
    ('zawad', output/'3ded6d5bc12275f1.mp4', 540, 960, False),
    ('maruf', output/'d2425f77cb35b198.mp4', 540, 960, False),
    ('in-action', root/'jumpplay-action-highlight.mp4', 540, 960, False)
]
def run(job):
    name, source, width, height, silent = job
    target = output/(name+'.mp4')
    command = [str(ffmpeg), '-hide_banner', '-loglevel', 'error', '-y']
    # The source is portrait. Keep its detail and loop the action, without black title frames.
    if silent:
        command += ['-ss', '2.8']
    command += ['-i', str(source)]
    if silent:
        command += ['-t', '10.5']
    command += [
      '-map', '0:v:0', '-vf', f"scale=w='min({width},iw)':h='min({height},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30",
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '26' if silent else '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
    command += ['-an', '-profile:v', 'baseline', '-level:v', '3.1', '-tag:v', 'avc1', '-g', '60', '-maxrate', '1200k', '-bufsize', '2400k'] if silent else ['-map', '0:a?', '-c:a', 'aac', '-b:a', '96k', '-ac', '2']
    subprocess.run(command+[str(target)], check=True)
    poster = output/('hero-poster-v2.webp' if silent else name+'-poster.webp')
    if name != 'hero-desktop-v2':
        subprocess.run([str(ffmpeg), '-hide_banner', '-loglevel', 'error', '-y', '-ss', '6' if silent else '0.3', '-i', str(target), '-frames:v', '1', '-c:v', 'libwebp', '-q:v', '78', str(poster)], check=True)
    print(json.dumps({'media': name, 'videoBytes': target.stat().st_size, 'posterBytes': poster.stat().st_size if poster.exists() else None}), flush=True)
with ThreadPoolExecutor(max_workers=2) as executor:
    list(executor.map(run, [job for job in jobs if job[4]] if '--hero-only' in sys.argv else jobs))
