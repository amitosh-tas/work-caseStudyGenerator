import { useEffect, useRef, useState } from 'react';
import RichText from './RichText.jsx';
import { greetingText } from '../ai/prompt.js';

/**
 * ChatGPT-style conversation.
 * messages: [{ id, role: 'user'|'assistant'|'error', text, choices?, ready?, activity? }]
 */
export default function Chat({ messages, busy, liveActivity, onSend, onRetry, onPreview, onStop, hasKey, onOpenSettings, inputRef, userName }) {
  const [draft, setDraft] = useState('');
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

  const send = (text) => {
    const t = (text ?? draft).trim();
    if (!t || busy) return;
    onSend(t);
    setDraft('');
  };

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
                  <RichText text={m.greeting ? greetingText(userName) : m.text} />
                )}
                {m.ready && (
                  <div className="ready">
                    <div><strong>Your case study draft is ready</strong><span>Preview it, download it, or keep refining it here.</span></div>
                    <button type="button" className="b-green" onClick={onPreview}>Generate &amp; preview</button>
                  </div>
                )}
                {m === lastAssistant && !busy && m.choices?.length > 0 && (
                  <div className="choices">
                    {m.choices.map((c) => <button type="button" key={c} onClick={() => send(c)}>{c}</button>)}
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
        <div className="composer-box">
          <textarea
            ref={taRef}
            rows={1}
            value={draft}
            placeholder={hasKey ? 'Reply, paste a URL, or ask for a change…' : 'Add your API key in Settings to start'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            aria-label="Message"
          />
          {busy
            ? <button type="button" className="send" onClick={onStop} aria-label="Stop">■</button>
            : <button type="submit" className="send" disabled={!draft.trim() || !hasKey} aria-label="Send">↑</button>}
        </div>
        <p className="composer-note">The AI only saves facts you confirm. Check the draft before you publish it.</p>
      </form>
    </div>
  );
}
