import { i18n } from '#i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Options } from './Options';
import '@/core/theme/ui-tokens.css';
import './options.css';

// index.html carries the English title for the moment before this runs; a static
// file cannot ask the browser which language to use.
document.title = i18n.t('options.pageTitle');

const container = document.getElementById('root');
if (!container) throw new Error('options: #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <Options />
  </StrictMode>,
);
