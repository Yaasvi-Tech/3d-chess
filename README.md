<div align="center">

# ♞ Chess3D

**A stylised 3D chess set you can completely restyle — and a tournament hall to play it in.**

Themes · Locations · Board & piece styles · Tournaments

</div>

---

Chess3D is a browser chess client built on [three.js](https://threejs.org) /
[@react-three/fiber](https://r3f.docs.pmnd.rs) where the *look* is a first-class
feature. Nothing is a downloaded asset: every board, piece, texture, sky and prop
is generated procedurally at runtime, so swapping a theme is instant and the app
works offline.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm test         # 68 unit + integration tests
```

## The four pillars

### 1 · Themes
Nine curated presets — `Club Classic`, `Midnight Marble`, `Neon Circuit`, `Lunar
Crystal`, `Sky Garden`, `Golden Shore`, `Jade Emperor`, `Obsidian Forge`, `Vinyl
Terminal` — each one bundles a location, a board finish, a piece set, a UI
palette and a light rig. Pick one from the home screen or the Style studio
(`C`), then override any single axis you like.

### 2 · Places / location views
Eight full stages, each with its own sky, fog, ground material, table, light rig
and prop cluster:

| Stage | Where |
| --- | --- |
| The Grand Hall | torch-lit castle keep, banners, columns |
| Sky Garden | rooftop terrace, planters, hazy skyline |
| Neon Arcade | black-lit room, signage, laser grid floor |
| Lunar Deck | regolith plateau, lander, Earth overhead |
| Sunset Shore | tidal flat, reflective sea, low amber sun |
| Jade Palace | lacquered pillars, swaying lanterns, moon gate |
| Obsidian Forge | basalt columns, molten seams, embers |
| Grand Library | shelves of books, brass lamps, rug |

Plus five camera views (Player, Broadcast, Tactics board, Table level, Cinematic)
with a damped transition, free orbit/zoom, and an optional auto-flip that follows
the side to move.

### 3 · Board & piece styles
**8 board finishes** — walnut & maple, Carrara/onyx, neon grid, cast crystal, jade
inlay, obsidian ember, beach sandstone, vinyl & steel — differing in materials
(`clearcoat`, `transmission`, `roughness`), tile relief, inlay, glow and
coordinates.

**6 piece sets**, all modelled from parametric lathes + primitives:
*Classic Staunton* (turned collars, crenellated rooks, sculpted knight, cross
finial), *Neo Minimal*, *Crystal Prism* (faceted, transmissive), *Neon Mech*
(hex chassis with emissive rings), *Marble Bust* (fluted columns) and *Carved
Jade* (chunky, waxy, translucent).

Piece identity is tracked across moves, so pieces **slide and hop** into place,
captured pieces topple and sink, castling moves the rook, and promotion swaps the
mesh under the same id.

### 4 · Tournaments
Round robin (Berger tables), Swiss (score-grouped, no rematches, colour
preferences) and seeded knockout (power-of-two bracket with byes, two games per
match, colours swapped).

- Editable field of named bot personas with ratings, or add human seats.
- Time controls with real countdown clocks and increments; flags lose.
- **Live boards**: every game in a round runs simultaneously on real
  `GameController`s. Cards stream move counts, last move and evaluation.
- Click any board to take your seat; release it and the engine resumes, so the
  round never stalls.
- Pause, 1×–8× autoplay speed, fast-forward, auto-advancing rounds.
- Standings with win/draw/loss, Sonneborn-Berger, win count and tournament
  performance rating, plus form strings. A level knockout tie is settled by the
  result with the black pieces, then by seeding — never by a coin flip.
- Full-event PGN export (copy or download) with player names, ratings, clock
  results and termination reasons — byes are recorded in the table, not as games.

## Playing

- Tap a piece to see its legal moves, tap again to move — or drag and drop.
- Legal moves show as dots, captures as rings, check pulses red under the king.
- `F` flip · `U` undo · `H` hint · `C` style studio · `Esc` close dialogs.
- Click a move in the move list to scrub the board back to that position
  (read-only preview), `⏭` returns to the live game.
- Promotions open a picker; resign/draw/rematch are in the action bar.
- Every game can be copied as PGN or downloaded, and the FEN is one click away.

## Opponents

A small alpha-beta engine (iterative deepening, MVV-LVA ordering, quiescence
search, piece-square tables, pawn structure and bishop-pair terms) runs in a web
worker at five levels — `Casual · Beginner · Club · Strong · Master` (≈700–2200
Elo), with noise and occasional blunders at the low end so games do not repeat.
If workers are unavailable it transparently falls back to a main-thread search.

## Architecture

```
src/
  game/         rules layer on top of chess.js
    controller.ts   one class per game: moves, selection, bots, clocks, PGN
    pieces.ts       stable piece identities (animation-friendly move diff)
    eval.ts         static evaluation shared by the UI bar and the engine
    ai/             search core, worker, main-thread client pool
  scene/        the 3D stage
    pieceGeometry.ts  parametric lathes + toppers per piece style
    textures.ts       procedural wood/marble/stone/neon/sky/books/lava decals
    materials.ts      style data → MeshPhysicalMaterial
    Board.tsx         tiles, frame, inlay, coordinates, highlights, picking
    Pieces.tsx        damped piece motion, capture topple
    World.tsx         the eight locations: sky, ground, table, lights, props
    Rig.tsx           camera presets + orbit controls
    Scene.tsx        the single persistent <Canvas>
  tournament/     pairings, standings, and the store + live runner
  ui/             home, HUD, style studio, tournament centre (plain DOM)
  state/         persisted settings, session routing, synthesised audio
```

`GameController` is deliberately framework-free with a
`subscribe`/`getVersion` pair, so React binds to it with
`useSyncExternalStore` and the tournament runner can drive dozens of them at once
without a store per board.

## Deploying

`npm run build` is all a host needs: `dist/` is a static bundle with relative
asset URLs, so the same output runs at a domain root *or* under a sub-path
(GitHub Pages project sites, path-prefixed previews, a plain `python -m http.server`
in `dist/`).

```bash
npm run build     # tsc -b && vite build && node scripts/postbuild.mjs
npm run preview   # serves dist/ at http://localhost:5173
```

| Host | What is already in the repo |
| --- | --- |
| Vercel | `vercel.json` — Vite preset, `dist`, rewrite all paths to the shell |
| Netlify / Cloudflare Pages | `public/_redirects` (rewrite) + `public/_headers` (caching) |
| GitHub Pages | `scripts/postbuild.mjs` copies `index.html` → `dist/404.html` |
| Anything else | serve `dist/`; point misses at `index.html` if your host can |

Because Vite fingerprints every file in `assets/`, those are cached for a year as
immutable; `index.html` and `404.html` are always revalidated, so a deploy can't
strand an old shell.

```bash
# GitHub Pages, straight from your machine (works without any CI):
npm run build && npx gh-pages -d dist
```

This repository is deliberately boring to a bundler — no CDN links, no fetched
models, no `public/` art to lose — so those two config files are the whole story.

## Notes

- Settings, tournaments and results persist in `localStorage`.
- Render quality (`Low`–`Ultra`) toggles shadows, floor reflections, bloom, fog,
  resolution and prop density; bloom and soft shadows are wrapped in error
  boundaries so an unhappy GPU degrades the looks instead of the game.
- MIT licensed, no runtime dependencies on CDNs or model files.
