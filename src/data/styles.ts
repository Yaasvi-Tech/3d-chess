/**
 * Style catalog: the four look-and-feel axes of the app.
 *
 *  - `boardStyle`  how the 8×8 surface and rim are built (materials, inlay, glow)
 *  - `pieceStyle`  the silhouette + material of the 32 pieces
 *  - `location`    the surrounding world (sky, ground, props, light rig)
 *  - `theme`       a curated preset that combines the three + a UI palette
 *
 * Everything here is data; the renderer consumes it, so new styles can be added
 * without touching the drawing code.
 */

export type BoardStyleId =
  | 'walnut'
  | 'marble'
  | 'neonGrid'
  | 'glass'
  | 'jade'
  | 'obsidian'
  | 'sandstone'
  | 'vinylSteel';

export type PieceStyleId = 'staunton' | 'neo' | 'crystal' | 'cyber' | 'marble' | 'carved';

export type LocationId =
  | 'grandHall'
  | 'skyGarden'
  | 'neonArcade'
  | 'moonDeck'
  | 'sunsetShore'
  | 'jadePalace'
  | 'obsidianForge'
  | 'library';

export interface BoardStyle {
  id: BoardStyleId;
  name: string;
  blurb: string;
  light: string;
  dark: string;
  frame: string;
  frameAccent: string;
  /** physical material knobs */
  roughness: number;
  metalness: number;
  clearcoat: number;
  transmission: number;
  ior: number;
  /** glow amount for emissive grid / rim light */
  emissive: number;
  emissiveColor: string;
  /** 0 = flat inlay squares, 1 = physically raised tiles */
  relief: number;
  /** grid line overlay drawn on the tile texture */
  gridLines: number;
  /** inlaid coordinate channels in the rim */
  coords: boolean;
  /** slight per-square colour noise, gives hand-made boards life */
  jitter: number;
}

export interface PieceStyle {
  id: PieceStyleId;
  name: string;
  blurb: string;
  /** lathe resolution — low values give the faceted/origami looks */
  radialSegments: number;
  flatShading: boolean;
  /** overall height multiplier */
  scale: number;
  baseRadius: number;
  /** material feel */
  roughness: number;
  metalness: number;
  clearcoat: number;
  transmission: number;
  /** rim light / glow strength used by 'cyber' */
  emissive: number;
  /** how much the accent material (collars, crowns, eyes) contrasts */
  accentMix: number;
  colors: { light: string; dark: string; lightAccent: string; darkAccent: string };
}

export interface LocationPreset {
  id: LocationId;
  name: string;
  place: string;
  blurb: string;
  /** three.js background gradient (top, horizon, bottom) */
  sky: [string, string, string];
  fogColor: string;
  fogDensity: number;
  ground: { color: string; roughness: number; metalness: number; reflect: number; scale: number };
  sun: { color: string; intensity: number; position: [number, number, number]; angle?: number };
  ambient: { color: string; intensity: number };
  rim: { color: string; intensity: number }[];
  /** the table/stand the board sits on */
  table: { color: string; height: number; radius: number; metalness: number; roughness: number; shape: 'round' | 'square' | 'slab' };
  particles?: { color: string; count: number; size: number; speed: number };
  /** 0 = fully enclosed room, 1 = fully open sky */
  openness: number;
  tone: number;
}

export interface Theme {
  id: string;
  name: string;
  blurb: string;
  board: BoardStyleId;
  pieces: PieceStyleId;
  location: LocationId;
  accent: string;
  ui: { bg: string; panel: string; text: string; subtle: string; border: string };
  tag: 'classic' | 'modern' | 'fantasy' | 'sci-fi' | 'nature';
}

export const BOARD_STYLES: Record<BoardStyleId, BoardStyle> = {
  walnut: {
    id: 'walnut',
    name: 'Walnut & Maple',
    blurb: 'Hand-turned tournament board, oiled walnut rim.',
    light: '#e8c893',
    dark: '#7a4a24',
    frame: '#4a2a15',
    frameAccent: '#2a160a',
    roughness: 0.55,
    metalness: 0.05,
    clearcoat: 0.35,
    transmission: 0,
    ior: 1.4,
    emissive: 0,
    emissiveColor: '#000000',
    relief: 0.35,
    gridLines: 0.15,
    coords: true,
    jitter: 0.06,
  },
  marble: {
    id: 'marble',
    name: 'Carrara & Onyx',
    blurb: 'Polished stone with cool reflections and deep inlay.',
    light: '#f1eee7',
    dark: '#23252d',
    frame: '#14161c',
    frameAccent: '#c9a86a',
    roughness: 0.14,
    metalness: 0.12,
    clearcoat: 0.7,
    transmission: 0.04,
    ior: 1.5,
    emissive: 0,
    emissiveColor: '#000000',
    relief: 0.18,
    gridLines: 0.05,
    coords: true,
    jitter: 0.03,
  },
  neonGrid: {
    id: 'neonGrid',
    name: 'Neon Grid',
    blurb: 'Black glass tiles with glowing cyan traces.',
    light: '#152230',
    dark: '#080d15',
    frame: '#05080e',
    frameAccent: '#25f4ee',
    roughness: 0.22,
    metalness: 0.6,
    clearcoat: 1,
    transmission: 0,
    ior: 1.6,
    emissive: 1.1,
    emissiveColor: '#25f4ee',
    relief: 0.12,
    gridLines: 1,
    coords: false,
    jitter: 0.02,
  },
  glass: {
    id: 'glass',
    name: 'Crystal Slab',
    blurb: 'Translucent cast glass, refracting the table below.',
    light: '#dff1ff',
    dark: '#7fa8c9',
    frame: '#c9dbe8',
    frameAccent: '#ffffff',
    roughness: 0.06,
    metalness: 0,
    clearcoat: 1,
    transmission: 0.82,
    ior: 1.52,
    emissive: 0.05,
    emissiveColor: '#bfe6ff',
    relief: 0.22,
    gridLines: 0.1,
    coords: true,
    jitter: 0.02,
  },
  jade: {
    id: 'jade',
    name: 'Jade Inlay',
    blurb: 'Imperial jade and lacquer, carved in a single slab.',
    light: '#d9e8cf',
    dark: '#2f6b4f',
    frame: '#5c1f1c',
    frameAccent: '#e0b64a',
    roughness: 0.2,
    metalness: 0.08,
    clearcoat: 0.9,
    transmission: 0.12,
    ior: 1.55,
    emissive: 0.08,
    emissiveColor: '#ffd76a',
    relief: 0.28,
    gridLines: 0.2,
    coords: true,
    jitter: 0.05,
  },
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian Ember',
    blurb: 'Volcanic glass with molten seams in the grout.',
    light: '#3a3540',
    dark: '#15121a',
    frame: '#0d0b10',
    frameAccent: '#ff6a2b',
    roughness: 0.3,
    metalness: 0.5,
    clearcoat: 0.5,
    transmission: 0,
    ior: 1.6,
    emissive: 0.55,
    emissiveColor: '#ff5a1f',
    relief: 0.4,
    gridLines: 0.75,
    coords: false,
    jitter: 0.08,
  },
  sandstone: {
    id: 'sandstone',
    name: 'Beach Sandstone',
    blurb: 'Sun-bleached stone tiles with warm grain.',
    light: '#f2dfbd',
    dark: '#b98b5e',
    frame: '#8d6a45',
    frameAccent: '#f8f2e2',
    roughness: 0.78,
    metalness: 0.02,
    clearcoat: 0.05,
    transmission: 0,
    ior: 1.4,
    emissive: 0,
    emissiveColor: '#000000',
    relief: 0.55,
    gridLines: 0.08,
    coords: true,
    jitter: 0.14,
  },
  vinylSteel: {
    id: 'vinylSteel',
    name: 'Vinyl & Steel',
    blurb: 'Airport-style brushed steel with rubber tiles.',
    light: '#cfd6dc',
    dark: '#2e3238',
    frame: '#1b1e23',
    frameAccent: '#8ea3b4',
    roughness: 0.35,
    metalness: 0.85,
    clearcoat: 0.2,
    transmission: 0,
    ior: 1.5,
    emissive: 0.03,
    emissiveColor: '#9fd0ff',
    relief: 0.25,
    gridLines: 0.35,
    coords: true,
    jitter: 0.04,
  },
};

export const PIECE_STYLES: Record<PieceStyleId, PieceStyle> = {
  staunton: {
    id: 'staunton',
    name: 'Classic Staunton',
    blurb: 'Traditional turned profile with collars and a cross finial.',
    radialSegments: 40,
    flatShading: false,
    scale: 1,
    baseRadius: 0.34,
    roughness: 0.42,
    metalness: 0.04,
    clearcoat: 0.4,
    transmission: 0,
    emissive: 0,
    accentMix: 0.5,
    colors: { light: '#f3e7d0', dark: '#2b2620', lightAccent: '#c9a86a', darkAccent: '#8a6b3c' },
  },
  neo: {
    id: 'neo',
    name: 'Neo Minimal',
    blurb: 'Pure geometry: only the silhouette and height differ.',
    radialSegments: 64,
    flatShading: false,
    scale: 0.98,
    baseRadius: 0.36,
    roughness: 0.28,
    metalness: 0.15,
    clearcoat: 0.85,
    transmission: 0,
    emissive: 0,
    accentMix: 0.2,
    colors: { light: '#f7f7f5', dark: '#1d1f26', lightAccent: '#e2554b', darkAccent: '#e2554b' },
  },
  crystal: {
    id: 'crystal',
    name: 'Crystal Prism',
    blurb: 'Faceted prisms in cast glass with hard speculars.',
    radialSegments: 6,
    flatShading: true,
    scale: 1.04,
    baseRadius: 0.32,
    roughness: 0.04,
    metalness: 0,
    clearcoat: 1,
    transmission: 0.78,
    emissive: 0.06,
    accentMix: 0.3,
    colors: { light: '#e8f7ff', dark: '#1b2340', lightAccent: '#9fe8ff', darkAccent: '#7aa8ff' },
  },
  cyber: {
    id: 'cyber',
    name: 'Neon Mech',
    blurb: 'Hex chassis, glowing rings, emissive armor trim.',
    radialSegments: 6,
    flatShading: true,
    scale: 1.02,
    baseRadius: 0.35,
    roughness: 0.3,
    metalness: 0.9,
    clearcoat: 0.3,
    transmission: 0,
    emissive: 2.4,
    accentMix: 1,
    colors: { light: '#20272f', dark: '#0f1116', lightAccent: '#25f4ee', darkAccent: '#ff2bd6' },
  },
  marble: {
    id: 'marble',
    name: 'Marble Bust',
    blurb: 'Statuary columns and capitals, museum lighting friendly.',
    radialSegments: 24,
    flatShading: false,
    scale: 1.06,
    baseRadius: 0.36,
    roughness: 0.5,
    metalness: 0.02,
    clearcoat: 0.25,
    transmission: 0.05,
    emissive: 0,
    accentMix: 0.35,
    colors: { light: '#efeade', dark: '#4a4a52', lightAccent: '#d8c9a8', darkAccent: '#2f2f36' },
  },
  carved: {
    id: 'carved',
    name: 'Carved Jade',
    blurb: 'Soft, chunky, hand-carved pieces with waxy translucency.',
    radialSegments: 18,
    flatShading: false,
    scale: 0.96,
    baseRadius: 0.37,
    roughness: 0.24,
    metalness: 0.02,
    clearcoat: 0.6,
    transmission: 0.22,
    emissive: 0.04,
    accentMix: 0.25,
    colors: { light: '#e7f2dc', dark: '#204a35', lightAccent: '#c8e0b4', darkAccent: '#66c39a' },
  },
};

export const LOCATIONS: Record<LocationId, LocationPreset> = {
  grandHall: {
    id: 'grandHall',
    name: 'The Grand Hall',
    place: 'Castle keep · Europe, 1480',
    blurb: 'Torch-lit stone hall with vaulted arches and heraldic banners.',
    sky: ['#241a12', '#3a2a1c', '#120c08'],
    fogColor: '#1a120c',
    fogDensity: 0.022,
    ground: { color: '#4a4038', roughness: 0.85, metalness: 0.05, reflect: 0.15, scale: 4 },
    sun: { color: '#ffce8f', intensity: 2.4, position: [4, 9, 5] },
    ambient: { color: '#7a5b3a', intensity: 0.5 },
    rim: [
      { color: '#ff8a3c', intensity: 2.2 },
      { color: '#ffb46a', intensity: 1.6 },
    ],
    table: { color: '#3c2415', height: 0.9, radius: 6.4, metalness: 0.05, roughness: 0.6, shape: 'square' },
    openness: 0.15,
    tone: 1.05,
  },
  skyGarden: {
    id: 'skyGarden',
    name: 'Sky Garden',
    place: 'Rooftop terrace · Singapore',
    blurb: 'Open-air terrace among planters, twelve floors up, soft trade-wind light.',
    sky: ['#9fd7ff', '#dff1ff', '#f7e6c9'],
    fogColor: '#cfe6f5',
    fogDensity: 0.008,
    ground: { color: '#8e8b80', roughness: 0.8, metalness: 0.02, reflect: 0.1, scale: 6 },
    sun: { color: '#fff4dc', intensity: 3.1, position: [6, 10, 4] },
    ambient: { color: '#bfe3ff', intensity: 0.85 },
    rim: [
      { color: '#ffe8c2', intensity: 1.1 },
      { color: '#9fe0b0', intensity: 0.8 },
    ],
    table: { color: '#e6e3da', height: 0.86, radius: 6, metalness: 0.1, roughness: 0.4, shape: 'round' },
    particles: { color: '#ffffff', count: 90, size: 0.03, speed: 0.14 },
    openness: 1,
    tone: 1.02,
  },
  neonArcade: {
    id: 'neonArcade',
    name: 'Neon Arcade',
    place: 'Underground arcade · Tokyo, 2088',
    blurb: 'Black-lit room of signage and laser grid; the board is the brightest thing here.',
    sky: ['#0a0616', '#1b0b2e', '#05030a'],
    fogColor: '#0b0618',
    fogDensity: 0.05,
    ground: { color: '#0a0a12', roughness: 0.18, metalness: 0.85, reflect: 0.9, scale: 2 },
    sun: { color: '#7d5cff', intensity: 1.4, position: [-3, 8, 2] },
    ambient: { color: '#3a2b6b', intensity: 0.55 },
    rim: [
      { color: '#25f4ee', intensity: 3.4 },
      { color: '#ff2bd6', intensity: 3.0 },
    ],
    table: { color: '#0d0d16', height: 0.92, radius: 5.6, metalness: 0.9, roughness: 0.22, shape: 'square' },
    particles: { color: '#7df9ff', count: 140, size: 0.035, speed: 0.2 },
    openness: 0.25,
    tone: 1.25,
  },
  moonDeck: {
    id: 'moonDeck',
    name: 'Lunar Deck',
    place: 'Tranquility Base · Mare Crisium',
    blurb: 'Regolith plateau under a hard sun, Earth hanging in a windless black sky.',
    sky: ['#05060a', '#0a0d16', '#020306'],
    fogColor: '#05060a',
    fogDensity: 0.006,
    ground: { color: '#9b9a97', roughness: 0.95, metalness: 0, reflect: 0.05, scale: 3 },
    sun: { color: '#fffbe8', intensity: 4.2, position: [8, 6, -4] },
    ambient: { color: '#41506b', intensity: 0.28 },
    rim: [
      { color: '#6fa8ff', intensity: 1.5 },
      { color: '#ffffff', intensity: 0.7 },
    ],
    table: { color: '#c8ccd2', height: 0.9, radius: 5.2, metalness: 0.5, roughness: 0.35, shape: 'round' },
    particles: { color: '#ffffff', count: 260, size: 0.02, speed: 0.05 },
    openness: 1,
    tone: 1.1,
  },
  sunsetShore: {
    id: 'sunsetShore',
    name: 'Sunset Shore',
    place: 'Tidal flat · Algarve, golden hour',
    blurb: 'Warm sand, long shadows and a shallow sea that mirrors the sky.',
    sky: ['#ff9d5c', '#ffd9a0', '#3b5f8f'],
    fogColor: '#f3bf8c',
    fogDensity: 0.011,
    ground: { color: '#e3c79b', roughness: 0.92, metalness: 0, reflect: 0.25, scale: 8 },
    sun: { color: '#ffb46b', intensity: 3.4, position: [-7, 3.2, -6] },
    ambient: { color: '#ffc79a', intensity: 0.7 },
    rim: [
      { color: '#ff8a3d', intensity: 2.1 },
      { color: '#7fd0ff', intensity: 0.9 },
    ],
    table: { color: '#c9a173', height: 0.8, radius: 6.2, metalness: 0.02, roughness: 0.75, shape: 'round' },
    particles: { color: '#ffe6c2', count: 120, size: 0.05, speed: 0.1 },
    openness: 1,
    tone: 1.06,
  },
  jadePalace: {
    id: 'jadePalace',
    name: 'Jade Palace',
    place: 'Pavilion garden · Suzhou',
    blurb: 'Lacquered pillars, silk lanterns and a courtyard of mist.',
    sky: ['#12261f', '#1f4235', '#08120e'],
    fogColor: '#12241d',
    fogDensity: 0.03,
    ground: { color: '#2c4438', roughness: 0.5, metalness: 0.1, reflect: 0.4, scale: 4 },
    sun: { color: '#ffe9b8', intensity: 2.1, position: [3, 8, 6] },
    ambient: { color: '#3f6b56', intensity: 0.6 },
    rim: [
      { color: '#ffcf6a', intensity: 2.0 },
      { color: '#5ce0a8', intensity: 1.0 },
    ],
    table: { color: '#5c1f1c', height: 0.88, radius: 5.8, metalness: 0.15, roughness: 0.35, shape: 'square' },
    particles: { color: '#d8ffe8', count: 110, size: 0.03, speed: 0.08 },
    openness: 0.35,
    tone: 1.0,
  },
  obsidianForge: {
    id: 'obsidianForge',
    name: 'Obsidian Forge',
    place: 'Basalt quarry · island of volcanoes',
    blurb: 'Cracked black rock with magma seams glowing through the floor.',
    sky: ['#1a0a06', '#39120a', '#0a0503'],
    fogColor: '#1c0a06',
    fogDensity: 0.038,
    ground: { color: '#241d1e', roughness: 0.6, metalness: 0.35, reflect: 0.35, scale: 3 },
    sun: { color: '#ff9a4a', intensity: 1.8, position: [-4, 6, -3] },
    ambient: { color: '#5a2410', intensity: 0.55 },
    rim: [
      { color: '#ff5a1f', intensity: 3.6 },
      { color: '#ffa14a', intensity: 1.4 },
    ],
    table: { color: '#141014', height: 0.94, radius: 5.6, metalness: 0.5, roughness: 0.35, shape: 'slab' },
    particles: { color: '#ffb066', count: 160, size: 0.045, speed: 0.35 },
    openness: 0.45,
    tone: 1.15,
  },
  library: {
    id: 'library',
    name: 'Grand Library',
    place: 'Reading room · midnight',
    blurb: 'Towering shelves, brass lamps and a very serious hush.',
    sky: ['#1d1712', '#2f251b', '#0f0b08'],
    fogColor: '#1a140f',
    fogDensity: 0.02,
    ground: { color: '#3a2a1c', roughness: 0.65, metalness: 0.05, reflect: 0.2, scale: 5 },
    sun: { color: '#ffdca8', intensity: 2.2, position: [2, 7, 5] },
    ambient: { color: '#6b5238', intensity: 0.55 },
    rim: [
      { color: '#ffcf8a', intensity: 1.6 },
      { color: '#7ea8d0', intensity: 0.7 },
    ],
    table: { color: '#4a2c17', height: 0.9, radius: 6, metalness: 0.08, roughness: 0.45, shape: 'square' },
    particles: { color: '#ffe9c4', count: 90, size: 0.03, speed: 0.06 },
    openness: 0.2,
    tone: 1.02,
  },
};

export const THEMES: Theme[] = [
  {
    id: 'club-classic',
    name: 'Club Classic',
    blurb: 'The tournament-hall look: walnut board, Staunton pieces, warm lamps.',
    board: 'walnut',
    pieces: 'staunton',
    location: 'library',
    accent: '#c9a86a',
    ui: { bg: '#120e0a', panel: 'rgba(30,24,18,0.82)', text: '#f2e9dc', subtle: '#a2937f', border: 'rgba(201,168,106,0.22)' },
    tag: 'classic',
  },
  {
    id: 'midnight-marble',
    name: 'Midnight Marble',
    blurb: 'Carrara and onyx under cold key light in a stone hall.',
    board: 'marble',
    pieces: 'marble',
    location: 'grandHall',
    accent: '#9fc4ff',
    ui: { bg: '#0b0d14', panel: 'rgba(18,22,34,0.82)', text: '#e9eefc', subtle: '#8d9ab8', border: 'rgba(159,196,255,0.18)' },
    tag: 'classic',
  },
  {
    id: 'neon-circuit',
    name: 'Neon Circuit',
    blurb: 'Glowing grid board, emissive mech pieces, heavy bloom.',
    board: 'neonGrid',
    pieces: 'cyber',
    location: 'neonArcade',
    accent: '#25f4ee',
    ui: { bg: '#05060d', panel: 'rgba(10,14,26,0.84)', text: '#dffaff', subtle: '#7f92b3', border: 'rgba(37,244,238,0.25)' },
    tag: 'sci-fi',
  },
  {
    id: 'lunar-crystal',
    name: 'Lunar Crystal',
    blurb: 'Cast-glass slab and faceted prisms on the moon.',
    board: 'glass',
    pieces: 'crystal',
    location: 'moonDeck',
    accent: '#a8e6ff',
    ui: { bg: '#06080f', panel: 'rgba(14,18,28,0.8)', text: '#e6f1ff', subtle: '#8ea3bf', border: 'rgba(168,230,255,0.2)' },
    tag: 'sci-fi',
  },
  {
    id: 'sky-garden',
    name: 'Sky Garden',
    blurb: 'Minimal white pieces on an open terrace at noon.',
    board: 'marble',
    pieces: 'neo',
    location: 'skyGarden',
    accent: '#6fd7a8',
    ui: { bg: '#eef4f6', panel: 'rgba(255,255,255,0.8)', text: '#1d2a2f', subtle: '#5f757f', border: 'rgba(29,42,47,0.12)' },
    tag: 'nature',
  },
  {
    id: 'golden-shore',
    name: 'Golden Shore',
    blurb: 'Sandstone tiles and carved pieces with a low amber sun.',
    board: 'sandstone',
    pieces: 'carved',
    location: 'sunsetShore',
    accent: '#ff9d5c',
    ui: { bg: '#1a1109', panel: 'rgba(38,24,16,0.8)', text: '#ffe9d2', subtle: '#c79a76', border: 'rgba(255,157,92,0.22)' },
    tag: 'nature',
  },
  {
    id: 'jade-emperor',
    name: 'Jade Emperor',
    blurb: 'Lacquer, jade and silk lanterns in a walled garden.',
    board: 'jade',
    pieces: 'carved',
    location: 'jadePalace',
    accent: '#e0b64a',
    ui: { bg: '#0b1712', panel: 'rgba(16,34,26,0.84)', text: '#e9f5ea', subtle: '#88ab95', border: 'rgba(224,182,74,0.22)' },
    tag: 'fantasy',
  },
  {
    id: 'obsidian-forge',
    name: 'Obsidian Forge',
    blurb: 'Magma seams under a black glass board. Bring heat-proof nerves.',
    board: 'obsidian',
    pieces: 'cyber',
    location: 'obsidianForge',
    accent: '#ff5a1f',
    ui: { bg: '#0c0708', panel: 'rgba(24,12,10,0.84)', text: '#ffe4d5', subtle: '#b98a72', border: 'rgba(255,90,31,0.24)' },
    tag: 'fantasy',
  },
  {
    id: 'vinyl-terminal',
    name: 'Vinyl Terminal',
    blurb: 'Brushed steel rim, rubber tiles, arcade furniture.',
    board: 'vinylSteel',
    pieces: 'neo',
    location: 'neonArcade',
    accent: '#8ea3b4',
    ui: { bg: '#0d1013', panel: 'rgba(20,25,30,0.84)', text: '#e7eef4', subtle: '#8b9aa6', border: 'rgba(142,163,180,0.2)' },
    tag: 'modern',
  },
];

export const THEME_MAP = Object.fromEntries(THEMES.map((t) => [t.id, t])) as Record<string, Theme>;

export const CAMERA_VIEWS = [
  { id: 'player', name: 'Player', position: [0, 7.4, 8.9] as [number, number, number], target: [0, 0.35, 0] as [number, number, number], fov: 42 },
  { id: 'broadcast', name: 'Broadcast', position: [8.6, 4.2, 6.2] as [number, number, number], target: [0, 0.5, 0] as [number, number, number], fov: 34 },
  { id: 'top', name: 'Tactics board', position: [0, 12.2, 0.001] as [number, number, number], target: [0, 0, 0] as [number, number, number], fov: 40 },
  { id: 'low', name: 'Table level', position: [6.2, 1.9, 6.6] as [number, number, number], target: [0, 0.8, 0] as [number, number, number], fov: 48 },
  { id: 'cinematic', name: 'Cinematic', position: [-7.6, 5.2, 7.8] as [number, number, number], target: [0, 0.5, 0] as [number, number, number], fov: 38 },
] as const;

export type CameraViewId = (typeof CAMERA_VIEWS)[number]['id'];

export const TIME_CONTROLS = [
  { id: 'bullet', name: 'Bullet', label: '2+1', baseMs: 120000, incMs: 1000 },
  { id: 'blitz', name: 'Blitz', label: '5+0', baseMs: 300000, incMs: 0 },
  { id: 'rapid', name: 'Rapid', label: '10+5', baseMs: 600000, incMs: 5000 },
  { id: 'classical', name: 'Classical', label: '30+0', baseMs: 1800000, incMs: 0 },
  { id: 'untimed', name: 'Untimed', label: 'no clock', baseMs: 0, incMs: 0 },
] as const;

export type TimeControlId = (typeof TIME_CONTROLS)[number]['id'];

