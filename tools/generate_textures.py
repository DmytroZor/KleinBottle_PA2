"""Create three independent, tileable PNG maps for ControlTask.

Requires Pillow and numpy only for regeneration. The already generated PNGs are
committed, so neither Python nor dependencies are required to run the webpage.
The normal map uses OpenGL +Y (green = positive tangent-space Y) convention.
"""
from pathlib import Path
import numpy as np
from PIL import Image

SIZE = 512
OUT = Path(__file__).resolve().parent.parent / 'textures'
OUT.mkdir(exist_ok=True)

# PNG image Y is top-down; WebGL flips the image during upload, so v grows upward.
u = (np.arange(SIZE, dtype=np.float64)[None, :] + 0.5) / SIZE
v = 1.0 - (np.arange(SIZE, dtype=np.float64)[:, None] + 0.5) / SIZE
TAU = 2.0 * np.pi

# Seam-safe, tileable blue enamel with fine gold inlay and a woven relief.
# All terms are periodic in both coordinates, and symmetric in v at the U seam.
a = TAU * 8 * u
b = TAU * 8 * v
c = TAU * 16 * u
d = TAU * 16 * v
p = np.cos(a) * np.cos(b)
relief = 0.32 * p + 0.14 * np.cos(c) + 0.14 * np.cos(d) + 0.08 * np.cos(TAU * 4 * u) * np.cos(TAU * 4 * v)

# Exact derivatives of relief along texture coordinates (u,v) for normal mapping.
du = (-0.32 * TAU * 8 * np.sin(a) * np.cos(b)
      -0.14 * TAU * 16 * np.sin(c)
      -0.08 * TAU * 4 * np.sin(TAU * 4 * u) * np.cos(TAU * 4 * v))
dv = (-0.32 * TAU * 8 * np.cos(a) * np.sin(b)
      -0.14 * TAU * 16 * np.sin(d)
      -0.08 * TAU * 4 * np.cos(TAU * 4 * u) * np.sin(TAU * 4 * v))

# The same height-field generates all 3 textures; normals are genuinely textured,
# not generated randomly or sampled from the surface's original vertex normals.
grad_strength = 0.057
nx = -grad_strength * du
ny = -grad_strength * dv
nz = np.ones((SIZE, SIZE), dtype=np.float64)
length = np.sqrt(nx*nx + ny*ny + nz*nz)
normal = np.stack([nx / length, ny / length, nz / length], axis=-1)
normal = np.uint8(np.clip(np.round((normal * 0.5 + 0.5) * 255), 0, 255))

# Metallic highlights are a separate specular response, not simply diffuse RGB.
# The inlaid seam brightens at regular crosspoints; broad enamel patches differ.
line_u = np.exp(-((np.cos(a) / 0.12) ** 2))
line_v = np.exp(-((np.cos(b) / 0.12) ** 2))
inlay = np.maximum(line_u, line_v)
soft = 0.5 + 0.5 * np.cos(TAU * 4 * u) * np.cos(TAU * 4 * v)
grains = 0.5 + 0.5 * p

# RGB [H,W,3], broadcasted from the pattern arrays.
base = np.array([14.0, 86.0, 114.0])[None, None, :]
shine = (17.0 + 32.0 * soft + 17.0 * grains)[..., None]
diffuse = base + shine * np.array([0.45, 0.84, 1.09])[None, None, :]
gold = np.array([219.0, 164.0, 89.0])[None, None, :]
diffuse = diffuse * (1.0 - 0.68 * inlay[..., None]) + gold * (0.68 * inlay[..., None])
diffuse = np.uint8(np.clip(np.round(diffuse), 0, 255))

spec_level = 0.17 + 0.43 * soft + 0.28 * inlay
specular = spec_level[..., None] * np.array([125.0, 198.0, 235.0])[None, None, :]
specular += inlay[..., None] * np.array([97.0, 60.0, 26.0])[None, None, :]
specular = np.uint8(np.clip(np.round(specular), 0, 255))

for name, array in [('diffuse.png', diffuse), ('specular.png', specular), ('normal.png', normal)]:
    Image.fromarray(array, mode='RGB').save(OUT / name, optimize=True)
    print(f'{name}: {array.shape[1]}x{array.shape[0]}')
