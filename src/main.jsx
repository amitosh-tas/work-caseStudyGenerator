import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { loadDraftAttachments } from './caseStudyAttachments.js';
import './styles.css';

function render(storage) {
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App attachmentStorage={storage} />
    </React.StrictMode>
  );
}

loadDraftAttachments().then((files) => render({ files }), () => render({ failed: true }));
