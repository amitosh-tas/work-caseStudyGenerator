import { useEffect } from 'react';
import Preview from './Preview.jsx';

export default function PreviewModal({ data, pdfMode, setPdfMode, busy, onPdf, onHtml, onClose, onAskChanges, onEditForm }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  return (
    <div className="full" role="dialog" aria-modal="true" aria-label="Case study preview">
      <div className="full-bar">
        <button type="button" onClick={onClose}>← Back</button>
        <div className="full-acts">
          <button type="button" onClick={onAskChanges}>Ask AI for changes</button>
          <button type="button" onClick={onEditForm}>Edit in form</button>
          <select value={pdfMode} onChange={(e) => setPdfMode(e.target.value)} aria-label="PDF layout">
            <option value="long">PDF: one long page</option>
            <option value="a4">PDF: A4 pages</option>
          </select>
          <button type="button" className="b-green" onClick={onPdf} disabled={busy}>{busy ? 'Building PDF…' : 'Download PDF'}</button>
          <button type="button" className="b-dark" onClick={onHtml}>Download web page</button>
        </div>
      </div>
      <div className="full-body">
        <div className="full-page"><Preview data={data} /></div>
      </div>
    </div>
  );
}
