# Procedural, tileable ground textures for assets/textures/terrain (made for this project, CC0).
# Usage: python3 scripts/terrain-textures.py assets/textures/terrain   (needs numpy and Pillow)
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter
N = 512
out = sys.argv[1]
rng = np.random.default_rng(7)
fy = np.fft.fftfreq(N)[:, None]; fx = np.fft.fftfreq(N)[None, :]
F = np.sqrt(fx * fx + fy * fy); F[0, 0] = 1
def noise(beta, lo=0, hi=1e9, seed=None):
    r = np.random.default_rng(seed) if seed is not None else rng
    w = np.fft.fft2(r.standard_normal((N, N)))
    f = F * N
    filt = 1 / F ** beta
    filt[(f < lo) | (f > hi)] = 0
    n = np.real(np.fft.ifft2(w * filt))
    n = (n - n.mean()) / (n.std() + 1e-9)
    return n
def save(name, rgb):
    Image.fromarray(np.clip(rgb * 255, 0, 255).astype(np.uint8)).save(f'{out}/{name}.jpg', quality=88)
    print(name, rgb.reshape(-1, 3).mean(0).round(3))
def col(c): return np.array(c, dtype=float)[None, None, :] / 255

# Rock: layered fbm with ridged cracks and mineral speckle
base = noise(1.6) * 0.6 + noise(1.0, 20) * 0.25
ridge = 1 - np.abs(noise(1.3, 4, 120))
cracks = np.clip((ridge - 0.85) * 6, 0, 1)
yy0 = np.arange(N)[:, None] / N
strata = np.sin(2 * np.pi * (yy0 * 6 + noise(2.0, 0, 8) * 0.35)) * 0.06
v = 0.5 + base * 0.11 + strata - cracks * 0.28 + noise(0.2, 120) * 0.06 + noise(0.8, 40, 160) * 0.05
tint = noise(1.8, 0, 30)
rgb = col([118, 113, 104]) * (v[..., None] / 0.5) + tint[..., None] * col([6, 4, 0]) 
save('rock', np.clip(rgb, 0, 1))

# Dirt: clods, darker gaps, small light pebbles
v = 0.5 + noise(1.4) * 0.09 + noise(0.6, 40) * 0.07
clod = np.clip(noise(1.2, 15, 90) * 0.5, -1, 1)
v += clod * 0.06
rgb = col([120, 94, 68]) * (v[..., None] / 0.5)
img = Image.fromarray(np.clip(rgb * 255, 0, 255).astype(np.uint8))
d = ImageDraw.Draw(img)
r2 = np.random.default_rng(3)
for i in range(900):
    x, y, s = r2.uniform(0, N), r2.uniform(0, N), r2.uniform(0.8, 3.2)
    g = int(r2.uniform(120, 175)); c = (g + 8, g, g - 12)
    for ox in (-N, 0, N):
        for oy in (-N, 0, N):
            d.ellipse([x + ox - s, y + oy - s * 0.8, x + ox + s, y + oy + s * 0.8], fill=c)
save('dirt', np.asarray(img.filter(ImageFilter.GaussianBlur(0.6))) / 255)

# Grass: dense short blades in many greens over a dark, earthy base
base = np.clip(0.5 + noise(1.5) * 0.12, 0, 1)
img = Image.fromarray(np.clip(col([52, 66, 30]) * (base[..., None] / 0.5) * 255, 0, 255).astype(np.uint8))
d = ImageDraw.Draw(img)
r3 = np.random.default_rng(11)
greens = [(78, 104, 40), (96, 122, 48), (64, 90, 34), (110, 128, 56), (128, 132, 66), (58, 80, 30), (88, 112, 44)]
for i in range(26000):
    x, y = r3.uniform(0, N), r3.uniform(0, N)
    a = r3.normal(-np.pi / 2, 0.6); L = r3.uniform(4, 11)
    c = greens[r3.integers(len(greens))]
    k = r3.uniform(0.75, 1.2); c = tuple(int(min(255, v * k)) for v in c)
    x2, y2 = x + np.cos(a) * L, y + np.sin(a) * L
    for ox in (-N, 0, N):
        for oy in (-N, 0, N):
            if -12 < x + ox < N + 12 and -12 < y + oy < N + 12:
                d.line([x + ox, y + oy, x2 + ox, y2 + oy], fill=c, width=1)
arr = np.asarray(img.filter(ImageFilter.GaussianBlur(0.35))) / 255
arr = arr * (1 + noise(1.7)[..., None] * 0.08)
save('grass', np.clip(arr, 0, 1))

# Sand: fine grains with soft ripples
grain = noise(0.0, 80) * 0.05 + noise(0.5, 30) * 0.03
yy = np.arange(N)[:, None] / N; xx = np.arange(N)[None, :] / N
ripple = np.sin(2 * np.pi * (yy * 9 + noise(2.2, 0, 12) * 0.25 + xx * 1)) * 0.025
v = 0.5 + grain + ripple + noise(1.6) * 0.05
rgb = col([200, 180, 140]) * (v[..., None] / 0.5)
sp = np.random.default_rng(5).random((N, N)) > 0.985
rgb[sp] *= 0.7
save('sand', np.clip(rgb, 0, 1))

# Snow: soft drifts, faint blue shadows in the hollows, a few glints
v = 0.5 + noise(1.8) * 0.022 + noise(0.8, 30) * 0.012
rgb = col([234, 238, 244]) * (v[..., None] / 0.5)
rgb += np.clip(-noise(1.8, 0, 20) - 0.6, 0, 1)[..., None] * col([-8, -5, 0])
gl = np.random.default_rng(9).random((N, N)) > 0.996
rgb[gl] = 1
save('snow', np.clip(rgb, 0, 1))
