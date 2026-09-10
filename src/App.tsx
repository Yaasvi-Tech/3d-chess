/**
 * App shell: one persistent 3D stage with the screens floating over it.
 */
import { Component, useEffect, useState, type ReactNode } from 'react';
import { Scene } from './scene/Scene';
import { Home } from './ui/Home';
import { PlayHud } from './ui/PlayHud';
import { CustomizeSheet } from './ui/Customize';
import { TournamentsScreen } from './ui/Tournaments';
import { Btn } from './ui/kit';
import { applyUiTheme, useSettings } from './state/settings';
import { useSession } from './state/session';
import { locationOf } from './data/styles';

class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    if (this.state.failed) {
      return (
        <div className="load-veil">
          <div>
            <div className="spinner" />
          </div>
          <div style={{ textAlign: 'center', maxWidth: 420, lineHeight: 1.5, fontSize: 13 }}>
            WebGL could not start on this device. Chess3D needs hardware 3D — try another browser or enable WebGL, then reload.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const screen = useSession((s) => s.screen);
  const go = useSession((s) => s.go);
  const game = useSession((s) => s.game);
  const ui = useSettings((s) => s.ui);
  const accent = useSettings((s) => s.accent);
  const locationId = useSettings((s) => s.location);
  const [studio, setStudio] = useState(false);
  const showStudio = studio || screen === 'customize';

  useEffect(() => {
    applyUiTheme(ui, accent);
  }, [ui, accent]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        setStudio(false);
        return;
      }
      if (k === 'c') setStudio((v) => !v);
      if (!game && (k === 'f' || k === 'u' || k === 'h')) return;
      if (k === 'f') game?.toggleOrientation();
      if (k === 'u') {
        game?.undoPly(1);
      }
      if (k === 'h') void game?.requestHint(3);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game]);

  return (
    <div className="app">
      <div className="stage">
        <StageBoundary>
          <Scene />
        </StageBoundary>
      </div>
      <div className="chrome">
        <div className="topbar">
          <div className="brand">
            <span className="mark">♞</span>
            <span>
              Chess3D
              <small>{locationOf(locationId).name}</small>
            </span>
          </div>
          <nav className="nav">
            <Btn variant="ghost" size="sm" active={screen === 'home'} onClick={() => go('home')}>
              Home
            </Btn>
            <Btn variant="ghost" size="sm" active={screen === 'play'} onClick={() => (game ? go('play') : useSession.getState().startMatch())}>
              Play
            </Btn>
            <Btn variant="ghost" size="sm" active={showStudio} onClick={() => setStudio((v) => !v)}>
              Style
            </Btn>
            <Btn variant="ghost" size="sm" active={screen === 'tournaments'} onClick={() => go('tournaments')}>
              Tournaments
            </Btn>
          </nav>
        </div>

        <div className="center">
          {screen === 'home' ? <Home /> : null}
          {screen === 'play' ? <PlayHud onOpenStudio={() => setStudio(true)} /> : null}
          {screen === 'tournaments' ? <TournamentsScreen /> : null}
          {showStudio ? (
            <CustomizeSheet
              onClose={() => {
                setStudio(false);
                if (screen === 'customize') go('home');
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
