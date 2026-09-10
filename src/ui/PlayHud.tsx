/**
 * In-game HUD: player cards with clocks, live status, evaluation, move list,
 * captured trays, action bar, promotion dialog and the game-over summary.
 */
import { useEffect, useState } from 'react';
import { useSession, undoBothSides } from '../state/session';
import { useSettings } from '../state/settings';
import { useGame } from '../hooks/useGame';
import { GLYPH, PIECE_NAMES, type Color, type PieceType } from '../game/types';
import { scoreToWinProb } from '../game/eval';
import { LEVEL_INFO } from './presets';
import { Btn, Chip, Modal, fmtClock, copyText, download, useNotice } from './kit';

function PlayerCard({
  color,
  name,
  tint,
  isBot,
  level,
  clockMs,
  running,
  captured,
  advantage,
  thinking,
  active,
}: {
  color: Color;
  name: string;
  tint?: string;
  isBot: boolean;
  level: number;
  clockMs: number;
  running: boolean;
  captured: PieceType[];
  advantage: number;
  thinking: boolean;
  active: boolean;
}) {
  const showClock = useSettings((s) => s.showClock);
  const low = running && clockMs < 30000;
  return (
    <div className="panel player-card" style={active ? { borderColor: 'color-mix(in srgb, var(--accent) 55%, transparent)' } : undefined}>
      <div className={`avatar ${color === 'b' ? 'dark' : ''}`} style={tint ? { background: color === 'b' ? tint : '#f4f1ea', borderColor: tint } : undefined}>
        {color === 'w' ? '♔' : '♚'}
      </div>
      <div className="grow">
        <div className="name">
          <span style={{ maxWidth: 128, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
          {isBot ? <Chip>{LEVEL_INFO[level]?.name ?? 'Bot'}</Chip> : <Chip tone="accent">you</Chip>}
          {thinking ? (
            <span className="thinking" title="searching">
              <i />
              <i />
              <i />
            </span>
          ) : null}
        </div>
        <div className="tray" title={captured.map((p) => PIECE_NAMES[p]).join(', ')}>
          {captured.map((p, i) => (
            <span key={i} style={{ opacity: 0.8 }}>
              {GLYPH[color === 'w' ? 'b' : 'w'][p]}
            </span>
          ))}
          {advantage > 0 ? <span className="adv">+{advantage.toFixed(1)}</span> : null}
        </div>
      </div>
      {showClock ? (
        <div className={`clock ${low ? 'low' : ''} ${running ? 'active' : ''}`}>{fmtClock(clockMs)}</div>
      ) : null}
    </div>
  );
}

function EvalBar({ cp }: { cp: number }) {
  const prob = scoreToWinProb(cp);
  const white = Math.round(prob * 100);
  return (
    <div className="panel" style={{ position: 'relative', padding: '10px 12px', display: 'grid', gap: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="tiny muted">Evaluation</span>
        <span className="mono tiny" style={{ color: cp > 30 ? 'var(--text)' : cp < -30 ? 'var(--subtle)' : 'var(--text)' }}>
          {cp > 0 ? '+' : ''}
          {(cp / 100).toFixed(2)}
        </span>
      </div>
      <div style={{ position: 'relative', height: 8, borderRadius: 6, background: 'color-mix(in srgb, var(--text) 14%, transparent)', overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: `${white}%`,
            background: 'linear-gradient(90deg, color-mix(in srgb, var(--accent) 60%, #fff), #fff)',
            transition: 'width .4s cubic-bezier(.2,.8,.2,1)',
          }}
        />
      </div>
      <div className="tiny muted">White {white}% · Black {100 - white}%</div>
    </div>
  );
}

export function PlayHud({ onOpenStudio }: { onOpenStudio: () => void }) {
  const session = useSession();
  const game = useGame(session.game);
  const showPly = useSession((st) => st.showPly);
  const clearPreview = useSession((st) => st.clearPreview);
  const previewPly = useSession((st) => st.previewPly);
  const autoFlip = useSettings((st) => st.autoFlip);
  const notice = useNotice();
  const [review, setReview] = useState(0);
  const showEval = useSettings((s) => s.showEvalBar);
  const [promoOpen, setPromoOpen] = useState(false);

  useEffect(() => {
    setPromoOpen(!!game?.promotion);
  }, [game?.promotion]);

  // flip to whoever is to move when the side to move is a human seat
  useEffect(() => {
    if (!game || !autoFlip || game.over) return;
    const humanIdx = game.seats.findIndex((x) => x.kind === 'human');
    if (humanIdx === -1) return;
    // hot-seat (two humans) follows the side to move; vs the engine stay on your own side
    const wants = game.seats.filter((x) => x.kind === 'human').length > 1 ? game.turn : humanIdx === 0 ? 'w' : 'b';
    if (game.orientation !== wants) {
      game.orientation = wants;
      game.emit();
    }
  }, [game, game?.turn, autoFlip]);

  if (!game) return null;

  const white = game.seatFor('w');
  const black = game.seatFor('b');
  const taken = game.capturedCounts();
  const balance = game.evalForWhite / 100;
  const moves = game.moveList();
  const cur = review === 0 ? moves.length : review;
  const plyOf = (i: number) => i * 2;

  const statusTone = game.over ? 'over' : game.chess.inCheck() ? 'check' : '';

  return (
    <>
      <div className="hud">
        <div className="hud-left">
          <PlayerCard
            color="b"
            name={black.name}
            tint={black.tint}
            isBot={black.kind === 'bot'}
            level={black.level}
            clockMs={game.clockRemaining[1]}
            running={game.clockRunning && game.turn === 'b' && !game.over}
            captured={taken.takenByBlack}
            advantage={balance < 0 ? -Math.round(balance * 10) / 10 : 0}
            thinking={game.thinking === 'b'}
            active={game.turn === 'b' && !game.over}
          />
          <PlayerCard
            color="w"
            name={white.name}
            tint={white.tint}
            isBot={white.kind === 'bot'}
            level={white.level}
            clockMs={game.clockRemaining[0]}
            running={game.clockRunning && game.turn === 'w' && !game.over}
            captured={taken.takenByWhite}
            advantage={balance > 0 ? Math.round(balance * 10) / 10 : 0}
            thinking={game.thinking === 'w'}
            active={game.turn === 'w' && !game.over}
          />
          <div className="row wrap">
            <span className={`status-pill ${statusTone}`}>
              <span className="dot" style={{ background: game.over ? 'var(--accent)' : game.chess.inCheck() ? 'var(--bad)' : 'var(--ok)' }} />
              {game.shortStatus()}
            </span>
            {game.engineInfo && game.engineInfo.depth > 0 ? (
              <Chip title={`${game.engineInfo.nodes} nodes searched`}>
                d{game.engineInfo.depth} · {(game.engineInfo.nodes / 1000).toFixed(0)}k n/s·{game.engineInfo.ms}ms
              </Chip>
            ) : null}
          </div>
          {showEval ? <EvalBar cp={game.evalForWhite} /> : null}
          <span className="grow" />
        </div>

        <div className="hud-bottom panel" style={{ background: 'var(--panel)' }}>
          {session.tournamentBoard ? (
            <Btn
              size="sm"
              variant="ghost"
              onClick={() => {
                session.detach();
                session.go('tournaments');
              }}
            >
              ← Tournament
            </Btn>
          ) : null}
          <Btn size="sm" variant="ghost" title="Flip the board (F)" onClick={() => game.toggleOrientation()}>
            ⇅ Flip
          </Btn>
          <Btn size="sm" variant="ghost" title="Undo (U)" disabled={!game.history.length} onClick={() => undoBothSides()}>
            ↺ Undo
          </Btn>
          <Btn
            size="sm"
            variant="ghost"
            title="Ask the engine for a suggestion (H)"
            disabled={!!game.over}
            onClick={() => {
              void game.requestHint(3);
              notice.show('Hint: the glowing squares');
            }}
          >
            ✦ Hint
          </Btn>
          <Btn size="sm" variant="ghost" title="Style studio (C)" onClick={onOpenStudio}>
            ✦ Style
          </Btn>
          {!game.over ? (
            <>
              <Btn size="sm" variant="ghost" title="Offer a draw" disabled={!game.history.length} onClick={() => game.agreeDraw()}>
                ½ Draw
              </Btn>
              <Btn size="sm" variant="ghost" title="Resign" onClick={() => game.resign(game.orientation)}>
                ⚑ Resign
              </Btn>
            </>
          ) : (
            <Btn size="sm" variant="primary" onClick={() => (session.tournamentBoard ? (session.detach(), session.go('tournaments')) : session.restart())}>
              {session.tournamentBoard ? 'Back to table' : 'Rematch'}
            </Btn>
          )}
          <Btn size="sm" variant="ghost" title="New game" onClick={() => session.startMatch()}>
            ⟳
          </Btn>
        </div>

        <div className="hud-right">
          <div className="panel fill" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {session.preview ? (
              <div className="row" style={{ padding: '8px 10px 0', gap: 6 }}>
                <Chip tone="accent">Reviewing ply {previewPly}</Chip>
                <span className="grow" />
                <Btn size="sm" variant="ghost" onClick={() => (setReview(0), clearPreview())}>
                  Live
                </Btn>
              </div>
            ) : null}
            <div className="row pad" style={{ paddingBottom: 6, alignItems: 'center' }}>
              <h3 style={{ fontSize: 14 }} className="grow">
                {session.tournamentBoard ? `Round ${session.tournamentBoard.round}` : 'Moves'}
              </h3>
              <Btn size="sm" variant="ghost" title="Copy PGN" onClick={async () => notice.show((await copyText(game.pgn())) ? 'PGN copied' : 'Copy blocked by browser')}>
                ⧉ PGN
              </Btn>
              <Btn size="sm" variant="ghost" title="Download PGN" onClick={() => (download('game.pgn', game.pgn({ Event: 'Chess3D game', Result: game.result }), 'application/x-chess-pgn'), notice.show('Saved game.pgn'))}>
                ↓
              </Btn>
            </div>
            <div className="moves scroll" style={{ flex: 1, minHeight: 120, maxHeight: '38vh' }}>
              {moves.length === 0 ? <div className="tiny muted pad">No moves yet — white opens.</div> : null}
              {moves.map((m, i) => (
                <div key={m.no} style={{ display: 'contents' }}>
                  <span className="no">{m.no}.</span>
                  <button
                    className={cur === i + 1 ? 'cur' : ''}
                    onClick={() => {
                      setReview(i + 1);
                      showPly(i * 2 + 1);
                    }}
                  >
                    {m.white.san}
                  </button>
                  {m.black ? (
                    <button
                      className={cur === i + 1 ? 'cur' : ''}
                      onClick={() => {
                        setReview(i + 1);
                        showPly(i * 2 + 2);
                      }}
                    >
                      {m.black.san}
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
            {moves.length > 0 ? (
              <div className="row" style={{ padding: '6px 10px 10px', gap: 4 }}>
                <Btn
                  size="sm"
                  variant="ghost"
                  title="Back to the live position"
                  onClick={() => {
                    setReview(0);
                    clearPreview();
                  }}
                >
                  ⏭
                </Btn>
                <Btn
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const next = Math.max(1, cur - 1);
                    setReview(next);
                    showPly(next * 2 - 1);
                  }}
                >
                  ◂
                </Btn>
                <Btn
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const next = Math.min(moves.length, cur + 1);
                    setReview(next);
                    showPly(next * 2);
                  }}
                >
                  ▸
                </Btn>
                <span className="tiny muted grow">
                  ply {Math.min(moves.length * 2, plyOf(cur) + 1)} / {moves.length * 2}
                </span>
              </div>
            ) : null}
          </div>
          <div className="panel pad" style={{ display: 'grid', gap: 6 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="tiny muted">Fen</span>
              <Btn size="sm" variant="ghost" onClick={async () => notice.show((await copyText(game.fen())) ? 'FEN copied' : 'Copy blocked')}>
                ⧉
              </Btn>
            </div>
            <div className="mono tiny" style={{ wordBreak: 'break-all', lineHeight: 1.35, opacity: 0.85 }}>
              {game.fen()}
            </div>
          </div>
        </div>
      </div>

      {promoOpen && game.promotion ? (
        <Modal title="Promote your pawn" onClose={() => game.cancelPromotion()}>
          <p className="tiny muted" style={{ marginTop: 0 }}>
            Choose the piece that replaces the pawn on {game.promotion.to}.
          </p>
          <div className="promo-row">
            {(['q', 'r', 'b', 'n'] as PieceType[]).map((t) => (
              <button key={t} onClick={() => game.choosePromotion(t)} title={PIECE_NAMES[t]}>
                {GLYPH[game.promotion!.color][t]}
              </button>
            ))}
          </div>
        </Modal>
      ) : null}

      {game.over && !session.tournamentBoard ? (
        <Modal title={game.over.reason} onClose={() => setReview(0)}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div className="row wrap" style={{ gap: 8 }}>
              <Chip tone="accent">Result {game.result}</Chip>
              <Chip>{game.history.length} plies</Chip>
              {game.chess.isCheckmate() ? <Chip>Checkmate</Chip> : null}
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>
              {game.over.status === 'checkmate'
                ? `${game.over.result === '1-0' ? white.name : black.name} wins by checkmate.`
                : game.over.status === 'resigned'
                  ? `${game.over.reason}. The position was left on the table.`
                  : `${game.over.reason}.`}
            </p>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <Btn variant="ghost" onClick={() => download('game.pgn', game.pgn({ Result: game.result }), 'application/x-chess-pgn')}>
                Save PGN
              </Btn>
              <Btn variant="primary" onClick={() => session.restart()}>
                Rematch
              </Btn>
            </div>
          </div>
        </Modal>
      ) : null}

      {notice.msg ? (
        <div className="panel notice" role="status">
          {notice.msg}
        </div>
      ) : null}
    </>
  );
}
