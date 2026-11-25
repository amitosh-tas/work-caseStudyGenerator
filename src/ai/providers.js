import { patchSchema, TOOL_DESCRIPTION, TOOL_NAME } from './tools.js';
import { acceptsAttachment, attachmentUrl, ATTACHMENT_PROMPT } from './attachments.js';

const MAX_ROUNDS = 12;
const FETCH_TOOL = 'fetch_webpage';
const FETCH_DESCRIPTION =
  'Read a web page (e.g. the client website, its About or Services page). Returns the title, description, readable text, ' +
  'internal links you can fetch next, and platformHints detected from the page code and server headers (e.g. Shopify, WordPress, Next.js, Cloudflare). ' +
  'Treat platformHints as clues to confirm with the user, not facts.';
const FETCH_SCHEMA = { type: 'object', properties: { url: { type: 'string', description: 'Full URL to read' } }, required: ['url'] };

const host = (u) => { try { return new URL(/^https?:/.test(u) ? u : 'https://' + u).hostname; } catch { return u; } };

/** Strictly alternating user/assistant turns, starting with the user. */
function toTurns(history, kind) {
  const turns = [];
  const lastMessage = history.at(-1);
  for (const m of history) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    const attachments = m.role === 'user' ? m.attachments || [] : [];
    const files = attachments.filter((file) => file.data && acceptsAttachment(kind, file.type));
    const unavailable = attachments.filter((file) => !files.includes(file));
    if (m === lastMessage && unavailable.length) {
      throw new Error(`Please attach these files again with a compatible model: ${unavailable.map((file) => file.name).join(', ')}.`);
    }
    const text = [
      m.text?.trim() || (files.length ? ATTACHMENT_PROMPT : ''),
      files.length ? `Attached files in order: ${JSON.stringify(files.map(({ id, name }) => ({ id, name })))}` : '',
      unavailable.length ? `Earlier attachments unavailable: ${unavailable.map((file) => file.name).join(', ')}` : '',
    ].filter(Boolean).join('\n\n');
    if (!text) continue;
    if (!turns.length && m.role === 'assistant') continue;
    const last = turns[turns.length - 1];
    const parts = [{ text }, ...files.map((file) => ({ file }))];
    if (last && last.role === m.role) last.parts.push(...parts);
    else turns.push({ role: m.role, parts });
  }
  return turns;
}

function formatMessages(turns, textType, formatFile) {
  return turns.map(({ role, parts }) => ({
    role,
    content: parts.some((part) => part.file)
      ? parts.map(({ text, file }) => file ? formatFile(file) : { type: textType, text })
      : parts.map((part) => part.text).join('\n\n'),
  }));
}

async function readError(res) {
  let msg = `${res.status} ${res.statusText}`;
  try {
    const j = await res.json();
    msg = j?.error?.message || j?.message || (Array.isArray(j) && j[0]?.error?.message) || msg;
  } catch { /* not json */ }
  if (res.status === 401 || res.status === 403) msg = `Your API key was rejected — check it in Settings. (${msg})`;
  else if (res.status === 404) msg = `Not found — check the model name (or base URL) in Settings. (${msg})`;
  else if (res.status === 429) msg = `Rate limit or quota reached for this key. Wait a moment or check your plan. (${msg})`;
  return new Error(msg);
}

async function post(url, headers, body, signal) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal });
  if (!res.ok) throw await readError(res);
  return res.json();
}

/** Runs our own tools and returns the text result for the model. */
async function executeTool(name, args, { onPatch, onActivity, signal }) {
  if (name === TOOL_NAME) {
    try {
      onPatch(args || {});
      return 'Saved to the draft.';
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      return `Could not save to the draft: ${error.message}`;
    }
  }
  if (name === FETCH_TOOL) {
    const url = String(args?.url || '');
    onActivity?.(`Reading ${host(url)}`);
    try {
      const r = await fetch(`/api/fetch?url=${encodeURIComponent(url)}`, { signal });
      const j = await r.json();
      if (!r.ok) return `Could not read the page: ${j?.error?.message || r.status}`;
      onActivity?.(`Read ${host(j.url || url)}`);
      return JSON.stringify(j);
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      return `Could not read the page: ${e.message}`;
    }
  }
  return `Unknown tool ${name}`;
}

/**
 * One assistant turn, including any tool calls. Returns { text }.
 * cfg = activeConfig(settings): { kind, apiKey, model, baseUrl, web }
 */
export async function runTurn({ cfg, system, history, onPatch, onActivity, signal }) {
  if (!cfg.model) throw new Error('Choose a model in Settings first.');
  if (!cfg.apiKey && !cfg.keyOptional) throw new Error('Add your API key in Settings first.');
  const ctx = { onPatch, onActivity, signal };
  const run = { anthropic: runAnthropic, openai: runOpenAI, gemini: runGemini, compat: runCompat }[cfg.kind];
  return run(cfg, system, toTurns(history, cfg.kind), ctx);
}

/* ---------- Claude (Anthropic Messages API) ---------- */
async function runAnthropic(cfg, system, turns, ctx) {
  const tools = [{ name: TOOL_NAME, description: TOOL_DESCRIPTION, input_schema: patchSchema() }];
  if (cfg.web) {
    tools.push({ name: FETCH_TOOL, description: FETCH_DESCRIPTION, input_schema: FETCH_SCHEMA });
    tools.push({ type: 'web_search_20250305', name: 'web_search', max_uses: 5 });
  }
  const headers = { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
  const messages = formatMessages(turns, 'text', ({ type, data }) => ({
    type: type === 'application/pdf' ? 'document' : 'image',
    source: { type: 'base64', media_type: type, data },
  }));
  const texts = [];
  for (let i = 0; i < MAX_ROUNDS; i++) {
    const data = await post('/api/anthropic/v1/messages', headers, { model: cfg.model, max_tokens: 8000, system, messages, tools }, ctx.signal);
    const results = [];
    for (const b of data.content || []) {
      if (b.type === 'text' && b.text.trim()) texts.push(b.text);
      if (b.type === 'server_tool_use' && b.name === 'web_search') ctx.onActivity?.(`Searched: ${b.input?.query ?? ''}`);
      if (b.type === 'tool_use') results.push({ type: 'tool_result', tool_use_id: b.id, content: await executeTool(b.name, b.input, ctx) });
    }
    messages.push({ role: 'assistant', content: data.content });
    if (data.stop_reason === 'tool_use' && results.length) { messages.push({ role: 'user', content: results }); continue; }
    if (data.stop_reason === 'pause_turn') continue;
    break;
  }
  return { text: texts.join('\n\n') };
}

/* ---------- OpenAI (Responses API) ---------- */
async function runOpenAI(cfg, system, turns, ctx) {
  const tools = [{ type: 'function', name: TOOL_NAME, description: TOOL_DESCRIPTION, parameters: patchSchema(), strict: false }];
  if (cfg.web) {
    tools.push({ type: 'function', name: FETCH_TOOL, description: FETCH_DESCRIPTION, parameters: FETCH_SCHEMA, strict: false });
    tools.push({ type: 'web_search' });
  }
  const headers = { authorization: `Bearer ${cfg.apiKey}` };
  const input = formatMessages(turns, 'input_text', (file) => file.type === 'application/pdf'
    ? { type: 'input_file', filename: file.name, file_data: attachmentUrl(file) }
    : { type: 'input_image', image_url: attachmentUrl(file), detail: 'auto' });
  let body = { model: cfg.model, instructions: system, input, tools };
  const texts = [];
  for (let i = 0; i < MAX_ROUNDS; i++) {
    const data = await post('/api/openai/v1/responses', headers, body, ctx.signal);
    const outputs = [];
    for (const item of data.output || []) {
      if (item.type === 'message') {
        const t = (item.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('');
        if (t.trim()) texts.push(t);
      }
      if (item.type === 'web_search_call') {
        const a = item.action || {};
        ctx.onActivity?.(a.url ? `Read ${host(a.url)}` : `Searched: ${a.query ?? 'the web'}`);
      }
      if (item.type === 'function_call') {
        let args = {};
        try { args = JSON.parse(item.arguments || '{}'); } catch { /* bad json */ }
        outputs.push({ type: 'function_call_output', call_id: item.call_id, output: await executeTool(item.name, args, ctx) });
      }
    }
    if (!outputs.length) break;
    body = { model: cfg.model, instructions: system, previous_response_id: data.id, input: outputs, tools };
  }
  return { text: texts.join('\n\n') };
}

/* ---------- Google Gemini (generateContent) ---------- */
async function runGemini(cfg, system, turns, ctx) {
  const decls = [{ name: TOOL_NAME, description: TOOL_DESCRIPTION, parameters: patchSchema() }];
  if (cfg.web) decls.push({ name: FETCH_TOOL, description: FETCH_DESCRIPTION, parameters: FETCH_SCHEMA });
  const contents = turns.map(({ role, parts }) => ({
    role: role === 'assistant' ? 'model' : 'user',
    parts: parts.map(({ text, file }) => file ? { inlineData: { mimeType: file.type, data: file.data } } : { text }),
  }));
  const headers = { 'x-goog-api-key': cfg.apiKey };
  const url = `/api/gemini/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`;
  const texts = [];
  for (let i = 0; i < MAX_ROUNDS; i++) {
    const data = await post(url, headers, {
      systemInstruction: { parts: [{ text: system }] },
      contents,
      tools: [{ functionDeclarations: decls }],
    }, ctx.signal);
    const cand = data.candidates?.[0];
    if (!cand?.content) {
      const why = data.promptFeedback?.blockReason || cand?.finishReason || 'no content';
      throw new Error(`Gemini returned no answer (${why}).`);
    }
    const parts = cand.content.parts || [];
    const responses = [];
    for (const p of parts) {
      if (p.text && !p.thought && p.text.trim()) texts.push(p.text);
      if (p.functionCall) {
        const result = await executeTool(p.functionCall.name, p.functionCall.args, ctx);
        responses.push({ functionResponse: { name: p.functionCall.name, ...(p.functionCall.id ? { id: p.functionCall.id } : {}), response: { result } } });
      }
    }
    contents.push({ role: 'model', parts }); // keep parts as-is (incl. thought signatures)
    if (!responses.length) break;
    contents.push({ role: 'user', parts: responses });
  }
  return { text: texts.join('\n\n') };
}

/* ---------- OpenAI-compatible chat completions (OpenRouter, Groq, DeepSeek, Mistral, Ollama, …) ---------- */
async function runCompat(cfg, system, turns, ctx) {
  const tools = [{ type: 'function', function: { name: TOOL_NAME, description: TOOL_DESCRIPTION, parameters: patchSchema() } }];
  if (cfg.web) tools.push({ type: 'function', function: { name: FETCH_TOOL, description: FETCH_DESCRIPTION, parameters: FETCH_SCHEMA } });
  const headers = { 'x-target-base': cfg.baseUrl, 'x-title': 'Case Study Builder' };
  if (cfg.apiKey) headers.authorization = `Bearer ${cfg.apiKey}`;
  const messages = [{ role: 'system', content: system }, ...formatMessages(turns, 'text', (file) => ({
    type: 'image_url', image_url: { url: attachmentUrl(file) },
  }))];
  const texts = [];
  for (let i = 0; i < MAX_ROUNDS; i++) {
    const data = await post('/api/compat/chat/completions', headers, { model: cfg.model, messages, tools }, ctx.signal);
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error('The model returned no answer.');
    if (typeof msg.content === 'string' && msg.content.trim()) texts.push(msg.content);
    messages.push({ role: 'assistant', content: msg.content ?? '', ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}) });
    if (!msg.tool_calls?.length) break;
    for (const call of msg.tool_calls) {
      let args = {};
      try { args = JSON.parse(call.function?.arguments || '{}'); } catch { /* bad json */ }
      messages.push({ role: 'tool', tool_call_id: call.id, content: await executeTool(call.function?.name, args, ctx) });
    }
  }
  return { text: texts.join('\n\n') };
}

/* ---------- helpers for Settings ---------- */

/** Ask the provider which models this key can use. Returns an array of model ids. */
export async function listModels(cfg) {
  const get = async (url, headers) => {
    const res = await fetch(url, { headers });
    if (!res.ok) throw await readError(res);
    return res.json();
  };
  if (cfg.kind === 'anthropic') {
    const j = await get('/api/anthropic/v1/models?limit=100', { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' });
    return (j.data || []).map((m) => m.id);
  }
  if (cfg.kind === 'openai') {
    const j = await get('/api/openai/v1/models', { authorization: `Bearer ${cfg.apiKey}` });
    return (j.data || []).map((m) => m.id).filter((id) => /^(gpt|o\d|chatgpt)/i.test(id) && !/audio|realtime|tts|transcribe|image|embedding|search/i.test(id)).sort().reverse();
  }
  if (cfg.kind === 'gemini') {
    const j = await get('/api/gemini/v1beta/models?pageSize=200', { 'x-goog-api-key': cfg.apiKey });
    return (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace(/^models\//, ''));
  }
  const headers = { 'x-target-base': cfg.baseUrl };
  if (cfg.apiKey) headers.authorization = `Bearer ${cfg.apiKey}`;
  const j = await get('/api/compat/models', headers);
  return (j.data || j.models || []).map((m) => m.id || m.name).filter(Boolean);
}

/** Quick check used by the Settings "Test connection" button. */
export async function testConnection(cfg) {
  await runTurn({ cfg: { ...cfg, web: false }, system: 'Reply with the single word OK.', history: [{ role: 'user', text: 'Test' }], onPatch: () => {} });
}
