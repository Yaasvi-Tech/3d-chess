/**
 * Tournament centre: setup, live board table, standings with tiebreaks, results
 * and PGN export. Boards are real games — open one to take the seat, close it and
 * the engine resumes so the round keeps moving.
 */
import { useMemo, useState } from 'react';
import { BOT_POOL, defaultPlayers, useTournaments } from '../tournament/store';
import { computeStandings } from '../tournament/standings';
import type { GameEntry, Player, Tournament } from '../tournament/types';
import type { TournamentFormat } from '../tournament/types';
import { useGame } from '../hooks/useGame';
import { useSession } from '../state/session';
import { TIME_CONTROLS, LOCATIONS, BOARD_STYLES, PIECE_STYLES, locationOf, boardStyleOf, pieceStyleOf } from './presets';
import { LEVEL_INFO } from './presets';
import { useSettings } from '../state/settings';
import type { BoardStyleId, LocationId, PieceStyleId } from '../data/styles';
import { Btn, Chip, Field, Modal, Seg, Toggle, copyText, download, useNotice } from './kit';

const FORMATS: { value: TournamentFormat; label: string; hint: string }[] = [
  { value: 'round-robin', label: 'Round robin', hint: 'Everyone meets everyone' },
  { value: 'swiss', label: 'Swiss', hint: 'Paired on score, no rematches' },
  { value: 'knockout', label: 'Knockout', hint: 'Two games per match, winner advances' },
];

function GameCard({ t, game, onOpen }: { t: Tournament; game: GameEntry; onOpen: (g: GameEntry) => void }) {
  const runtime = useTournaments((s) => s.runtime);
  const ctrl = useGame(runtime[game.id] ?? null);
  const byId = useMemo(() => new Map(t.players.map((p) => [p.id, p])), [t.players]);
  const white = byId.get(game.whiteId);
  const black = byId.get(game.blackId);
  const live = ctrl && !ctrl.over;
  const last = ctrl?.history[ctrl.history.length - 1]?.san;
  const result = ctrl?.over ? ctrl.result : game.result;
  const status = game.status === 'bye' ? 'bye' : result && result !== '*' ? 'done' : live ? 'ongoing' : 'scheduled';
  const cp = ctrl ? ctrl.evalForWhite / 100 : 0;

  return (
    <button
      className={`gamecard ${status}`}
      onClick={() => game.status !== 'bye' && onOpen(game)}
      title={status === 'ongoing' ? 'Open this board' : 'Open & watch'}
    >
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="tiny muted">
          R{game.round}
          {t.format === 'knockout' ? ` · M${game.match + 1}` : ''}
        </span>
        {status === 'ongoing' ? (
          <span className="chip accent" style={{ padding: '1px 7px' }}>
            {ctrl?.history.length ?? 0} plies
          </span>
        ) : status === 'done' ? (
          <span className="mono tiny">{result}</span>
        ) : (
          <span className="tiny muted">queued</span>
        )}
      </div>
      {[
        { p: white, isWhite: true, r: result === '1-0' },
        { p: black, isWhite: false, r: result === '0-1' },
      ].map(({ p, isWhite, r }, i) => (
        <div className="side" key={i}>
          <span className="who">
            <span className={`mini ${isWhite ? 'w' : 'b'}`} />
            <span style={{ fontWeight: r ? 700 : 500 }}>{p?.name ?? '—'}</span>
            {p?.kind === 'human' ? <span className="chip" style={{ padding: '0 5px', fontSize: 9.5 }}>you</span> : null}
          </span>
          <span className="mono tiny muted">{p ? Math.round(p.rating) : ''}</span>
        </div>
      ))}
      {live ? (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="tiny muted">{last ? `last: ${last}` : 'awaiting first move'}</span>
          <span className="mono tiny" style={{ color: Math.abs(cp) > 0.8 ? 'var(--accent)' : undefined }}>
            {cp > 0 ? '+' : ''}
            {cp.toFixed(1)}
          </span>
        </div>
      ) : null}
    </button>
  );
}

function Standings({ t }: { t: Tournament }) {
  const rows = useMemo(() => computeStandings(t.players, t.games), [t.players, t.games]);
  const leader = rows[0]?.points;
  return (
    <div className="scroll" style={{ maxHeight: '100%' }}>
      <table className="standings">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th className="num">Pts</th>
            <th className="num">+−=</th>
            <th className="num">SB</th>
            <th className="num">TPR</th>
            <th>Form</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.player.id} className={r.player.kind === 'human' ? 'me' : ''}>
              <td>
                <span className={`rank ${r.rank === 1 && t.status === 'finished' ? 'gold' : r.rank === 2 && t.status === 'finished' ? 'silver' : r.rank === 3 && t.status === 'finished' ? 'bronze' : ''}`}>
                  {r.rank}
                </span>
              </td>
              <td>
                <div className="row" style={{ gap: 6 }}>
                  <span className="dot" style={{ background: r.player.tint, color: r.player.tint }} />
                  <span style={{ fontWeight: r.points === leader && leader ? 650 : 450 }}>{r.player.name}</span>
                  <span className="tiny muted">{r.player.country}</span>
                </div>
              </td>
              <td className="num">{r.points.toFixed(1)}</td>
              <td className="num tiny">
                {r.wins}·{r.losses}·{r.draws}
              </td>
              <td className="num tiny muted">{r.sb.toFixed(1)}</td>
              <td className="num tiny muted">{r.played ? r.tpr : '—'}</td>
              <td className="mono tiny" style={{ letterSpacing: 1.4 }}>
                {r.streak}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {t.games.length === 0 ? <div className="pad tiny muted">No games scored yet.</div> : null}
    </div>
  );
}

function PlayerEditor({ players, onChange }: { players: Player[]; onChange: (p: Player[]) => void }) {
  const [pick, setPick] = useState(BOT_POOL[0].key);
  const update = (i: number, patch: Partial<Player>) => onChange(players.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {players.map((p, i) => (
        <div className="player-row" key={p.id}>
          <input className="input" value={p.name} onChange={(e) => update(i, { name: e.target.value })} />
          <select
            className="input"
            value={p.kind === 'human' ? 'human' : p.level}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'human') update(i, { kind: 'human', level: 0, rating: 1500 });
              else update(i, { kind: 'bot', level: Number(v), rating: LEVEL_INFO[Number(v)]?.elo ?? p.rating });
            }}
          >
            <option value="human">Human</option>
            {LEVEL_INFO.map((l) => (
              <option key={l.key} value={l.key}>
                Bot · {l.name}
              </option>
            ))}
          </select>
          <input className="input mono" type="number" value={Math.round(p.rating)} onChange={(e) => update(i, { rating: Number(e.target.value) || 1200 })} title="Rating (seeds the bracket and feeds TPR)" />
          <Btn size="sm" variant="ghost" className="danger" onClick={() => onChange(players.filter((_, j) => j !== i))} title="Remove">
            ✕
          </Btn>
        </div>
      ))}
      <div className="row">
        <select className="input grow" value={pick} onChange={(e) => setPick(e.target.value)}>
          {BOT_POOL.map((b) => (
            <option key={b.key} value={b.key}>
              {b.name} · {b.country} · {b.rating}
            </option>
          ))}
        </select>
        <Btn
          size="sm"
          onClick={() => {
            const b = BOT_POOL.find((x) => x.key === pick)!;
            onChange([...players, { id: `p${Date.now().toString(36)}`, name: b.name, kind: 'bot', level: b.level, rating: b.rating, tint: b.tint, country: b.country }]);
          }}
        >
          + Add bot
        </Btn>
        <Btn
          size="sm"
          variant="ghost"
          onClick={() => onChange([...players, { id: `h${Date.now().toString(36)}`, name: 'Guest', kind: 'human', level: 0, rating: 1500, tint: '#ffd28a', country: '—' }])}
        >
          + Human
        </Btn>
      </div>
    </div>
  );
}

/** Stage dressing for the whole event — it writes through to the live settings. */
function VenuePicker({ t }: { t: Tournament }) {
  const patch = (p: Partial<Tournament>) =>
    useTournaments.setState((s) => ({ tournaments: s.tournaments.map((x) => (x.id === t.id ? { ...x, ...p } : x)) }));
  const setSetting = useSettings((s) => s.set);
  const pick = (key: 'location' | 'boardStyle' | 'pieceStyle', value: string, setting: 'location' | 'board' | 'pieces') => {
    patch({ [key]: value } as Partial<Tournament>);
    setSetting(setting, value as never);
  };
  return (
    <div style={{ display: 'grid', gap: 7 }}>
      <div className="row wrap" style={{ gap: 5 }}>
        <span className="tiny muted" style={{ width: 54 }}>
          Stage
        </span>
        {(Object.keys(LOCATIONS) as LocationId[]).map((id) => (
          <button
            key={id}
            className="chip"
            style={{ cursor: 'pointer', borderColor: t.location === id ? 'var(--accent)' : undefined }}
            onClick={() => pick('location', id, 'location')}
            title={locationOf(id).blurb}
          >
            {locationOf(id).name}
          </button>
        ))}
      </div>
      <div className="row wrap" style={{ gap: 5 }}>
        <span className="tiny muted" style={{ width: 54 }}>
          Board
        </span>
        {(Object.keys(BOARD_STYLES) as BoardStyleId[]).map((id) => (
          <button
            key={id}
            className="chip"
            style={{ cursor: 'pointer', borderColor: t.boardStyle === id ? 'var(--accent)' : undefined }}
            onClick={() => pick('boardStyle', id, 'board')}
          >
            {boardStyleOf(id).name}
          </button>
        ))}
      </div>
      <div className="row wrap" style={{ gap: 5 }}>
        <span className="tiny muted" style={{ width: 54 }}>
          Pieces
        </span>
        {(Object.keys(PIECE_STYLES) as PieceStyleId[]).map((id) => (
          <button
            key={id}
            className="chip"
            style={{ cursor: 'pointer', borderColor: t.pieceStyle === id ? 'var(--accent)' : undefined }}
            onClick={() => pick('pieceStyle', id, 'pieces')}
          >
            {pieceStyleOf(id).name}
          </button>
        ))}
      </div>
    </div>
  );
}

function Setup({ t, onDone }: { t: Tournament; onDone?: () => void }) {
  const upd = useTournaments((s) => s.setActive);
  void upd;
  const setSpeed = useTournaments((s) => s.setSpeed);
  const start = useTournaments((s) => s.start);
  const [tab, setTab] = useState<'players' | 'rules'>('players');

  const patchTournament = (patch: Partial<Tournament>) => {
    useTournaments.setState((s) => ({ tournaments: s.tournaments.map((x) => (x.id === t.id ? { ...x, ...patch } : x)) }));
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="row wrap">
        <input className="input grow" style={{ maxWidth: 320 }} value={t.name} onChange={(e) => patchTournament({ name: e.target.value })} />
        <Seg value={t.format} onChange={(v) => patchTournament({ format: v })} options={FORMATS.map((f) => ({ value: f.value, label: f.label, title: f.hint }))} />
      </div>
      {t.format === 'swiss' ? (
        <Field label="Rounds">
          <input
            className="input"
            style={{ width: 90 }}
            type="number"
            min={2}
            max={14}
            value={t.rounds}
            onChange={(e) => patchTournament({ rounds: Math.max(2, Math.min(14, Number(e.target.value) || 3)) })}
          />
        </Field>
      ) : (
        <div className="tiny muted">
          {t.format === 'round-robin'
            ? `${t.players.length - 1} rounds · ${Math.floor((t.players.length * (t.players.length - 1)) / 2)} games`
            : `${Math.ceil(Math.log2(Math.max(2, t.players.length)))} rounds · single elimination, 2 games per match`}
        </div>
      )}
      <div className="form-grid">
        <Field label="Time control">
          <Seg size="sm" value={t.timeControl} onChange={(v) => patchTournament({ timeControl: v })} options={TIME_CONTROLS.map((x) => ({ value: x.id, label: x.label }))} />
        </Field>
        <Field label="Autoplay speed">
          <Seg size="sm" value={t.speed} onChange={(v) => setSpeed(t.id, v)} options={[1, 2, 4, 8].map((v) => ({ value: v, label: `${v}×` }))} />
        </Field>
      </div>
      <div className="row wrap" style={{ gap: 16 }}>
        <Toggle label="Use clocks" checked={t.clockEnabled} onChange={(v) => patchTournament({ clockEnabled: v })} />
        <Toggle label="Auto-advance rounds" checked={t.autoAdvance} onChange={(v) => patchTournament({ autoAdvance: v })} />
      </div>
      <div className="tabs" style={{ padding: 0 }}>
        {(['players', 'rules'] as const).map((x) => (
          <button key={x} aria-selected={tab === x} onClick={() => setTab(x)}>
            {x === 'players' ? `Players (${t.players.length})` : 'Field & tiebreaks'}
          </button>
        ))}
      </div>
      {tab === 'players' ? (
        <PlayerEditor players={t.players} onChange={(players) => patchTournament({ players })} />
      ) : (
        <div className="tiny muted" style={{ lineHeight: 1.6 }}>
          Win = 1, draw = ½. Tiebreaks: Sonneborn-Berger, then number of wins, then tournament performance. Knockout matches are two
          games with colours swapped; a level tie is broken by the result with black, then by seeding. Round-robin byes score a full point.
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
        {t.players.length < 2 ? <span className="tiny muted" style={{ marginRight: 'auto' }}>Add at least two players.</span> : null}
        <Btn
          variant="primary"
          disabled={t.players.length < 2}
          onClick={() => {
            start(t.id);
            onDone?.();
          }}
        >
          ▶ Start tournament
        </Btn>
      </div>
    </div>
  );
}

function CreateTournament({ onClose }: { onClose: () => void }) {
  const create = useTournaments((s) => s.createTournament);
  const setActive = useTournaments((s) => s.setActive);
  const start = useTournaments((s) => s.start);
  const name = useSession((s) => s.match.playerName);
  const [players, setPlayers] = useState<Player[]>(() => defaultPlayers(name || 'You'));
  const [format, setFormat] = useState<TournamentFormat>('round-robin');
  const [title, setTitle] = useState('Grand Hall Open');
  const [timeControl, setTimeControl] = useState<(typeof TIME_CONTROLS)[number]['id']>('rapid');
  const [clock, setClock] = useState(false);

  return (
    <Modal wide title="New tournament" onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div className="row wrap">
          <input className="input grow" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tournament name" />
          <Seg value={format} onChange={setFormat} options={FORMATS.map((f) => ({ value: f.value, label: f.label, title: f.hint }))} />
        </div>
        <div className="form-grid">
          <Field label="Time control">
            <Seg size="sm" value={timeControl} onChange={setTimeControl} options={TIME_CONTROLS.map((x) => ({ value: x.id, label: x.label }))} />
          </Field>
          <Field label="Clocks">
            <Toggle label="Count down each move" checked={clock} onChange={setClock} />
          </Field>
        </div>
        <div className="section-title">
          <h3>Field</h3>
          <span>{players.length} players</span>
        </div>
        <PlayerEditor players={players} onChange={setPlayers} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Btn
            variant="primary"
            disabled={players.length < 2}
            onClick={() => {
              const id = create({ name: title, format, players, timeControl, clockEnabled: clock, autoAdvance: true, speed: 2 });
              setActive(id);
              start(id);
              onClose();
            }}
          >
            Create & start
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

export function TournamentsScreen() {
  const s = useTournaments();
  const [creating, setCreating] = useState(false);
  const notice = useNotice();
  const attach = useSession((st) => st.attach);
  const go = useSession((st) => st.go);
  const [tab, setTab] = useState<'boards' | 'standings' | 'results'>('boards');
  const t = s.tournaments.find((x) => x.id === s.activeId) ?? s.tournaments[0] ?? null;

  if (!t) {
    return (
      <div className="tourney">
        <div className="panel pad" style={{ alignSelf: 'center', maxWidth: 520, display: 'grid', gap: 12, justifyItems: 'start' }}>
          <h2 style={{ fontSize: 24 }}>Run a tournament</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>
            Field up bots of different strengths, invite a friend as a human seat, or play the whole event yourself. Boards run live on
            this 3D stage — open any board to take a seat, close it and the engine resumes.
          </p>
          <div className="row">
            <Btn variant="primary" onClick={() => setCreating(true)}>
              + New tournament
            </Btn>
            <Btn
              onClick={() => {
                const id = s.createTournament({ name: 'Quick Swiss', format: 'swiss', players: [], timeControl: 'blitz', clockEnabled: false });
                s.setActive(id);
                s.start(id);
              }}
            >
              Quick Swiss (8 bots)
            </Btn>
          </div>
        </div>
        <div className="col">
          <div className="panel pad">
            <div className="section-title">
              <h3>Saved events</h3>
            </div>
            {s.tournaments.length === 0 ? <div className="tiny muted">Nothing yet.</div> : null}
            {s.tournaments.map((x) => (
              <div className="row" key={x.id} style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                <span className="grow">{x.name}</span>
                <Chip>{x.format}</Chip>
                <Btn size="sm" variant="ghost" onClick={() => s.setActive(x.id)}>
                  Open
                </Btn>
              </div>
            ))}
          </div>
        </div>
        {creating ? <CreateTournament onClose={() => setCreating(false)} /> : null}
      </div>
    );
  }

  const roundGames = t.games.filter((g) => g.round === t.currentRound);
  const open = (g: GameEntry) => {
    const ctrl = s.openBoard(t.id, g.id);
    if (!ctrl) {
      notice.show('Start the tournament first');
      return;
    }
    attach(ctrl, { tournamentId: t.id, boardId: g.id, round: g.round });
    go('play');
  };

  return (
    <div className="tourney">
      <div className="col">
        <div className="panel pad" style={{ display: 'grid', gap: 10 }}>
          <div className="row wrap" style={{ alignItems: 'center' }}>
            <h2 className="grow" style={{ fontSize: 19 }}>
              {t.name}
            </h2>
            <Chip tone="accent">
              {t.status === 'running' ? `Round ${t.currentRound}/${t.rounds}` : t.status === 'finished' ? 'Finished' : 'Setup'}
            </Chip>
            <Chip>{t.players.length} players</Chip>
          </div>
          <div className="row wrap" style={{ gap: 6 }}>
            {t.status === 'setup' ? (
              <Btn variant="primary" size="sm" onClick={() => s.start(t.id)}>
                ▶ Start
              </Btn>
            ) : (
              <>
                <Btn size="sm" active={s.paused} onClick={() => s.setPaused(!s.paused)}>
                  {s.paused ? '▶ Resume' : '⏸ Pause'}
                </Btn>
                <Seg size="sm" value={t.speed} onChange={(v) => s.setSpeed(t.id, v)} options={[1, 2, 4, 8].map((v) => ({ value: v, label: `${v}×` }))} />
                <Btn size="sm" variant="ghost" onClick={() => s.fastForward(t.id)} title="Resolve every open board as fast as possible">
                  ⏩ Fast-forward
                </Btn>
                <Btn
                  size="sm"
                  variant="ghost"
                  disabled={t.currentRound >= t.rounds && t.status === 'finished'}
                  onClick={() => s.finishRound(t.id)}
                  title="Force the next round now"
                >
                  ⏭ Next round
                </Btn>
              </>
            )}
            <span className="grow" />
            <Btn size="sm" variant="ghost" onClick={() => setCreating(true)}>
              + New
            </Btn>
            <Btn
              size="sm"
              variant="ghost"
              onClick={async () => notice.show((await copyText(s.exportPgn(t.id))) ? 'All games copied' : 'Copy blocked')}
              title="Copy every game as PGN"
            >
              ⧉ PGN
            </Btn>
            <Btn size="sm" variant="ghost" onClick={() => (download(`${t.name.replace(/\W+/g, '-').toLowerCase()}.pgn`, s.exportPgn(t.id), 'application/x-chess-pgn'), notice.show('Exported'))}>
              ↓
            </Btn>
            <Btn size="sm" variant="ghost" onClick={() => s.abandon(t.id)} title="Clear all results">
              ⟲
            </Btn>
            <Btn size="sm" variant="ghost" className="danger" onClick={() => s.deleteTournament(t.id)}>
              🗑
            </Btn>
          </div>
          {t.status === 'finished' && t.winnerId ? (
            <div className="row" style={{ gap: 8 }}>
              <span className="dot" style={{ background: t.players.find((p) => p.id === t.winnerId)?.tint }} />
              <b>Winner: {t.players.find((p) => p.id === t.winnerId)?.name}</b>
            </div>
          ) : null}
          {t.status === 'setup' ? (
        <div className="panel pad" style={{ display: 'grid', gap: 10 }}>
          <div className="section-title">
            <h3>Venue</h3>
            <span>applies to every board in the event</span>
          </div>
          <VenuePicker t={t} />
        </div>
      ) : null}
      {t.status === 'setup' ? <Setup t={t} /> : null}
      {t.status !== 'setup' ? (
        <details className="panel pad">
          <summary className="tiny muted" style={{ cursor: 'pointer' }}>
            Venue &amp; styling for this event
          </summary>
          <div style={{ marginTop: 10 }}>
            <VenuePicker t={t} />
          </div>
        </details>
      ) : null}
        </div>

        <div className="panel fill" style={{ minHeight: 0 }}>
          <div className="row pad" style={{ paddingBottom: 8 }}>
            <h3 style={{ fontSize: 14 }} className="grow">
              Round {Math.max(1, t.currentRound)} boards
            </h3>
            <span className="tiny muted">{roundGames.filter((g) => g.status === 'ongoing').length} live</span>
          </div>
          <div className="boardgrid" style={{ flex: 1 }}>
            {(tab === 'boards' ? roundGames : t.games).map((g) => (
              <GameCard key={g.id} t={t} game={g} onOpen={open} />
            ))}
            {(tab === 'boards' ? roundGames : t.games).length === 0 ? <div className="tiny muted pad">No boards yet.</div> : null}
          </div>
          <div className="tabs">
            {(['boards', 'standings', 'results'] as const).map((x) => (
              <button key={x} aria-selected={tab === x} onClick={() => setTab(x)}>
                {x === 'boards' ? 'Live boards' : x === 'standings' ? 'Standings' : 'All results'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="col">
        <div className="panel fill">
          {tab === 'standings' ? (
            <Standings t={t} />
          ) : tab === 'results' ? (
            <div className="pad scroll" style={{ maxHeight: '100%' }}>
              {[...new Set(t.games.map((g) => g.round))].sort((a, b) => a - b).map((r) => (
                <div key={r} style={{ marginBottom: 12 }}>
                  <div className="tiny muted" style={{ marginBottom: 4 }}>
                    Round {r}
                  </div>
                  <div className="results-list">
                    {t.games
                      .filter((g) => g.round === r)
                      .map((g) => (
                        <div className="row" key={g.id} style={{ justifyContent: 'space-between' }}>
                          <span>
                            {t.players.find((p) => p.id === g.whiteId)?.name} — {t.players.find((p) => p.id === g.blackId)?.name}
                          </span>
                          <span className="mono">{g.result ?? '*'}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
              {t.games.length === 0 ? <div className="tiny muted">No games played.</div> : null}
            </div>
          ) : (
            <Standings t={t} />
          )}
        </div>
      </div>
      {creating ? <CreateTournament onClose={() => setCreating(false)} /> : null}
    </div>
  );
}
