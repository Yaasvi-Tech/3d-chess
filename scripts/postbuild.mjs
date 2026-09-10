/**
 * GitHub Pages (and any host that cannot rewrite URLs) can only answer a miss
 * with a real `404.html`, so the built shell is duplicated next to index.html.
 *
 * Netlify and Cloudflare Pages read `public/_redirects` instead, Vercel reads
 * `vercel.json` — with `base: './'` in vite.config.ts all three end up serving
 * the same relative-addressed shell.
 */
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const index = join(dist, 'index.html');

if (!existsSync(index)) {
  console.error('postbuild: dist/index.html is missing — run `vite build` first');
  process.exit(1);
}

copyFileSync(index, join(dist, '404.html'));
console.log('postbuild: wrote dist/404.html (GitHub Pages fallback)');
