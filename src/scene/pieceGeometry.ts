/**
 * Procedural chess pieces.
 *
 * Every piece is generated at runtime from a small parametric description so the
 * app ships zero binary assets: a LatheGeometry profile (the "turner's" parts)
 * plus primitive extras (crowns, crenellations, knight heads, collars). Changing
 * `pieceStyle` swaps both the silhouette and the surface response.
 *
 * Convention: pieces are modelled facing +Z (toward the opponent) with the base
 * sitting on y = 0 and height normalised around 1 unit per tile.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PieceStyleId, PieceStyle } from '../data/styles';
import type { PieceType } from '../game/types';

const PIECE_HEIGHT: Record<PieceType, number> = {
  p: 0.62,
  n: 0.86,
  b: 0.95,
  r: 0.78,
  q: 1.06,
  k: 1.2,
};

interface Ctx {
  style: PieceStyle;
  seg: number;
  /** small helper for accent blobs (crowns, eyes, jewels) */
  accent: boolean;
}

function lathe(points: [number, number][], seg: number, phiStart = 0, phiLength = Math.PI * 2) {
  const pts = points.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0008), y));
  const g = new THREE.LatheGeometry(pts, Math.max(5, seg), phiStart, phiLength);
  g.computeVertexNormals();
  return g;
}

function translate(g: THREE.BufferGeometry, x: number, y: number, z: number) {
  g.translate(x, y, z);
  return g;
}

/** base plinth shared by every style, tuned by the style's baseRadius */
function basePlate(style: PieceStyle, seg: number, scale = 1, extra = 0): THREE.BufferGeometry {
  const r = style.baseRadius * scale;
  const h = 0.075 * scale + extra;
  if (style.flatShading && style.radialSegments <= 8) {
    const g = new THREE.CylinderGeometry(r * 0.94, r, h, seg);
    return translate(g, 0, h / 2, 0);
  }
  const g = lathe(
    [
      [r * 0.5, 0],
      [r, 0.004],
      [r, h * 0.62],
      [r * 0.9, h * 0.78],
      [r * 0.8, h],
      [r * 0.55, h],
    ],
    seg,
  );
  return g;
}

/** Staunton-ish turned bodies, per piece. Returns geometries for the body. */
function stauntonBody(type: PieceType, style: PieceStyle, seg: number): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [basePlate(style, seg, 1, 0.012)];
  const h = PIECE_HEIGHT[type];
  const top = 0.09;
  const prof: Record<PieceType, [number, number][]> = {
    p: [
      [0.19, top],
      [0.2, top + 0.05],
      [0.13, top + 0.12],
      [0.11, h - 0.17],
      [0.17, h - 0.12],
      [0.17, h - 0.08],
      [0.09, h - 0.07],
    ],
    n: [
      [0.2, top],
      [0.21, top + 0.06],
      [0.14, top + 0.16],
      [0.13, h * 0.42],
      [0.2, h * 0.46],
      [0.2, h * 0.5],
      [0.13, h * 0.52],
    ],
    b: [
      [0.2, top],
      [0.21, top + 0.06],
      [0.13, top + 0.16],
      [0.12, h - 0.36],
      [0.2, h - 0.3],
      [0.2, h - 0.26],
      [0.1, h - 0.24],
    ],
    r: [
      [0.22, top],
      [0.23, top + 0.06],
      [0.17, top + 0.14],
      [0.18, h - 0.16],
      [0.24, h - 0.12],
      [0.24, h - 0.02],
      [0.2, h - 0.02],
    ],
    q: [
      [0.22, top],
      [0.24, top + 0.07],
      [0.15, top + 0.2],
      [0.13, h - 0.4],
      [0.24, h - 0.3],
      [0.26, h - 0.24],
      [0.14, h - 0.22],
    ],
    k: [
      [0.22, top],
      [0.24, top + 0.07],
      [0.15, top + 0.2],
      [0.13, h - 0.44],
      [0.22, h - 0.34],
      [0.23, h - 0.28],
      [0.13, h - 0.26],
    ],
  };
  out.push(lathe(prof[type], seg));
  return out;
}

function stauntonToppers(type: PieceType, style: PieceStyle, seg: number, matIndex: number) {
  const h = PIECE_HEIGHT[type];
  const items: { geo: THREE.BufferGeometry; mat: number }[] = [];
  const add = (g: THREE.BufferGeometry, mat = 0) => items.push({ geo: g, mat });

  if (type === 'p') {
    add(translate(new THREE.SphereGeometry(0.1, seg, Math.max(8, seg / 2)), 0, h + 0.02, 0));
  }
  if (type === 'r') {
    const ring = new THREE.CylinderGeometry(0.24, 0.24, 0.06, seg);
    add(translate(ring, 0, h + 0.02, 0));
    const count = 6;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const tooth = new THREE.BoxGeometry(0.09, 0.1, 0.07);
      tooth.translate(Math.cos(a) * 0.2, h + 0.09, Math.sin(a) * 0.2);
      tooth.rotateY(-a);
      add(tooth);
    }
  }
  if (type === 'b') {
    const mitre = lathe(
      [
        [0.0, 0],
        [0.16, 0.02],
        [0.17, 0.1],
        [0.12, 0.2],
        [0.05, 0.27],
        [0.0, 0.3],
      ],
      seg,
    );
    add(translate(mitre, 0, h - 0.02, 0));
    add(translate(new THREE.SphereGeometry(0.05, seg, 8), 0, h + 0.3, 0), matIndex);
    const slit = new THREE.BoxGeometry(0.3, 0.05, 0.05);
    slit.rotateZ(-0.5);
    add(translate(slit, 0.02, h + 0.14, 0), matIndex);
  }
  if (type === 'n') {
    items.push({ geo: knightHead(style, seg), mat: 0 });
  }
  if (type === 'q') {
    const crown = new THREE.CylinderGeometry(0.2, 0.13, 0.14, seg);
    add(translate(crown, 0, h + 0.02, 0));
    const points = 8;
    for (let i = 0; i < points; i++) {
      const a = (i / points) * Math.PI * 2;
      const spike = new THREE.ConeGeometry(0.045, 0.12, Math.max(6, seg / 4));
      add(translate(spike, Math.cos(a) * 0.16, h + 0.13, Math.sin(a) * 0.16), matIndex);
      const ball = new THREE.SphereGeometry(0.035, 8, 6);
      add(translate(ball, Math.cos(a) * 0.16, h + 0.2, Math.sin(a) * 0.16), matIndex);
    }
  }
  if (type === 'k') {
    const crown = new THREE.CylinderGeometry(0.19, 0.15, 0.16, seg);
    add(translate(crown, 0, h, 0));
    const band = new THREE.TorusGeometry(0.19, 0.022, 6, seg);
    band.rotateX(Math.PI / 2);
    add(translate(band, 0, h + 0.06, 0), matIndex);
    const v = new THREE.BoxGeometry(0.055, 0.22, 0.055);
    add(translate(v, 0, h + 0.24, 0));
    const hz = new THREE.BoxGeometry(0.17, 0.055, 0.055);
    add(translate(hz, 0, h + 0.27, 0));
  }
  return items;
}

/** A chunky, readable horse head built from boxes + a wedge snout. */
function knightHead(style: PieceStyle, seg: number): THREE.BufferGeometry {
  const h = PIECE_HEIGHT.n;
  const parts: THREE.BufferGeometry[] = [];
  const flat = style.flatShading ? 1 : 0;
  const neck = new THREE.BoxGeometry(0.2 + flat * 0.02, 0.42, 0.26);
  neck.rotateX(-0.28);
  parts.push(translate(neck, 0, h * 0.62, -0.02));
  const head = new THREE.BoxGeometry(0.19, 0.2, 0.34);
  head.rotateX(0.36);
  parts.push(translate(head, 0, h * 0.92, 0.06));
  const snout = new THREE.BoxGeometry(0.16, 0.13, 0.2);
  snout.rotateX(0.5);
  parts.push(translate(snout, 0, h * 0.84, 0.24));
  const ears = new THREE.ConeGeometry(0.05, 0.12, 5);
  parts.push(translate(ears.clone(), -0.06, h * 1.08, -0.02));
  parts.push(translate(ears.clone().rotateY(1.2), 0.06, h * 1.06, -0.02));
  const mane = new THREE.BoxGeometry(0.08, 0.3, 0.12);
  mane.rotateX(-0.5);
  parts.push(translate(mane, 0, h * 0.9, -0.13));
  const merged = mergeGeometries(parts.map((p) => p.toNonIndexed()), false);
  return merged ?? parts[0];
}

/** Neo-minimal: clean cones, cylinders and spheres — no decoration at all. */
function neoBody(type: PieceType, style: PieceStyle, seg: number) {
  const h = PIECE_HEIGHT[type] * 1.06;
  const items: { geo: THREE.BufferGeometry; mat: number }[] = [];
  const base = new THREE.CylinderGeometry(style.baseRadius * 0.92, style.baseRadius, 0.1, seg);
  items.push({ geo: translate(base, 0, 0.05, 0), mat: 0 });
  const body = (topR: number, botR: number, height: number, y: number) =>
    translate(new THREE.CylinderGeometry(topR, botR, height, seg), 0, y, 0);

  switch (type) {
    case 'p':
      items.push({ geo: body(0.02, 0.2, h - 0.1, 0.1 + (h - 0.1) / 2), mat: 0 });
      break;
    case 'r':
      items.push({ geo: body(0.21, 0.23, h - 0.1, 0.1 + (h - 0.1) / 2), mat: 0 });
      items.push({ geo: translate(new THREE.BoxGeometry(0.5, 0.09, 0.09), 0, h, 0), mat: 1 });
      items.push({ geo: translate(new THREE.BoxGeometry(0.09, 0.09, 0.5), 0, h, 0), mat: 1 });
      break;
    case 'n':
      items.push({ geo: body(0.08, 0.22, h - 0.14, 0.1 + (h - 0.14) / 2), mat: 0 });
      {
        const w = new THREE.BoxGeometry(0.1, 0.1, 0.44);
        w.rotateX(0.6);
        items.push({ geo: translate(w, 0, h - 0.02, 0.06), mat: 1 });
      }
      break;
    case 'b':
      items.push({ geo: body(0.0, 0.22, h - 0.12, 0.1 + (h - 0.12) / 2), mat: 0 });
      items.push({ geo: translate(new THREE.SphereGeometry(0.045, 12, 8), 0, h + 0.02, 0), mat: 1 });
      break;
    case 'q':
      items.push({ geo: body(0.16, 0.22, h - 0.12, 0.1 + (h - 0.12) / 2), mat: 0 });
      items.push({ geo: translate(new THREE.ConeGeometry(0.17, 0.16, seg), 0, h + 0.02, 0), mat: 1 });
      break;
    case 'k':
      items.push({ geo: body(0.15, 0.22, h - 0.16, 0.1 + (h - 0.16) / 2), mat: 0 });
      items.push({ geo: translate(new THREE.BoxGeometry(0.05, 0.2, 0.05), 0, h + 0.06, 0), mat: 1 });
      items.push({ geo: translate(new THREE.BoxGeometry(0.15, 0.05, 0.05), 0, h + 0.1, 0), mat: 1 });
      break;
  }
  return items;
}

/** Crystal: a single faceted prism whose silhouette encodes the piece. */
function crystalBody(type: PieceType, style: PieceStyle, seg: number) {
  const h = PIECE_HEIGHT[type] * 1.15;
  const sides = Math.max(5, style.radialSegments);
  const items: { geo: THREE.BufferGeometry; mat: number }[] = [];
  const radii: Record<PieceType, [number, number, number]> = {
    p: [0.24, 0.1, 0.16],
    n: [0.25, 0.12, 0.55],
    b: [0.24, 0.08, 0.9],
    r: [0.27, 0.24, 0.06],
    q: [0.28, 0.16, 0.45],
    k: [0.27, 0.12, 0.0],
  };
  const [r0, r1, shear] = radii[type];
  const prism = new THREE.CylinderGeometry(r1, r0, h, sides, 1);
  if (type === 'n') {
    prism.scale(1, 1, 1);
    items.push({ geo: translate(prism, 0, h / 2, 0.04), mat: 0 });
    const blade = new THREE.BoxGeometry(0.06, 0.34, 0.4);
    blade.rotateX(-0.7);
    items.push({ geo: translate(blade, 0, h * 0.9, 0.14), mat: 1 });
  } else {
    items.push({ geo: translate(prism, 0, h / 2, 0), mat: 0 });
  }
  if (type === 'r') {
    const cap = new THREE.CylinderGeometry(0.27, 0.24, 0.1, sides);
    items.push({ geo: translate(cap, 0, h + 0.02, 0), mat: 0 });
  }
  if (type === 'q') {
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const spike = new THREE.ConeGeometry(0.05, 0.18, 4);
      items.push({ geo: translate(spike, Math.cos(a) * 0.15, h + 0.08, Math.sin(a) * 0.15), mat: 1 });
    }
  }
  if (type === 'k') {
    const shard = new THREE.OctahedronGeometry(0.13, 0);
    items.push({ geo: translate(shard, 0, h + 0.1, 0), mat: 1 });
  }
  if (type === 'b') {
    const tip = new THREE.ConeGeometry(0.09, 0.22, sides);
    items.push({ geo: translate(tip, 0, h + 0.06, 0), mat: 1 });
  }
  if (type === 'p') {
    const tip = new THREE.TetrahedronGeometry(0.09, 0);
    items.push({ geo: translate(tip, 0, h + 0.04, 0), mat: 1 });
  }
  void shear;
  return items;
}

/** Cyber: hex chassis with emissive rings, an antenna per rank. */
function cyberBody(type: PieceType, style: PieceStyle, seg: number) {
  const h = PIECE_HEIGHT[type];
  const sides = 6;
  const items: { geo: THREE.BufferGeometry; mat: number }[] = [];
  const hull = new THREE.CylinderGeometry(0.16, 0.3, h * 0.82, sides);
  items.push({ geo: translate(hull, 0, h * 0.41 + 0.06, 0), mat: 0 });
  const skirt = new THREE.CylinderGeometry(0.33, 0.36, 0.1, sides);
  items.push({ geo: translate(skirt, 0, 0.05, 0), mat: 0 });
  for (let i = 1; i <= 2; i++) {
    const ring = new THREE.TorusGeometry(0.24 - i * 0.03, 0.014, 6, sides * 4);
    ring.rotateX(Math.PI / 2);
    items.push({ geo: translate(ring, 0, (h * 0.82 * i) / 2.6, 0), mat: 1 });
  }
  const headR = type === 'k' ? 0.17 : type === 'q' ? 0.16 : 0.13;
  const head = new THREE.IcosahedronGeometry(headR, 0);
  items.push({ geo: translate(head, 0, h * 0.86 + 0.06, 0), mat: 0 });
  if (type === 'n') {
    const fin = new THREE.BoxGeometry(0.05, 0.3, 0.24);
    fin.rotateX(-0.5);
    items.push({ geo: translate(fin, 0, h * 0.9, -0.06), mat: 1 });
    const visor = new THREE.BoxGeometry(0.2, 0.05, 0.06);
    items.push({ geo: translate(visor, 0, h * 0.9, headR * 0.85), mat: 1 });
  }
  if (type === 'r') {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const ant = new THREE.CylinderGeometry(0.02, 0.03, 0.2, 5);
      items.push({ geo: translate(ant, Math.cos(a) * 0.16, h * 0.98, Math.sin(a) * 0.16), mat: 1 });
    }
  }
  if (type === 'b') {
    const laser = new THREE.ConeGeometry(0.05, 0.3, 5);
    items.push({ geo: translate(laser, 0, h + 0.16, 0), mat: 1 });
  }
  if (type === 'q') {
    const halo = new THREE.TorusGeometry(0.2, 0.02, 6, 24);
    halo.rotateX(Math.PI / 2);
    items.push({ geo: translate(halo, 0, h + 0.02, 0), mat: 1 });
  }
  if (type === 'k') {
    for (let i = 0; i < 3; i++) {
      const rod = new THREE.CylinderGeometry(0.018, 0.018, 0.26 - i * 0.04, 5);
      items.push({ geo: translate(rod, (i - 1) * 0.08, h * 1.02 + 0.1, 0), mat: 1 });
    }
  }
  if (type === 'p') {
    const dome = new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    items.push({ geo: translate(dome, 0, h * 0.86, 0), mat: 1 });
  }
  void style;
  return items;
}

/** Marble bust: fluted column bodies with capital tops. */
function marbleBody(type: PieceType, style: PieceStyle, seg: number) {
  const h = PIECE_HEIGHT[type] * 1.04;
  const items: { geo: THREE.BufferGeometry; mat: number }[] = [];
  items.push({ geo: basePlate(style, seg, 1.05, 0.02), mat: 0 });
  const col = new THREE.CylinderGeometry(0.15, 0.19, h - 0.22, seg);
  items.push({ geo: translate(col, 0, 0.12 + (h - 0.22) / 2, 0), mat: 0 });
  const cap = new THREE.CylinderGeometry(0.23, 0.16, 0.09, seg);
  items.push({ geo: translate(cap, 0, h - 0.08, 0), mat: 0 });
  // flutes
  const fluteCount = 10;
  for (let i = 0; i < fluteCount; i++) {
    const a = (i / fluteCount) * Math.PI * 2;
    const f = new THREE.CylinderGeometry(0.022, 0.022, h - 0.3, 6);
    items.push({ geo: translate(f, Math.cos(a) * 0.17, 0.12 + (h - 0.3) / 2, Math.sin(a) * 0.17), mat: 1 });
  }
  switch (type) {
    case 'p':
      items.push({ geo: translate(new THREE.SphereGeometry(0.11, seg, 12), 0, h + 0.03, 0), mat: 0 });
      break;
    case 'r': {
      const drum = new THREE.CylinderGeometry(0.23, 0.23, 0.16, seg);
      items.push({ geo: translate(drum, 0, h + 0.04, 0), mat: 0 });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const t = new THREE.BoxGeometry(0.09, 0.11, 0.08);
        t.rotateY(-a);
        items.push({ geo: translate(t, Math.cos(a) * 0.19, h + 0.15, Math.sin(a) * 0.19), mat: 0 });
      }
      break;
    }
    case 'n':
      items.push({ geo: translate(knightHead(style, seg), 0, 0.06, 0), mat: 0 });
      break;
    case 'b': {
      const dome = new THREE.SphereGeometry(0.15, seg, 14, 0, Math.PI * 2, 0, Math.PI * 0.62);
      items.push({ geo: translate(dome, 0, h + 0.02, 0), mat: 0 });
      const slit = new THREE.BoxGeometry(0.26, 0.035, 0.035);
      slit.rotateZ(-0.55);
      items.push({ geo: translate(slit, 0.02, h + 0.1, 0), mat: 1 });
      break;
    }
    case 'q': {
      const bowl = new THREE.CylinderGeometry(0.22, 0.14, 0.14, seg);
      items.push({ geo: translate(bowl, 0, h + 0.06, 0), mat: 0 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const ball = new THREE.SphereGeometry(0.045, 10, 8);
        items.push({ geo: translate(ball, Math.cos(a) * 0.18, h + 0.15, Math.sin(a) * 0.18), mat: 1 });
      }
      break;
    }
    case 'k': {
      const band = new THREE.CylinderGeometry(0.2, 0.2, 0.12, seg);
      items.push({ geo: translate(band, 0, h + 0.05, 0), mat: 0 });
      const v = new THREE.BoxGeometry(0.05, 0.2, 0.05);
      items.push({ geo: translate(v, 0, h + 0.2, 0), mat: 1 });
      items.push({ geo: translate(new THREE.BoxGeometry(0.14, 0.05, 0.05), 0, h + 0.23, 0), mat: 1 });
      break;
    }
  }
  return items;
}

/** Carved jade: soft, chunky, low-poly organic lumps. */
function carvedBody(type: PieceType, style: PieceStyle, seg: number) {
  const h = PIECE_HEIGHT[type] * 1.02;
  const items: { geo: THREE.BufferGeometry; mat: number }[] = [];
  const low = Math.min(16, Math.max(8, seg / 2));
  items.push({
    geo: translate(new THREE.CylinderGeometry(style.baseRadius, style.baseRadius * 1.12, 0.12, low), 0, 0.06, 0),
    mat: 0,
  });
  const blob = (scaleY: number, y: number, r: number) => {
    const g = new THREE.SphereGeometry(r, low, Math.max(6, low / 2));
    g.scale(1, scaleY, 1);
    return translate(g, 0, y, 0);
  };
  switch (type) {
    case 'p':
      items.push({ geo: blob(1.5, h * 0.45, 0.2), mat: 0 });
      items.push({ geo: blob(1, h + 0.02, 0.1), mat: 0 });
      break;
    case 'n': {
      items.push({ geo: blob(1.7, h * 0.45, 0.21), mat: 0 });
      const snout = new THREE.SphereGeometry(0.13, low, 8);
      snout.scale(1, 0.7, 1.6);
      items.push({ geo: translate(snout, 0, h * 0.92, 0.1), mat: 0 });
      items.push({ geo: translate(new THREE.SphereGeometry(0.05, 8, 6), 0.08, h + 0.05, -0.02), mat: 1 });
      break;
    }
    case 'b':
      items.push({ geo: blob(1.9, h * 0.45, 0.2), mat: 0 });
      items.push({ geo: translate(new THREE.ConeGeometry(0.11, 0.3, low), 0, h + 0.05, 0), mat: 0 });
      items.push({ geo: translate(new THREE.BoxGeometry(0.28, 0.03, 0.03), 0.02, h * 0.8, 0.04), mat: 1 });
      break;
    case 'r':
      items.push({ geo: blob(1.5, h * 0.5, 0.23), mat: 0 });
      items.push({ geo: translate(new THREE.BoxGeometry(0.4, 0.16, 0.4), 0, h + 0.02, 0), mat: 0 });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        items.push({
          geo: translate(new THREE.BoxGeometry(0.12, 0.12, 0.12), Math.cos(a) * 0.14, h + 0.14, Math.sin(a) * 0.14),
          mat: 0,
        });
      }
      break;
    case 'q':
      items.push({ geo: blob(1.8, h * 0.45, 0.22), mat: 0 });
      items.push({ geo: translate(new THREE.ConeGeometry(0.16, 0.22, low), 0, h + 0.04, 0), mat: 0 });
      items.push({ geo: translate(new THREE.SphereGeometry(0.06, 10, 8), 0, h + 0.19, 0), mat: 1 });
      break;
    case 'k':
      items.push({ geo: blob(1.9, h * 0.45, 0.22), mat: 0 });
      items.push({ geo: translate(new THREE.ConeGeometry(0.14, 0.26, low), 0, h + 0.05, 0), mat: 0 });
      items.push({ geo: translate(new THREE.BoxGeometry(0.05, 0.18, 0.05), 0, h + 0.28, 0), mat: 1 });
      items.push({ geo: translate(new THREE.BoxGeometry(0.13, 0.05, 0.05), 0, h + 0.31, 0), mat: 1 });
      break;
  }
  return items;
}

const builders: Record<PieceStyleId, (t: PieceType, s: PieceStyle, seg: number) => { geo: THREE.BufferGeometry; mat: number }[]> = {
  staunton: (t, s, seg) => {
    const body = stauntonBody(t, s, seg).map((geo) => ({ geo, mat: 0 }));
    const toppers = stauntonToppers(t, s, seg, 1);
    if (t === 'n') {
      // knight: replace the plain collar top with the sculpted head
      body.push(...toppers.map(({ geo, mat }) => ({ geo, mat })));
    } else {
      body.push(...toppers.map(({ geo, mat }) => ({ geo, mat })));
    }
    return body;
  },
  neo: (t, s, seg) => neoBody(t, s, seg),
  crystal: (t, s, seg) => crystalBody(t, s, seg),
  cyber: (t, s, seg) => cyberBody(t, s, seg),
  marble: (t, s, seg) => marbleBody(t, s, seg),
  carved: (t, s, seg) => carvedBody(t, s, seg),
};

export interface BuiltPiece {
  /** true when a multi-part piece could not be merged (falls back to part one) */
  mergeFailed?: boolean;
  /** merged body geometry (material index 0) */
  body: THREE.BufferGeometry;
  /** merged accent geometry (material index 1 — glow, jewels, trim) */
  accent: THREE.BufferGeometry | null;
  /** collision-ish footprint used by the highlight ring */
  radius: number;
  height: number;
}

const cache = new Map<string, BuiltPiece>();

export function buildPiece(style: PieceStyle, type: PieceType): BuiltPiece {
  const key = `${style.id}:${type}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const seg = style.radialSegments;
  const parts = builders[style.id](type, style, seg);
  const bodies: THREE.BufferGeometry[] = [];
  const accents: THREE.BufferGeometry[] = [];
  for (const p of parts) {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    if (style.flatShading) g.computeVertexNormals();
    (p.mat === 1 ? accents : bodies).push(g);
  }
  let mergeFailed = false;
  const merge = (list: THREE.BufferGeometry[]) => {
    if (list.length === 0) return null;
    if (list.length === 1) return list[0];
    const merged = mergeGeometries(list, false);
    if (!merged) mergeFailed = true;
    return merged ?? list[0];
  };
  const body = merge(bodies) ?? new THREE.BufferGeometry();
  const accent = merge(accents);
  body.computeBoundingSphere();
  const built: BuiltPiece = {
    mergeFailed,
    body,
    accent,
    radius: style.baseRadius * style.scale,
    height: PIECE_HEIGHT[type] * style.scale,
  };
  // A single scaled group: normalise the whole piece so the tallest king is ~1.1 tiles.
  built.body.scale(style.scale, style.scale, style.scale);
  built.accent?.scale(style.scale, style.scale, style.scale);
  built.height *= style.scale;
  cache.set(key, built);
  return built;
}

/** Instanced-friendly: list of every (style, piece) combination to pre-bake. */
export const PIECE_TYPES: PieceType[] = ['p', 'n', 'b', 'r', 'q', 'k'];

export function disposePieceCache() {
  cache.forEach((p) => {
    p.body.dispose();
    p.accent?.dispose();
  });
  cache.clear();
}
