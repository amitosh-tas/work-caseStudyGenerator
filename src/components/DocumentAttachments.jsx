import { useRef, useState } from 'react';
import { attachmentAccept, attachmentUrl, describeAttachment, MAX_ATTACHMENT_BYTES, readAttachment } from '../ai/attachments.js';
import { isImage } from '../caseStudyAttachments.js';

export default function DocumentAttachments({ files, onAdd, onChange }) {
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const picker = useRef(null);
  const update = (id, patch) => onChange(files.map((file) => file.id === id ? { ...file, ...patch } : file));

  const upload = async (event) => {
    const input = event.target;
    const selected = [...input.files];
    input.value = '';
    if (!selected.length) return;
    setError('');
    setReading(true);
    try {
      const metadata = selected.map((file) => {
        if (file.size > MAX_ATTACHMENT_BYTES) throw new Error(`${file.name} exceeds the 6 MB file limit.`);
        return describeAttachment(file, 'gemini');
      });
      if (selected.reduce((total, file) => total + file.size, 0) > MAX_ATTACHMENT_BYTES) {
        throw new Error('Select up to 6 MB of files at a time.');
      }
      const added = await Promise.all(selected.map((file, index) => readAttachment(file, metadata[index])));
      if (input.isConnected) onAdd(added);
    } catch (err) {
      setError(err.message);
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="document-attachments">
      <div className="document-upload">
        <input ref={picker} type="file" hidden multiple accept={attachmentAccept('gemini')} onChange={upload} disabled={reading} />
        <button type="button" disabled={reading} onClick={() => picker.current?.click()}>+ Add files</button>
        <small role="status">{reading ? 'Reading files…' : 'Images, PDFs, audio, and video'}</small>
      </div>
      {error && <p role="alert">{error}</p>}
      {files.length > 0 && (
        <ul>
          {files.map((file) => (
            <li key={file.id}>
              <div className="document-file">
                {isImage(file) && <img src={attachmentUrl(file)} alt="" />}
                <a href={attachmentUrl(file)} download={file.name} title={file.name}>{file.name}</a>
                <button type="button" aria-label={`Remove ${file.name}`} disabled={reading}
                  onClick={() => onChange(files.filter((item) => item.id !== file.id))}>Remove</button>
              </div>
              {isImage(file) && (
                <div className="image-layout">
                  <label>Placement
                    <select aria-label={`Placement for ${file.name}`} value={file.placement} disabled={reading}
                      onChange={(event) => update(file.id, { placement: event.target.value })}>
                      <option value="appendix">Attachments section</option>
                      <option value="hero">Hero</option>
                    </select>
                  </label>
                  <label>Layout
                    <select value={file.layout || 'pair'} aria-label={`Layout for ${file.name}`} disabled={reading}
                      onChange={(event) => update(file.id, { layout: event.target.value })}>
                      <option value="pair">Side by side</option>
                      <option value="full">Full width</option>
                      <option value="text">Image with text</option>
                    </select>
                  </label>
                  {file.layout === 'text' && (
                    <label className="image-layout-text">Text beside image
                      <textarea value={file.text || ''} onChange={(event) => update(file.id, { text: event.target.value })} />
                    </label>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
