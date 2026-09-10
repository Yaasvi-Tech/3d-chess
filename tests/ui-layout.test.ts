/**
 * The DOM chrome sits on top of a full-screen <Canvas>, so which wrapper accepts
 * pointer events is functional, not cosmetic: an invisible layout box with
 * `pointer-events: auto` silently eats every click meant for the board.
 */
import { describe, expect, it } from 'vitest';
import sheet from '../src/ui/styles.css?raw';

/** comments would otherwise end up glued to the selector text */
const css = sheet.replace(/\/\*[\s\S]*?\*\//g, '');

/** every declaration a selector gets, including via grouped `.a, .b { }` rules */
const declarationsFor = (selector: string) => {
  let out = '';
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const list = (rule[1] ?? '')
      .split(',')
      .map((part: string) => part.trim().replace(/\s+/g, ' '));
    if (list.includes(selector)) out += rule[2];
  }
  return out;
};

const declares = (selector: string, value: string) => {
  const body = declarationsFor(selector);
  expect(body, `${selector} rule exists`).not.toBe('');
  expect(body, `${selector} should declare pointer-events: ${value}`).toContain(`pointer-events: ${value}`);
};

describe('click-through layering', () => {
  it('keeps full-area wrappers transparent to the pointer', () => {
    for (const wrapper of ['.chrome > *', '.center', '.home', '.hud', '.hud-left', '.hud-right', '.tourney']) {
      declares(wrapper, 'none');
    }
  });

  it('re-enables input on the panels that hold controls', () => {
    for (const panel of ['.topbar', '.home-card', '.hud > *', '.hud-left > *', '.hud-right > *', '.sheet', '.tourney .col']) {
      declares(panel, 'auto');
    }
  });

  it('does not size the home card against the viewport', () => {
    // 100vh made the card taller than the space left under the header, and grid
    // centring then pushed its top up over the top bar
    const card = declarationsFor('.home-card');
    expect(card).not.toMatch(/100vh/);
    expect(card).toMatch(/max-height:\s*100%/);
  });

  it('clips the chrome so nothing can paint above the header', () => {
    expect(declarationsFor('.chrome')).toMatch(/overflow:\s*hidden/);
    expect(declarationsFor('.app')).toMatch(/grid-template-rows:\s*1fr/);
  });
});
