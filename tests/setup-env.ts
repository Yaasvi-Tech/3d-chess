/**
 * Minimal DOM stand-in so the procedural geometry/texture code can be exercised
 * in Node (vitest) without a browser.
 */
class StubCtx {
  canvas: StubCanvas;
  fillStyle = '#000';
  strokeStyle = '#000';
  lineWidth = 1;
  font = '';
  textAlign = '';
  textBaseline = '';
  globalAlpha = 1;
  globalCompositeOperation = '';
  constructor(c: StubCanvas) {
    this.canvas = c;
  }
  createImageData(w: number, h: number) {
    return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  }
  putImageData() {}
  getImageData(x: number, y: number, w: number, h: number) {
    return this.createImageData(w, h);
  }
  createLinearGradient() {
    return { addColorStop() {} };
  }
  createRadialGradient() {
    return { addColorStop() {} };
  }
  fillRect() {}
  strokeRect() {}
  clearRect() {}
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
  arc() {}
  fill() {}
  stroke() {}
  save() {}
  restore() {}
  translate() {}
  rotate() {}
  scale() {}
  fillText() {}
}

class StubCanvas {
  width = 256;
  height = 256;
  private ctx = new StubCtx(this);
  getContext(kind: string) {
    if (kind === '2d') return this.ctx;
    return null;
  }
  toDataURL() {
    return 'data:image/png;base64,';
  }
  addEventListener() {}
  removeEventListener() {}
}

const doc = {
  createElement: (tag: string) => (tag === 'canvas' ? new StubCanvas() : { style: {} }),
  documentElement: { style: { setProperty() {} }, classList: { toggle() {} } },
  body: { appendChild() {}, style: {} },
};

const store = new Map<string, string>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).performance ??= { now: () => Date.now() };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).document = doc;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).HTMLCanvasElement = StubCanvas;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).window = globalThis as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).window.addEventListener ??= () => {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
