import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './ui/styles.css';
import { primeAudio } from './state/sound';

// browsers gate audio behind a gesture — arm it on the first interaction
['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => primeAudio(), { once: true, passive: true }));

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
