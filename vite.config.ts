import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app is a fully self-contained Vite + React + three.js project:
// every model, texture and material is generated procedurally at runtime,
// so there are no binary assets to fetch and the preview works offline.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': new URL('./src/', import.meta.url).pathname,
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // Arena previews proxy the dev server through a *.e2b.app host.
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 2600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          chess: ['chess.js'],
        },
      },
    },
  },
});
