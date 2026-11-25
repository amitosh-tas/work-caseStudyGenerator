import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SECTIONS, SAMPLE, emptyData, normalize, sectionOrder } from './schema.js';
import SectionForm from './components/SectionForm.jsx';
import Preview from './components/Preview.jsx';
import Chat from './components/Chat.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import PreviewModal from './components/PreviewModal.jsx';
import { downloadBrief, downloadHtml, downloadPdf } from './exporters.js';
import { loadSettings, saveSettings, activeConfig, isReady } from './ai/settings.js';
import { buildSystemPrompt, parseAssistantText, greetingText } from './ai/prompt.js';
import { runTurn } from './ai/providers.js';
import { ATTACHMENT_PROMPT, MAX_HISTORY_BYTES } from './ai/attachments.js';
import { includeAttachments, normalizeAttachments, saveDraftAttachments } from './caseStudyAttachments.js';
import { applyPatch, sectionProgress } from './ai/tools.js';

const STORE_KEY = 'case-study-builder:draft';
const CHAT_KEY = 'case-study-builder:chat';
const BRAND_KEYS = ['agency', 'author', 'tagline', 'link', 'pageUrl', 'green', 'navy', 'mint', 'photo'];
const uid = () => Math.random().toString(36).slice(2);
const attachmentMetadata = ({ id, name, type, size }) => ({ id, name, type, size });

function loadDraft(files) {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const data = normalize(JSON.parse(raw));
      if (files) data.attachments = normalizeAttachments(files);
      return { data, isSample: false };
    }
  } catch { /* ignore */ }
  return files?.length
    ? { data: emptyData({ attachments: normalizeAttachments(files) }), isSample: false }
    : { data: SAMPLE, isSample: true };
}
function loadChat() {
  try { const m = JSON.parse(localStorage.getItem(CHAT_KEY) || 'null'); if (Array.isArray(m)) return m; } catch { /* ignore */ }
  return null;
}
const greeting = () => ({
  id: uid(),
  role: 'assistant',
  greeting: true, // text is rendered from the current name setting
  text: greetingText(''),
  choices: ['The client has no website', 'Keep the client anonymous'],
});

// map changed keys → section names, for the "Updated draft" note
const KEY_TO_SECTION = {};
KEY_TO_SECTION.attachments = 'Attachments';
SECTIONS.forEach((s) => {
  s.fields.forEach((f) => (KEY_TO_SECTION[f.k] = s.name));
  (s.lists || []).forEach((l) => (KEY_TO_SECTION[l.id] = s.name));
});

export default function App({ attachmentStorage = {} }) {
  const [{ data, isSample }, setState] = useState(() => loadDraft(attachmentStorage.files));
  const [mode, setMode] = useState('chat');
  const [messages, setMessages] = useState(() => loadChat() || [greeting()]);
  const [busy, setBusy] = useState(false);
  const [liveActivity, setLiveActivity] = useState('');
  const [settings, setSettings] = useState(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [pdfMode, setPdfMode] = useState('long');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [status, setStatus] = useState(attachmentStorage.failed ? 'Could not load saved case study attachments.' : '');
  const [active, setActive] = useState(SECTIONS[0].id);
  const [view, setView] = useState('edit');
  const sections = sectionOrder(data.sectionOrder).map((id) => SECTIONS.find((section) => section.id === id));
  const fileRef = useRef(null);
  const chatInputRef = useRef(null);
  const sectionPositions = useRef(null);
  const abortRef = useRef(null);
  const dataRef = useRef(data);
  const savedAttachments = useRef(data.attachments);
  dataRef.current = data;

  const setData = (fn, sample = false) => setState((s) => ({ data: typeof fn === 'function' ? fn(s.data) : fn, isSample: sample }));
  const setField = (k, v) => setData((d) => ({ ...d, [k]: v }));
  const setList = (id, items) => setData((d) => ({ ...d, [id]: items }));
  const keepBrand = (d) => emptyData(Object.fromEntries(BRAND_KEYS.map((k) => [k, d[k]])));
  const addToDocument = (files, placement) => {
    const current = isSample ? emptyData() : dataRef.current;
    const attachments = includeAttachments(current.attachments, files, placement);
    dataRef.current = { ...current, attachments };
    setData(dataRef.current);
    setStatus(`Added ${files.length === 1 ? files[0].name : files.length + ' files'} to the case study.`);
  };

  // autosave draft + chat
  useEffect(() => {
    const { attachments, ...draft } = data;
    const t = setTimeout(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(draft)); } catch { /* ignore */ } }, 300);
    return () => clearTimeout(t);
  }, [data]);
  useEffect(() => {
    if (savedAttachments.current === data.attachments) return;
    savedAttachments.current = data.attachments;
    saveDraftAttachments(data.attachments).catch(() => setStatus('Could not save attachments in this browser. Save a brief to keep a copy.'));
  }, [data.attachments]);
  useEffect(() => {
    const transcript = messages.slice(-200).map((m) => m.attachments
      ? { ...m, attachments: m.attachments.map(attachmentMetadata) }
      : m);
    try { localStorage.setItem(CHAT_KEY, JSON.stringify(transcript)); } catch { /* ignore */ }
  }, [messages]);

  // highlight the form section in view
  useEffect(() => {
    if (mode !== 'form') return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => en.isIntersecting && setActive(en.target.id.slice(2))),
      { rootMargin: '-20% 0px -70% 0px' }
    );
    SECTIONS.forEach((s) => { const el = document.getElementById(`s-${s.id}`); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [view, mode]);

  /* ---------- AI ---------- */
  const runAI = useCallback(async (history) => {
    setBusy(true);
    setLiveActivity(history.at(-1)?.attachments?.some((file) => file.data) ? 'Processing attachments…' : '');
    const controller = new AbortController();
    abortRef.current = controller;
    const activity = [];
    const touched = new Set();
    try {
      const cfg = activeConfig(settings);
      const result = await runTurn({
        cfg,
        system: buildSystemPrompt(dataRef.current, { web: cfg.web, userName: settings.userName }),
        history: history.filter((m) => (m.role === 'user' || m.role === 'assistant') && !m.greeting),
        signal: controller.signal,
        onActivity: (a) => {
          if (controller.signal.aborted) return;
          activity.push(a);
          setLiveActivity(a);
        },
        onPatch: (patch) => {
          controller.signal.throwIfAborted();
          const [next, changed] = applyPatch(dataRef.current, patch, history.flatMap((message) => message.attachments || []));
          dataRef.current = next;
          setData(next);
          changed.forEach((k) => touched.add(KEY_TO_SECTION[k] || k));
          setLiveActivity('Updating the draft…');
        },
      });
      controller.signal.throwIfAborted();
      if (touched.size) activity.push(`Updated: ${[...touched].join(', ')}`);
      const parsed = parseAssistantText(result.text);
      setMessages((m) => [...m, {
        id: uid(), role: 'assistant',
        text: parsed.text || (touched.size ? 'Done — I updated the draft.' : '…'),
        choices: parsed.choices, ready: parsed.ready, activity,
      }]);
    } catch (err) {
      if (abortRef.current !== controller) return;
      if (err.name !== 'AbortError') setMessages((m) => [...m, { id: uid(), role: 'error', text: err.message || 'Something went wrong.' }]);
      else if (touched.size) setMessages((m) => [...m, { id: uid(), role: 'assistant', text: 'Stopped. Changes made so far are kept.', activity }]);
    } finally {
      if (abortRef.current === controller) {
        setBusy(false);
        setLiveActivity('');
        abortRef.current = null;
      }
    }
  }, [settings]);

  const sendMessage = (text, attachments = []) => {
    if (isSample) {
      dataRef.current = emptyData();
      setData(dataRef.current);
    }
    let remaining = MAX_HISTORY_BYTES - attachments.reduce((total, file) => total + file.size, 0);
    const history = [...messages].reverse().map((m) => {
      if (!m.attachments) return m;
      return { ...m, attachments: m.attachments.map((file) => {
        if (!file.data) return file;
        if (file.size > remaining) return attachmentMetadata(file);
        remaining -= file.size;
        return file;
      }) };
    }).reverse();
    const next = [...history, {
      id: uid(), role: 'user', text: text || ATTACHMENT_PROMPT,
      ...(attachments.length ? { attachments } : {}),
    }];
    setMessages(next);
    runAI(next);
  };

  const retry = () => {
    if (abortRef.current || !isReady(settings)) return;
    const withoutErrors = messages.filter((m) => m.role !== 'error');
    setMessages(withoutErrors);
    runAI(withoutErrors);
  };

  const newCaseStudy = () => {
    if (!window.confirm('Start a new case study? The current draft and chat will be cleared (your brand details are kept).')) return;
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setLiveActivity('');
    const fresh = isSample ? emptyData() : keepBrand(dataRef.current);
    setData(fresh);
    setMessages([greeting()]);
    setMode('chat');
  };

  const askChanges = () => {
    setShowPreview(false);
    setMode('chat');
    setTimeout(() => chatInputRef.current?.focus(), 50);
  };

  /* ---------- exports ---------- */
  const exportPdf = async () => {
    setPdfBusy(true);
    try { await downloadPdf(data, pdfMode, setStatus); setStatus('PDF downloaded.'); }
    catch (err) { console.error(err); setStatus('Couldn’t build the PDF.'); }
    setPdfBusy(false);
  };
  const openBrief = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try { setData(normalize(JSON.parse(await file.text()))); setStatus('Brief loaded.'); }
    catch { setStatus('That file isn’t a saved brief.'); }
  };
  const goTo = (id) => {
    setView('edit');
    setActive(id);
    requestAnimationFrame(() => document.getElementById(`s-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const moveSection = (from, to) => {
    const order = sections.map((section) => section.id);
    const start = order.indexOf(from);
    const end = order.indexOf(to);
    if (start < 0 || end < 0 || start === end) return;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sectionPositions.current = new Map(order.map((id) => [
        id, document.getElementById(`s-${id}`)?.getBoundingClientRect().top,
      ]));
    }
    order.splice(end, 0, ...order.splice(start, 1));
    setData((draft) => ({ ...draft, sectionOrder: order }), isSample);
  };

  useLayoutEffect(() => {
    if (!sectionPositions.current) return;
    for (const [id, top] of sectionPositions.current) {
      const card = document.getElementById(`s-${id}`);
      const distance = top - card?.getBoundingClientRect().top;
      if (distance) card.animate([{ transform: `translateY(${distance}px)` }, { transform: 'none' }],
        { duration: 220, easing: 'ease-out' });
    }
    sectionPositions.current = null;
  }, [data.sectionOrder]);

  const progress = sectionProgress(data);
  const doneCount = progress.filter((p) => p.state === 'done').length;

  return (
    <>
      <header className="top">
        <div className="logo">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <rect x="2" y="3" width="17" height="21" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M7 9h7M7 13h7M7 17h4" stroke="#3fae5a" strokeWidth="2" strokeLinecap="round" />
            <circle cx="20" cy="19" r="4.5" fill="#3fae5a" />
          </svg>
          <span className="logo-t">Case Study Builder</span>
        </div>
        <div className="seg" role="tablist" aria-label="Mode">
          <button type="button" role="tab" aria-selected={mode === 'chat'} onClick={() => setMode('chat')}>AI chat</button>
          <button type="button" role="tab" aria-selected={mode === 'form'} onClick={() => setMode('form')}>Form</button>
        </div>
        <div className="acts">
          <button type="button" onClick={newCaseStudy}>New</button>
          <button type="button" onClick={() => setShowPreview(true)}>Preview</button>
          <button type="button" className="b-green" onClick={exportPdf} disabled={pdfBusy}>{pdfBusy ? 'Building…' : 'Download PDF'}</button>
          <button type="button" className="icon gear" onClick={() => setShowSettings(true)} aria-label="AI settings" title="AI settings">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.3 2.5h4l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg>
          </button>
        </div>
      </header>

      {status && <p className="toast" role="status" onAnimationEnd={() => setStatus('')}>{status}</p>}

      {mode === 'chat' ? (
        <div className="chatwrap">
          <Chat
            key={messages[0]?.id}
            messages={messages}
            busy={busy}
            liveActivity={liveActivity}
            onSend={sendMessage}
            onRetry={retry}
            onStop={() => abortRef.current?.abort()}
            onPreview={() => setShowPreview(true)}
            onAddAttachment={addToDocument}
            includedAttachments={data.attachments}
            hasKey={isReady(settings)}
            providerKind={activeConfig(settings).kind}
            userName={settings.userName}
            onOpenSettings={() => setShowSettings(true)}
            inputRef={chatInputRef}
          />
          <aside className="draft-panel">
            <div className="dp-head">
              <h3>Draft</h3>
              <span>{isSample ? 'Sample — replaced when you start' : `${doneCount} of ${progress.length} sections`}</span>
            </div>
            <ul className="prog">
              {progress.map((p) => (
                <li key={p.id} className={p.state}>
                  <i aria-hidden="true">{p.state === 'done' ? '✓' : p.state === 'partial' ? '◐' : ''}</i>{p.name}
                </li>
              ))}
            </ul>
            <button type="button" className="b-dark wide" onClick={() => setShowPreview(true)}>Generate &amp; preview</button>
            <div className="mini"><Preview data={data} /></div>
          </aside>
        </div>
      ) : (
        <div className="wrap" data-view={view}>
          <aside className="side">
            <h4>SECTIONS</h4>
            <nav>
              {sections.map((s) => (
                <a key={s.id} href={`#s-${s.id}`} className={active === s.id ? 'on' : ''} style={{ '--c': s.color }}
                  onClick={(e) => { e.preventDefault(); goTo(s.id); }}>
                  <i />{s.name}
                </a>
              ))}
            </nav>
            <div className="tools">
              <button type="button" onClick={() => { downloadBrief(data); setStatus('Brief saved.'); }}>Save brief</button>
              <button type="button" onClick={() => fileRef.current.click()}>Open brief</button>
              <input ref={fileRef} type="file" accept=".json" hidden onChange={openBrief} />
              <button type="button" onClick={() => setData(SAMPLE, true)}>Load sample</button>
              <button type="button" onClick={() => { setData((d) => keepBrand(d)); setStatus('Cleared — brand details kept.'); }}>Clear all</button>
            </div>
          </aside>
          <main className="forms">
            <div className="intro">
              <h1>Edit case study</h1>
              <p>Change anything here — the AI chat sees your edits too.</p>
              {isSample && <p className="note-s">Showing sample content. Start in AI chat, or use “Clear all”.</p>}
            </div>
            <div className="tabs" role="tablist">
              <button type="button" role="tab" aria-selected={view === 'edit'} onClick={() => setView('edit')}>Edit</button>
              <button type="button" role="tab" aria-selected={view === 'preview'} onClick={() => setView('preview')}>Preview</button>
            </div>
            <form className="forms" onSubmit={(e) => e.preventDefault()} autoComplete="off">
              {sections.map((s, index) => <SectionForm key={s.id} section={s} data={data} setField={setField} setList={setList}
                onMove={moveSection} previousId={sections[index - 1]?.id} nextId={sections[index + 1]?.id}
                onAddAttachments={addToDocument} />)}
            </form>
          </main>
          <section className="prev" aria-label="Preview">
            <div className="pbar">
              <span>Preview</span>
              <select value={pdfMode} onChange={(e) => setPdfMode(e.target.value)} aria-label="PDF layout">
                <option value="long">PDF: one long page</option>
                <option value="a4">PDF: A4 pages</option>
              </select>
            </div>
            <Preview data={data} />
          </section>
        </div>
      )}

      {showSettings && <SettingsModal settings={settings} onSave={(s) => { setSettings(s); saveSettings(s); setStatus('Settings saved.'); }} onClose={() => setShowSettings(false)} />}
      {showPreview && (
        <PreviewModal
          data={data}
          pdfMode={pdfMode}
          setPdfMode={setPdfMode}
          busy={pdfBusy}
          onPdf={exportPdf}
          onHtml={() => { downloadHtml(data); setStatus('Web page downloaded.'); }}
          onClose={() => setShowPreview(false)}
          onAskChanges={askChanges}
          onEditForm={() => { setShowPreview(false); setMode('form'); }}
        />
      )}
    </>
  );
}

