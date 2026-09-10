/**
 * Deployment contract. The app is one static bundle, so the only things a host
 * can realistically get wrong are relative asset URLs and rewriting unknown
 * paths to the shell — these assertions pin the config that fixes both.
 */
import { describe, expect, it } from 'vitest';
import viteConfig from '../vite.config.ts?raw';
import pkg from '../package.json';
import vercel from '../vercel.json';
import redirects from '../public/_redirects?raw';
import headers from '../public/_headers?raw';
import postBuild from '../scripts/postbuild.mjs?raw';

describe('static deploy config', () => {
  it('emits relative asset URLs so dist/ works at a root or a sub-path', () => {
    expect(viteConfig).toMatch(/base:\s*'\.\/'/);
  });

  it('builds through the post-build step that duplicates the shell', () => {
    expect(String(pkg.scripts.build)).toContain('scripts/postbuild.mjs');
    expect(postBuild).toContain('404.html');
  });

  it('rewrites unknown paths to the app shell on every supported host', () => {
    // Netlify / Cloudflare Pages
    expect(redirects).toMatch(/^\s*\/\*\s+\/index\.html\s+200\s*$/m);
    // Vercel
    expect(vercel.rewrites?.[0]?.destination).toBe('/index.html');
    // GitHub Pages has no rewrite engine — dist/404.html is the fallback
    expect(String(pkg.scripts.build)).toContain('postbuild');
  });

  it('caches hashed assets hard but keeps the shell revalidated', () => {
    expect(headers).toMatch(/\/assets\/\*[\s\S]*immutable/);
    expect(headers).toMatch(/\/index\.html[\s\S]*must-revalidate/);
  });
});
