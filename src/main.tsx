import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';
import { DsProvider } from './ds';
import { Root } from './Root';

// The design system enters HERE and nowhere else. Whatever a vendor's provider
// needs — a theme, a locale, a portal root — it gets inside `DsProvider`, so
// swapping the design system is one file rather than a search across `src/`.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DsProvider>
      <Root />
    </DsProvider>
  </StrictMode>,
);
