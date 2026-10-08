/**
 * Application entry point.
 *
 * Mounts immediately so the loading state renders while the Firebase SDK and the
 * main route chunk download, rather than showing a blank page.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root is missing from index.html.');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);