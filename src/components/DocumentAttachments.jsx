import { useState } from 'react';
import { attachmentAccept, attachmentUrl, describeAttachment, MAX_ATTACHMENT_BYTES, readAttachment } from '../ai/attachments.js';
import { isImage } from '../caseStudyAttachments.js';

export default function DocumentAttachments({ files, onAdd, onChange }) {
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');

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
      <label>
        Add images, PDFs, audio, or video
        <input type="file" multiple accept={attachmentAccept('gemini')} onChange={upload} disabled={reading} />
      </label>
      {reading && <p role="status">Reading files…</p>}
      {error && <p role="alert">{error}</p>}
      {files.length > 0 && (
        <ul>
          {files.map((file) => (
            <li key={file.id}>
              {isImage(file) && <img src={attachmentUrl(file)} alt="" />}
              <a href={attachmentUrl(file)} download={file.name}>{file.name}</a>
              {isImage(file) && (
                <select aria-label={`Placement for ${file.name}`} value={file.placement} disabled={reading}
                  onChange={(event) => onChange(files.map((item) => item.id === file.id
                    ? { ...item, placement: event.target.value } : item))}>
                  <option value="appendix">Attachments section</option>
                  <option value="hero">Hero</option>
                </select>
              )}
              <button type="button" aria-label={`Remove ${file.name}`} disabled={reading}
                onClick={() => onChange(files.filter((item) => item.id !== file.id))}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
