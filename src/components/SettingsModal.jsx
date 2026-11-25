import { useState } from 'react';
import { PROVIDERS, activeConfig } from '../ai/settings.js';
import { listModels, testConnection } from '../ai/providers.js';

export default function SettingsModal({ settings, onSave, onClose }) {
  const [s, setS] = useState(settings);
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState({ state: 'idle', text: '' });
  const [loaded, setLoaded] = useState({}); // provider → model ids
  const p = PROVIDERS[s.provider];
  const cfg = activeConfig(s);
  const suggestions = loaded[s.provider] || p.models;

  const setKey = (v) => setS({ ...s, keys: { ...s.keys, [s.provider]: v.trim() } });
  const setModel = (v) => setS({ ...s, models: { ...s.models, [s.provider]: v.trim() } });

  const loadModels = async () => {
    setMsg({ state: 'busy', text: 'Loading models…' });
    try {
      const ids = await listModels(cfg);
      setLoaded({ ...loaded, [s.provider]: ids });
      setMsg({ state: 'ok', text: ids.length ? `Found ${ids.length} models — pick one from the Model list.` : 'No models returned for this key.' });
    } catch (e) {
      setMsg({ state: 'err', text: e.message });
    }
  };

  const runTest = async () => {
    setMsg({ state: 'busy', text: 'Testing…' });
    try {
      await testConnection(cfg);
      setMsg({ state: 'ok', text: `Connected — ${p.name} with ${cfg.model} works.` });
    } catch (e) {
      setMsg({ state: 'err', text: e.message });
    }
  };

  const canUse = !!cfg.model && (cfg.keyOptional || !!cfg.apiKey) && (cfg.kind !== 'compat' || !!cfg.baseUrl);

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="set-title">
        <div className="modal-head">
          <h2 id="set-title">Settings</h2>
          <button type="button" className="icon" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <section className="set-group">
          <h3>You</h3>
          <label>What should the AI call you?
            <input value={s.userName} placeholder="Leave empty and it'll call you “storyteller”"
              onChange={(e) => setS({ ...s, userName: e.target.value })} maxLength={40} />
          </label>
        </section>

        <section className="set-group">
          <h3>AI model</h3>
          <label>Provider
            <select value={s.provider} onChange={(e) => { setS({ ...s, provider: e.target.value }); setMsg({ state: 'idle', text: '' }); }}>
              {Object.entries(PROVIDERS).map(([id, x]) => <option key={id} value={id}>{x.name}</option>)}
            </select>
          </label>

          {p.customBase && (
            <label>Base URL
              <input value={s.customBaseUrl} placeholder="https://your-provider.com/v1"
                onChange={(e) => setS({ ...s, customBaseUrl: e.target.value.trim() })} />
              <small>The address that ends in /v1 — e.g. http://localhost:11434/v1 for Ollama.</small>
            </label>
          )}

          <label>API key{p.keyOptional && <small> (optional for local models)</small>}
            <div className="key-row">
              <input type={show ? 'text' : 'password'} value={s.keys[s.provider] || ''} placeholder="Paste your API key" autoComplete="off"
                onChange={(e) => setKey(e.target.value)} />
              <button type="button" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
            </div>
            <small>{p.keyHint}. Each provider keeps its own key, stored only in this browser.</small>
          </label>

          <label>Model
            <div className="key-row">
              <input list="model-list" value={s.models[s.provider] ?? p.models[0] ?? ''} placeholder="Model name"
                onChange={(e) => setModel(e.target.value)} />
              <button type="button" onClick={loadModels} disabled={(!cfg.apiKey && !cfg.keyOptional) || msg.state === 'busy'}>Load my models</button>
            </div>
            <datalist id="model-list">{suggestions.map((m) => <option key={m} value={m} />)}</datalist>
            <small>Type a name, pick a suggestion, or load the exact list your key can use.</small>
          </label>

          <label className="check">
            <input type="checkbox" checked={s.web} onChange={(e) => setS({ ...s, web: e.target.checked })} />
            <span>Let the AI read websites <small>(it visits the client's site, picks up the basics and platform clues, then confirms them with you)</small></span>
          </label>
        </section>

        {msg.text && <p className={`test ${msg.state}`} role="status">{msg.text}</p>}

        <div className="modal-foot">
          <button type="button" onClick={runTest} disabled={!canUse || msg.state === 'busy'}>Test connection</button>
          <button type="button" className="b-green" onClick={() => { onSave(s); onClose(); }}>Save</button>
        </div>
      </div>
    </div>
  );
}
