import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Options } from './Options';
import '@/core/theme/ui-tokens.css';
import './options.css';

const container = document.getElementById('root');
if (!container) throw new Error('options: #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <Options />
  </StrictMode>,
);
