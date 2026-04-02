import { StrictMode } from 'react';
import { RiverScope, loggerObserver } from 'react-river';

import { createRoot } from 'react-dom/client';

import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RiverScope observers={[loggerObserver()]}>
      <App />
    </RiverScope>
  </StrictMode>,
);
