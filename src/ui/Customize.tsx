/**
 * The style sheet: every look-and-feel axis in one panel — theme presets,
 * locations, board finishes, piece sculpting styles, palette and render quality.
 * Changes apply to the live 3D stage immediately.
 */
import { BOARD_STYLES, LOCATIONS, PIECE_STYLES, CAMERA_VIEWS } from './presets';
import { THEMES } from '../data/styles';
import { useSettings, type Quality } from '../state/settings';
import { Btn, ColorRow, Field, Seg, SectionTitle, Slider, Toggle } from './kit';
import { ACCENT_SWATCHES } from './presets';
import type { BoardStyleId, LocationId, PieceStyleId } from '../data/styles';

function BoardSwatch({ id }: { id: BoardStyleId }) {
  const s = BOARD_STYLES[id];
  return (
    <div
      className="swatch"
      style={{
        background: `linear-gradient(135deg, ${s.light} 0 50%, ${s.dark} 50% 100%)`,
        boxShadow: `inset 0 0 0 3px ${s.frame}, inset 0 0 0 4px ${s.frameAccent}`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 10,
          backgroundImage: `linear-gradient(45deg, ${s.dark} 25%, transparent 25%, transparent 75%, ${s.dark} 75%), linear-gradient(45deg, ${s.light} 25%, transparent 25%, transparent 75%, ${s.light} 75%)`,
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 8px 8px',
          opacity: 0.92,
        }}
      />
      {s.emissive > 0.2 && (
        <div style={{ position: 'absolute', inset: 0, boxShadow: `inset 0 0 22px ${s.emissiveColor}`, opacity: 0.8 }} />
      )}
    </div>
  );
}

function PieceSwatch({ id }: { id: PieceStyleId }) {
  const s = PIECE_STYLES[id];
  const glyph = id === 'crystal' || id === 'cyber' ? '▲' : id === 'neo' ? '▮' : '♞';
  return (
    <div className="swatch" style={{ background: 'linear-gradient(160deg,#2a2f3a,#0e1116)', gap: 10 }}>
      <span style={{ color: s.colors.light, textShadow: s.emissive ? `0 0 12px ${s.colors.lightAccent}` : 'none' }}>{glyph}</span>
      <span style={{ color: s.colors.dark, textShadow: s.emissive ? `0 0 12px ${s.colors.darkAccent}` : '0 0 6px rgba(0,0,0,.8)' }}>{glyph}</span>
      <span
        style={{
          position: 'absolute',
          bottom: 6,
          right: 7,
          width: 8,
          height: 8,
          borderRadius: 2,
          background: s.emissive ? s.colors.darkAccent : s.colors.lightAccent,
          boxShadow: s.emissive ? `0 0 10px ${s.colors.darkAccent}` : 'none',
        }}
      />
    </div>
  );
}

function LocationSwatch({ id }: { id: LocationId }) {
  const l = LOCATIONS[id];
  const [top, mid, bot] = l.sky;
  return (
    <div className="swatch" style={{ background: `linear-gradient(180deg, ${top} 0%, ${mid} 58%, ${bot} 100%)` }}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 22, background: l.ground.color, opacity: 0.9 }} />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 16,
          transform: 'translateX(-50%)',
          width: 42,
          height: 12,
          borderRadius: 2,
          background: l.table.color,
          boxShadow: `0 0 14px ${l.rim[0]?.color ?? '#fff'}`,
        }}
      />
      {l.sun && <div style={{ position: 'absolute', top: 8, right: 10, width: 12, height: 12, borderRadius: '50%', background: l.sun.color, boxShadow: `0 0 18px ${l.sun.color}` }} />}
    </div>
  );
}

export function CustomizeSheet({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  const set = s.set;

  return (
    <div className="panel sheet">
      <header>
        <h3 style={{ fontSize: 17 }} className="grow">
          Style studio
        </h3>
        <Btn size="sm" variant="ghost" onClick={s.randomize} title="Surprise me">
          ⤨ Random
        </Btn>
        <Btn size="sm" variant="ghost" onClick={s.resetStyles} title="Back to the theme defaults">
          Reset
        </Btn>
        <Btn size="sm" onClick={onClose}>
          Done
        </Btn>
      </header>

      <div className="body scroll">
        <section>
          <SectionTitle title="Themes" hint="preset: place + board + pieces + palette" />
          <div className="gallery">
            {THEMES.map((t) => (
              <button key={t.id} className="tile" aria-pressed={s.themeId === t.id} onClick={() => s.applyTheme(t.id)} title={t.blurb}>
                <div className="swatch" style={{ background: `linear-gradient(135deg, ${t.ui.bg}, ${t.accent})`, height: 50 }}>
                  <span style={{ color: t.accent }}>♜</span>
                  <span style={{ color: '#fff', opacity: 0.8 }}>♚</span>
                </div>
                <div className="meta">
                  <b>{t.name}</b>
                  <span>{LOCATIONS[t.location].name}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle title="Location" hint="the world around the board" />
          <div className="gallery">
            {(Object.keys(LOCATIONS) as LocationId[]).map((id) => (
              <button key={id} className="tile" aria-pressed={s.location === id} onClick={() => set('location', id)} title={LOCATIONS[id].blurb}>
                <LocationSwatch id={id} />
                <div className="meta">
                  <b>{LOCATIONS[id].name}</b>
                  <span>{LOCATIONS[id].place}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle title="Board" hint="surface, rim and inlay" />
          <div className="gallery">
            {(Object.keys(BOARD_STYLES) as BoardStyleId[]).map((id) => (
              <button key={id} className="tile" aria-pressed={s.board === id} onClick={() => set('board', id)} title={BOARD_STYLES[id].blurb}>
                <BoardSwatch id={id} />
                <div className="meta">
                  <b>{BOARD_STYLES[id].name}</b>
                  <span>{BOARD_STYLES[id].coords ? 'inlaid coordinates' : 'clean rim'}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle title="Pieces" hint="silhouette and material" />
          <div className="gallery">
            {(Object.keys(PIECE_STYLES) as PieceStyleId[]).map((id) => (
              <button key={id} className="tile" aria-pressed={s.pieces === id} onClick={() => set('pieces', id)} title={PIECE_STYLES[id].blurb}>
                <PieceSwatch id={id} />
                <div className="meta">
                  <b>{PIECE_STYLES[id].name}</b>
                  <span>{PIECE_STYLES[id].blurb}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle title="Palette & mood" />
          <div className="form-grid">
            <Field label="Accent">
              <ColorRow value={s.accent} colors={ACCENT_SWATCHES} onChange={(v) => set('accent', v)} />
            </Field>
            <Field label="Piece tint">
              <ColorRow value={s.pieceTint} colors={['#ffffff', '#fff2dc', '#e4f0ff', '#ffe1e1', '#e7ffe9', '#f3e6ff']} onChange={(v) => set('pieceTint', v)} />
            </Field>
            <Field label="Board tint">
              <ColorRow value={s.boardTint} colors={['#ffffff', '#fff4e2', '#e9f2ff', '#fff0f0', '#eefbf0']} onChange={(v) => set('boardTint', v)} />
            </Field>
            <Field label="Exposure">
              <Slider value={Number(s.exposure.toFixed(2))} min={0.6} max={1.6} step={0.02} onChange={(v) => set('exposure', v)} />
            </Field>
            <Field label="Piece glow" hint="emissive trim on neon / crystal sets">
              <Slider value={Number(s.pieceGlow.toFixed(2))} min={0} max={3} step={0.1} onChange={(v) => set('pieceGlow', v)} />
            </Field>
          </div>
        </section>

        <section>
          <SectionTitle title="Camera" hint="drag the board to look around" />
          <Seg value={s.cameraView} onChange={(v) => set('cameraView', v)} options={CAMERA_VIEWS.map((v) => ({ value: v.id, label: v.name }))} />
          <div className="hr" />
          <Field label="Table height feel">
            <Slider value={Number(s.boardTilt.toFixed(2))} min={-0.35} max={0.35} step={0.01} onChange={(v) => set('boardTilt', v)} />
          </Field>
        </section>

        <section>
          <SectionTitle title="Board & interface" />
          <div style={{ display: 'grid', gap: 9 }}>
            <Toggle label="Coordinates on the rim" checked={s.showCoords} onChange={(v) => set('showCoords', v)} />
            <Toggle label="Show legal moves" checked={s.showLegalMoves} onChange={(v) => set('showLegalMoves', v)} />
            <Toggle label="Move animations" checked={s.animateMoves} onChange={(v) => set('animateMoves', v)} />
            <Toggle label="Flip board to the side to move" checked={s.autoFlip} onChange={(v) => set('autoFlip', v)} />
            <Toggle label="Evaluation bar" checked={s.showEvalBar} onChange={(v) => set('showEvalBar', v)} />
            <Toggle label="Sound" checked={s.sound} onChange={(v) => set('sound', v)} />
          </div>
        </section>

        <section>
          <SectionTitle title="Render quality" hint="drop this if the frame rate hurts" />
          <Seg
            value={s.quality}
            onChange={(v) => set('quality', v as Quality)}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'ultra', label: 'Ultra' },
            ]}
          />
          <div className="hr" />
          <div style={{ display: 'grid', gap: 9 }}>
            <Toggle label="Shadows" checked={s.shadows} onChange={(v) => set('shadows', v)} />
            <Toggle label="Floor reflections" checked={s.reflections} onChange={(v) => set('reflections', v)} />
            <Toggle label="Bloom & vignette" checked={s.effects} onChange={(v) => set('effects', v)} />
            <Toggle label="Atmospheric fog" checked={s.fog} onChange={(v) => set('fog', v)} />
          </div>
        </section>
      </div>
    </div>
  );
}
