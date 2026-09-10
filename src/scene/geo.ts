/** Module-level shared geometries for the board & overlays (built once). */
import * as THREE from 'three';
import { BOARD_OUTER, FRAME_HEIGHT, FRAME_WIDTH, PLINTH_HEIGHT, TILE_THICKNESS } from './layout';

export const overlayGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

export function tileGeometry(relief: number) {
  const h = TILE_THICKNESS + relief * 0.03;
  const g = new THREE.BoxGeometry(0.985, h, 0.985);
  g.translate(0, h / 2 - relief * 0.015, 0);
  return g;
}

export function frameGeometry() {
  const outer = new THREE.Shape();
  const r = 0.2;
  const o = BOARD_OUTER;
  outer.moveTo(-o + r, -o);
  outer.lineTo(o - r, -o);
  outer.quadraticCurveTo(o, -o, o, -o + r);
  outer.lineTo(o, o - r);
  outer.quadraticCurveTo(o, o, o - r, o);
  outer.lineTo(-o + r, o);
  outer.quadraticCurveTo(-o, o, -o, o - r);
  outer.lineTo(-o, -o + r);
  outer.quadraticCurveTo(-o, -o, -o + r, -o);
  const hole = new THREE.Path();
  const i = o - FRAME_WIDTH;
  hole.moveTo(-i, -i);
  hole.lineTo(i, -i);
  hole.lineTo(i, i);
  hole.lineTo(-i, i);
  hole.closePath();
  outer.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(outer, {
    depth: FRAME_HEIGHT,
    bevelEnabled: true,
    bevelSize: 0.022,
    bevelThickness: 0.022,
    bevelSegments: 2,
    curveSegments: 5,
  });
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/** Thin emissive/metal band inlaid at the inner edge of the frame. */
export function inlayGeometry(width = 0.035, height = 0.02) {
  const outer = new THREE.Shape();
  const i = BOARD_OUTER - FRAME_WIDTH + 0.02;
  const o = i + width;
  outer.moveTo(-o, -o);
  outer.lineTo(o, -o);
  outer.lineTo(o, o);
  outer.lineTo(-o, o);
  outer.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-i, -i);
  hole.lineTo(-i, i);
  hole.lineTo(i, i);
  hole.lineTo(i, -i);
  hole.closePath();
  outer.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(outer, { depth: height, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, FRAME_HEIGHT - height * 0.4, 0);
  return g;
}

export function plinthGeometry() {
  const o = BOARD_OUTER + 0.34;
  const g = new THREE.BoxGeometry(o * 2, PLINTH_HEIGHT, o * 2);
  g.translate(0, -PLINTH_HEIGHT / 2 + 0.005, 0);
  return g;
}

