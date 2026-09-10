/**
 * Procedural canvas textures.
 *
 * Wood grain, marble veins, stone speckle, neon grid, coordinate decals — all
 * generated at runtime into small canvases. Keeps the bundle free of binary
 * assets and lets a texture be re-generated when a style parameter changes.
 */
import * as THREE from 'three';

const cache = new Map<string, THREE.Texture>();

function makeCanvas(size: number) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function hash(x: number, y: number, seed = 1) {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise(x: number, y: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbm(x: number, y: number, octaves = 4, seed = 1) {
  let amp = 0.5;
  let sum = 0;
  let norm = 0;
  let fx = x;
  let fy = y;
  for (let i = 0; i < octaves; i++) {
    sum += amp * smoothNoise(fx, fy, seed + i * 13);
    norm += amp;
    fx *= 2.03;
    fy *= 2.01;
    amp *= 0.5;
  }
  return sum / norm;
}

function toTexture(canvas: HTMLCanvasElement, repeat = 1, srgb = true) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function shade(hex: string, amount: number) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return `#${c.getHexString()}`;
}

export function woodTexture(key: string, base: string, dark: string, jitter: number) {
  const id = `wood:${key}:${base}:${dark}:${jitter}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const baseCol = new THREE.Color(base);
  const darkCol = new THREE.Color(dark);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // long, lazy grain: fine high-contrast stripes moire away at board scale
      const n = fbm(x / 40, y / 230, 3, 7);
      const grain = 0.5 + 0.5 * Math.sin(y / 11.5 + n * 6.5 + Math.sin(x / 64) * 2.1);
      const t = Math.min(1, Math.max(0, grain * 0.4 + n * 0.4 + (hash(x, y, 3) - 0.5) * jitter));
      const col = baseCol.clone().lerp(darkCol, t * 0.5);
      const i = (y * size + x) * 4;
      img.data[i] = col.r * 255;
      img.data[i + 1] = col.g * 255;
      img.data[i + 2] = col.b * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = toTexture(c, 1);
  cache.set(id, tex);
  return tex;
}

export function marbleTexture(key: string, base: string, vein: string, contrast = 1) {
  const id = `marble:${key}:${base}:${vein}:${contrast}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const baseCol = new THREE.Color(base);
  const veinCol = new THREE.Color(vein);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const turb = fbm(x / 42, y / 42, 5, 21) * 6;
      const v = Math.abs(Math.sin((x / size) * 6.2 + (y / size) * 3.1 + turb));
      const t = Math.min(1, Math.max(0, Math.pow(1 - v, 12 * contrast) + (hash(x, y, 9) - 0.5) * 0.05));
      const col = baseCol.clone().lerp(veinCol, t);
      const i = (y * size + x) * 4;
      img.data[i] = col.r * 255;
      img.data[i + 1] = col.g * 255;
      img.data[i + 2] = col.b * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = toTexture(c, 1);
  cache.set(id, tex);
  return tex;
}

export function stoneTexture(key: string, base: string, grit: number) {
  const id = `stone:${key}:${base}:${grit}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const size = 128;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 1.7 + 0.2;
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${(Math.random() * 0.09 + 0.02) * grit})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = toTexture(c, 3);
  cache.set(id, tex);
  return tex;
}

/** Emissive overlay: glowing grid traces for the neon board. */
export function gridGlowTexture(cell: string, line: string, strength = 1) {
  const id = `grid:${cell}:${line}:${strength}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const size = 128;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = line;
  ctx.globalAlpha = 0.85 * strength;
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, size - 8, size - 8);
  ctx.globalAlpha = 0.35 * strength;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.stroke();
  ctx.globalAlpha = 0.5 * strength;
  for (let i = 0; i < 4; i++) {
    const x = i % 2 === 0 ? 8 : size - 8;
    const y = i < 2 ? 8 : size - 8;
    ctx.fillStyle = line;
    ctx.beginPath();
    ctx.arc(x, y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = toTexture(c, 1);
  cache.set(id, tex);
  return tex;
}

/** Roughness variation map so nothing looks like plastic. */
export function roughnessNoise(key: string, strength = 0.35, scale = 40) {
  const id = `rough:${key}:${strength}:${scale}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const size = 128;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / scale, y / scale, 4, 55);
      const v = Math.round((1 - strength / 2 + (n - 0.5) * strength) * 255);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = toTexture(c, 2, false);
  cache.set(id, tex);
  return tex;
}

/** Crisp alpha decal for a single board coordinate or glyph. */
export function labelTexture(text: string, color = '#ffffff', bold = true) {
  const id = `label:${text}:${color}:${bold}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const size = 64;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = color;
  ctx.font = `${bold ? '700' : '500'} ${size * 0.62}px "Iowan Old Style", "Palatino Linotype", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, size / 2 + size * 0.02);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(id, tex);
  return tex;
}

/** Soft radial blob used for selection halos / torch glows. */
export function radialTexture(key = 'radial', color = '#ffffff', inner = 0.12, falloff = 2.2) {
  const id = `radial:${key}:${color}:${inner}:${falloff}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const size = 128;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.02, size / 2, size / 2, size / 2);
  const col = new THREE.Color(color);
  const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
  g.addColorStop(0, `rgba(${rgb},1)`);
  g.addColorStop(inner, `rgba(${rgb},${0.75})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(id, tex);
  return tex;
}

/** Ring decal for legal-move dots and capture markers. */
export function ringTexture(color = '#ffffff', width = 0.08) {
  const id = `ring:${color}:${width}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const size = 128;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d')!;
  const col = new THREE.Color(color);
  const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = `rgba(${rgb},1)`;
  ctx.lineWidth = size * width;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * (0.5 - width / 2) - 2, 0, Math.PI * 2);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(id, tex);
  return tex;
}

/** Sky dome gradient (vertical) with a sun bloom. */
export function skyTexture(top: string, horizon: string, bottom: string, sunPos = 0.72) {
  const id = `sky:${top}:${horizon}:${bottom}:${sunPos}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const w = 512;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(Math.min(0.86, Math.max(0.2, sunPos)), horizon);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // band of soft clouds / haze for depth
  for (let i = 0; i < 90; i++) {
    const y = Math.random() * h * 0.8;
    const x = Math.random() * w;
    const r = 40 + Math.random() * 150;
    const a = (1 - y / h) * 0.05;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  cache.set(id, tex);
  return tex;
}

/** Rows of book spines for the library shelves. */
export function bookTexture(seed = 1) {
  const id = `books:${seed}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const w = 256;
  const h = 256;
  const c = makeCanvas(w);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1b120c';
  ctx.fillRect(0, 0, w, h);
  const palette = ['#7c2f2a', '#2f4a6e', '#5a6b32', '#8a6a2f', '#3b2a4d', '#6e4a2a', '#254a44', '#7a5c8c'];
  for (let shelf = 0; shelf < 4; shelf++) {
    const y0 = shelf * 64 + 8;
    let x = 4;
    while (x < w - 8) {
      const bw = 8 + Math.floor(hash(x, shelf, seed) * 16);
      const bh = 40 + Math.floor(hash(x, shelf + 3, seed) * 14);
      const col = palette[Math.floor(hash(x, shelf * 7, seed) * palette.length) % palette.length];
      ctx.fillStyle = col;
      ctx.fillRect(x, y0 + (56 - bh), bw - 2, bh);
      ctx.fillStyle = 'rgba(255,230,180,0.35)';
      ctx.fillRect(x + 1, y0 + (56 - bh) + 6, bw - 4, 2);
      ctx.fillRect(x + 1, y0 + (56 - bh) + bh - 10, bw - 4, 1.5);
      x += bw;
    }
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(0, shelf * 64 + 62, w, 5);
  }
  const tex = toTexture(c, 2);
  cache.set(id, tex);
  return tex;
}

/** Heraldic banner for the great hall. */
export function bannerTexture(base = '#6c1f22', emblem = '#d9b463', seed = 3) {
  const id = `banner:${base}:${emblem}:${seed}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const w = 128;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let i = 0; i < w; i += 8) ctx.fillRect(i, 0, 3, h);
  ctx.fillStyle = emblem;
  ctx.beginPath();
  const cx = w / 2;
  const cy = h * 0.42;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? 34 : 15;
    ctx[i === 0 ? 'moveTo' : 'lineTo'](cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - 5, h * 0.62, 10, 46);
  ctx.fillRect(cx - 22, h * 0.66, 44, 9);
  // swallow-tail bottom
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(w / 2, h - 34 - (seed % 3) * 6);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(id, tex);
  return tex;
}

/** Emissive magma seams: black rock with glowing cracks. */
export function lavaTexture(key = 'lava', hot = '#ff5a1f', scale = 1) {
  const id = `lava:${key}:${hot}:${scale}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const col = new THREE.Color(hot);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm((x / size) * 5 * scale, (y / size) * 5 * scale, 5, 91);
      const crack = Math.abs(Math.sin((x / size) * 9 + n * 11) * Math.cos((y / size) * 7 - n * 9));
      const t = Math.pow(Math.max(0, 1 - crack * 3.6), 2.2);
      const rock = 0.03 + n * 0.05;
      const i = (y * size + x) * 4;
      img.data[i] = Math.min(1, rock + t * col.r) * 255;
      img.data[i + 1] = Math.min(1, rock * 0.8 + t * col.g * 0.75) * 255;
      img.data[i + 2] = Math.min(1, rock * 0.8 + t * col.b * 0.6) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = toTexture(c, 2);
  cache.set(id, tex);
  return tex;
}

/** Animated-looking arcade signage / screen content. */
export function screenTexture(key: string, glyph: string, fg = '#25f4ee', bg = '#060913') {
  const id = `screen:${key}:${glyph}:${fg}:${bg}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const size = 128;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = fg;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i += 6) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = fg;
  ctx.font = `700 ${size * 0.6}px "Iowan Old Style", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, size / 2, size / 2);
  const tex = toTexture(c, 1);
  cache.set(id, tex);
  return tex;
}

export function disposeTextureCache() {
  cache.forEach((t) => t.dispose());
  cache.clear();
}

export { shade };
