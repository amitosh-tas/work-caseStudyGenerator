import { useEffect, useRef, useState } from 'react';
import RichText from './RichText.jsx';
import { greetingText } from '../ai/prompt.js';
import {
  acceptsAttachment, attachmentAccept, attachmentUrl, describeAttachment,
  MAX_ATTACHMENT_BYTES, MAX_FILES, readAttachment,
} from '../ai/attachments.js';

function AttachmentList({ files, onRemove, onAdd, included = [], disabled }) {
  return (
    <ul className="chat-attachments" aria-label="Attachments">
      {files.map((file, index) => {
        const saved = included.find((item) => item.id === file.id);
        const preview = saved || file;
        return (
        <li key={file.id || index}>
          {preview.data && preview.type.startsWith('image/') && <img src={attachmentUrl(preview)} alt="" />}
          <span title={file.name}>{file.name}{!preview.data && <small>File unavailable</small>}</span>
          {onRemove && (
            <button type="button" disabled={disabled} aria-label={`Remove ${file.name}`} onClick={() => onRemove(index)}>×</button>
          )}
          {onAdd && (saved
            ? <small>In case study</small>
            : file.data && <button type="button" onClick={() => onAdd(file)} aria-label={`Add ${file.name} to case study`}>Add to case study</button>)}
        </li>
        );
      })}
    </ul>
  );
}

/**
 * ChatGPT-style conversation.
 * messages: [{ id, role: 'user'|'assistant'|'error', text, choices?, ready?, activity? }]
 */
export default function Chat({ messages, busy, liveActivity, onSend, onRetry, onPreview, onStop, hasKey, onOpenSettings, inputRef, userName, providerKind, onAddAttachment, includedAttachments }) {
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [reading, setReading] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const pickerRef = useRef(null);
  const endRef = useRef(null);
  const localRef = useRef(null);
  const taRef = inputRef || localRef;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy, liveActivity]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [draft, taRef]);

  const canSend = hasKey && !busy && !reading && (draft.trim() || attachments.length > 0)
    && attachments.every((file) => acceptsAttachment(providerKind, file.type));
  const send = () => {
    if (!canSend) return;
    onSend(draft.trim(), attachments);
    setDraft('');
    setAttachments([]);
    setAttachmentError('');
  };

  const addFiles = async (event) => {
    const files = Array.from(event.target.files);
    event.target.value = '';
    if (!files.length || busy || reading) return;
    setAttachmentError('');
    setReading(true);
    try {
      if (files.length + attachments.length > MAX_FILES) throw new Error(`Attach up to ${MAX_FILES} files per message.`);
      const bytes = [...attachments, ...files].reduce((total, file) => total + file.size, 0);
      if (bytes > MAX_ATTACHMENT_BYTES) throw new Error('Attachments must total 6 MB or less per message.');
      const metadata = files.map((file) => describeAttachment(file, providerKind));
      const added = await Promise.all(files.map((file, index) => readAttachment(file, metadata[index])));
      setAttachments([...attachments, ...added]);
    } catch (error) {
      setAttachmentError(error.message);
    } finally {
      setReading(false);
    }
  };
  const incompatible = attachments.some((file) => !acceptsAttachment(providerKind, file.type));
  const formats = providerKind === 'gemini' ? 'images, PDFs, MP3, WAV, MP4, or WebM'
    : providerKind === 'compat' ? 'images' : 'images or PDFs';

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  return (
    <div className="chat">
      <div className="chat-scroll">
        <div className="chat-col">
          {!hasKey && (
            <div className="banner">
              <strong>Connect an AI model to start.</strong>
              <span>Pick a provider (Claude, OpenAI, Gemini and more), add your API key and choose a model in Settings.</span>
              <button type="button" className="b-green" onClick={onOpenSettings}>Open settings</button>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`msg ${m.role}`}>
              {m.role === 'assistant' && <div className="avatar" aria-hidden="true">AI</div>}
              <div className="bubble">
                {m.activity?.length > 0 && (
                  <div className="activity">{m.activity.map((a, i) => <span key={i}>{a}</span>)}</div>
                )}
                {m.role === 'error' ? (
                  <>
                    <p>{m.text}</p>
                    <div className="row-btns">
                      <button type="button" onClick={onRetry}>Try again</button>
                      <button type="button" onClick={onOpenSettings}>Settings</button>
                    </div>
                  </>
                ) : (
                  <>
                    {m.attachments?.length > 0 && <AttachmentList files={m.attachments} included={includedAttachments}
                      onAdd={(file) => {
                        try { onAddAttachment([file]); }
                        catch (error) { setAttachmentError(error.message); }
                      }} />}
                    <RichText text={m.greeting ? greetingText(userName) : m.text} />
                  </>
                )}
                {m.ready && (
                  <div className="ready">
                    <div><strong>Your case study draft is ready</strong><span>Preview it, download it, or keep refining it here.</span></div>
                    <button type="button" className="b-green" onClick={onPreview}>Generate &amp; preview</button>
                  </div>
                )}
                {m === lastAssistant && !busy && m.choices?.length > 0 && (
                  <div className="choices">
                    {m.choices.map((c) => (
                      <button type="button" key={c} disabled={!hasKey || reading}
                        onClick={() => {
                          if (attachments.length) {
                            setDraft(c);
                            taRef.current?.focus();
                          } else {
                            onSend(c);
                            setDraft('');
                          }
                        }}>{c}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="msg assistant">
              <div className="avatar" aria-hidden="true">AI</div>
              <div className="bubble thinking">
                <span className="dots" aria-hidden="true"><i /><i /><i /></span>
                <span>{liveActivity || 'Thinking…'}</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
        {attachments.length > 0 && (
          <AttachmentList files={attachments} disabled={reading}
            onRemove={(index) => {
              setAttachments(attachments.filter((_, i) => i !== index));
              setAttachmentError('');
            }} />
        )}
        {(attachmentError || incompatible) && (
          <p className="attachment-error" role="alert">{attachmentError || 'Remove the unsupported attachments or switch providers.'}</p>
        )}
        <div className="composer-box">
          <input ref={pickerRef} type="file" hidden multiple accept={attachmentAccept(providerKind)} onChange={addFiles} />
          <button type="button" className="attach" aria-label="Attach files" aria-describedby="attachment-help"
            title={`Attach ${formats}`} disabled={!hasKey || busy || reading} onClick={() => pickerRef.current?.click()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="m20 11-8.7 8.7a4.3 4.3 0 0 1-6.1-6.1l9-9a2.8 2.8 0 0 1 4 4l-9 9a1.4 1.4 0 0 1-2-2l8-8" strokeLinecap="round" />
            </svg>
          </button>
          <textarea
            ref={taRef}
            rows={1}
            value={draft}
            placeholder={hasKey ? 'Reply, paste a URL, or ask for a change…' : 'Add your API key in Settings to start'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
            aria-label="Message"
          />
          {busy
            ? <button type="button" className="send" onClick={onStop} aria-label="Stop">■</button>
            : <button type="submit" className="send" disabled={!canSend} aria-label="Send">↑</button>}
        </div>
        <p className="composer-note" id="attachment-help" role="status">
          {reading ? 'Reading files…' : `Attach ${formats}. Up to 4 files, 6 MB total. Files are sent to your selected model.`}
        </p>
        <p className="composer-note">The AI only saves facts you confirm. Check the draft before you publish it.</p>
      </form>
    </div>
  );
}
