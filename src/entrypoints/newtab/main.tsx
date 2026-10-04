import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { NewTab } from './NewTab';

const container = document.getElementById('root');
if (!container) throw new Error('newtab: #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <NewTab />
  </StrictMode>,
);
