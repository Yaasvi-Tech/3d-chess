/** Landing screen: quick match setup, theme picker and the four pillars. */
import { getDemoGame, useSession } from '../state/session';
import { useGame } from '../hooks/useGame';
import { useSettings } from '../state/settings';
import { THEMES, TIME_CONTROLS, LOCATIONS, LEVELS_UI } from './presets';
import { Btn, Chip, Field, Seg } from './kit';
import { useTournaments } from '../tournament/store';

export function Home() {
  const match = useSession((s) => s.match);
  const configure = useSession((s) => s.configure);
  const startMatch = useSession((s) => s.startMatch);
  const go = useSession((s) => s.go);
  const themeId = useSettings((s) => s.themeId);
  const applyTheme = useSettings((s) => s.applyTheme);
  const locationId = useSettings((s) => s.location);
  const setSetting = useSettings((s) => s.set);
  const tourneys = useTournaments((s) => s.tournaments);
  const demo = useGame(getDemoGame());
  const createTournament = useTournaments((s) => s.createTournament);
  const setActive = useTournaments((s) => s.setActive);

  return (
    <div className="home">
      <div className="panel home-card">
        <div className="home-hero">
          <div className="row">
            <Chip tone="accent">
              <span className="dot" style={{ background: 'var(--ok)', color: 'var(--ok)' }} />
              {demo ? `${demo.seatFor('w').name} vs ${demo.seatFor('b').name} · ply ${demo.history.length}` : 'Attract mode'}
            </Chip>
            <span className="grow" />
            <span className="tiny muted">{LOCATIONS[locationId].place}</span>
          </div>
          <h1>
            Chess, staged in <em>worlds</em>.
          </h1>
          <p>
            A full 3D chess set you can restyle completely — nine curated themes, eight locations, eight board finishes and six piece
            sculpting styles — plus real tournaments with pairings, live boards and standings.
          </p>

          <div className="feature-grid">
            <button className="feature" style={{ cursor: 'pointer', textAlign: 'left' }} onClick={() => go('customize')}>
              <b>① Themes</b>
              <span>Nine curated looks — palette, light and mood in one click.</span>
            </button>
            <button className="feature" style={{ cursor: 'pointer', textAlign: 'left' }} onClick={() => go('customize')}>
              <b>② Locations</b>
              <span>Castle hall, lunar deck, sunset shore, neon arcade…</span>
            </button>
            <button className="feature" style={{ cursor: 'pointer', textAlign: 'left' }} onClick={() => go('customize')}>
              <b>③ Boards &amp; pieces</b>
              <span>Mix wood, jade, obsidian, glass with Staunton, crystal or mech sets.</span>
            </button>
            <button
              className="feature"
              style={{ cursor: 'pointer', textAlign: 'left' }}
              onClick={() => {
                go('tournaments');
                if (!tourneys.length) {
                  const id = createTournament({
                    name: 'Grand Hall Open',
                    format: 'round-robin',
                    players: [],
                    timeControl: 'rapid',
                    clockEnabled: false,
                  });
                  setActive(id);
                }
              }}
            >
              <b>④ Tournaments</b>
              <span>Round robin, Swiss and knockout with live boards and standings.</span>
            </button>
          </div>

          <div className="hr" />

          <div className="setup-grid">
            <Field label="Opponent">
              <Seg
                value={match.opponent}
                onChange={(v) => configure({ opponent: v })}
                options={[
                  { value: 'bot', label: 'Computer' },
                  { value: 'human', label: 'Two players' },
                ]}
              />
            </Field>
            <Field label="Your colour">
              <Seg
                value={match.playerColor}
                onChange={(v) => configure({ playerColor: v })}
                options={[
                  { value: 'w', label: 'White' },
                  { value: 'b', label: 'Black' },
                  { value: 'random', label: 'Random' },
                ]}
              />
            </Field>
            {match.opponent === 'bot' && (
              <Field label="Engine strength">
                <Seg size="sm" value={match.botLevel} onChange={(v) => configure({ botLevel: v })} options={LEVELS_UI} />
              </Field>
            )}
            <Field label="Time control">
              <Seg
                size="sm"
                value={match.timeControl}
                onChange={(v) => configure({ timeControl: v })}
                options={TIME_CONTROLS.map((t) => ({ value: t.id, label: t.name, title: t.label }))}
              />
            </Field>
          </div>

          <div className="home-actions">
            <Btn variant="primary" onClick={() => startMatch()}>
              ♟ Start game
            </Btn>
            <Btn
              onClick={() => {
                go('tournaments');
                if (!tourneys.length) {
                  const id = createTournament({ name: 'Grand Hall Open', format: 'round-robin', players: [], timeControl: 'rapid', clockEnabled: false });
                  setActive(id);
                }
              }}
            >
              🏆 Tournaments
            </Btn>
            <Btn variant="ghost" onClick={() => go('customize')}>
              ✦ Restyle
            </Btn>
          </div>
        </div>

        <div className="home-side">
          <div className="section-title">
            <h3>Theme</h3>
            <span>one click, whole look</span>
          </div>
          <div className="gallery">
            {THEMES.map((t) => (
              <button key={t.id} className="tile" aria-pressed={themeId === t.id} onClick={() => applyTheme(t.id)}>
                <div className="swatch" style={{ background: `linear-gradient(135deg, ${t.ui.bg}, ${t.accent})` }}>
                  <span style={{ color: t.accent }}>♞</span>
                  <span style={{ color: '#fff', opacity: 0.85 }}>♛</span>
                </div>
                <div className="meta">
                  <b>{t.name}</b>
                  <span>
                    {LOCATIONS[t.location].name} · {t.board}
                  </span>
                </div>
                <span className="tag">{t.tag}</span>
              </button>
            ))}
          </div>
          <div className="hr" />
          <div className="tiny muted" style={{ lineHeight: 1.5 }}>
            Tip — drag a piece or tap it to see legal moves. <span className="kbd">F</span> flips the board,{' '}
            <span className="kbd">U</span> undoes, <span className="kbd">H</span> asks for a hint.
          </div>
        </div>
      </div>
    </div>
  );
}
