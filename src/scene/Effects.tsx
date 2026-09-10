/**
 * Postprocessing. Kept behind a setting + error boundary: bloom is what sells the
 * emissive neon/obsidian styles, but a GPU/driver that dislikes the effect pass
 * should never take the game down with it.
 */
import { Component, memo, type ReactNode } from 'react';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { useSettings } from '../state/settings';

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

export const Effects = memo(function Effects() {
  const on = useSettings((s) => s.effects);
  const quality = useSettings((s) => s.quality);
  if (!on) return null;
  return (
    <Boundary>
      <EffectComposer key={`fx-${quality}`} multisampling={quality === 'ultra' ? 4 : 0} enableNormalPass={false}>
        <Bloom intensity={0.82} luminanceThreshold={0.55} luminanceSmoothing={0.34} mipmapBlur radius={0.74} />
        <Vignette offset={0.24} darkness={0.62} eskil={false} />
      </EffectComposer>
    </Boundary>
  );
});
