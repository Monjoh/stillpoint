import { i18n } from '#i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { NewTab } from './NewTab';

// index.html carries the English title for the moment before this runs; a static
// file cannot ask the browser which language to use.
document.title = i18n.t('newtab.pageTitle');

const container = document.getElementById('root');
if (!container) throw new Error('newtab: #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <NewTab />
  </StrictMode>,
);
