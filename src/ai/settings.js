const KEY = 'case-study-builder:ai-settings';

// kind decides which API format is used: 'anthropic' | 'openai' | 'gemini' | 'compat' (OpenAI-compatible chat completions)
// Model lists are only suggestions — "Load my models" in Settings asks the provider for the real list.
export const PROVIDERS = {
  anthropic: {
    name: 'Claude (Anthropic)', kind: 'anthropic',
    keyHint: 'Starts with sk-ant- · console.anthropic.com',
    models: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5'],
  },
  openai: {
    name: 'OpenAI (ChatGPT)', kind: 'openai',
    keyHint: 'Starts with sk- · platform.openai.com',
    models: ['gpt-5.5', 'gpt-5', 'gpt-5-mini'],
  },
  gemini: {
    name: 'Google Gemini', kind: 'gemini',
    keyHint: 'From Google AI Studio · aistudio.google.com',
    models: ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.1-pro-preview'],
  },
  openrouter: {
    name: 'OpenRouter (many models, one key)', kind: 'compat', baseUrl: 'https://openrouter.ai/api/v1',
    keyHint: 'Starts with sk-or- · openrouter.ai/keys',
    models: ['anthropic/claude-sonnet-5-5', 'openai/gpt-5.5', 'google/gemini-3.5-flash'],
  },
  groq: {
    name: 'Groq', kind: 'compat', baseUrl: 'https://api.groq.com/openai/v1',
    keyHint: 'Starts with gsk_ · console.groq.com',
    models: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'],
  },
  deepseek: {
    name: 'DeepSeek', kind: 'compat', baseUrl: 'https://api.deepseek.com/v1',
    keyHint: 'From platform.deepseek.com',
    models: ['deepseek-chat'],
  },
  mistral: {
    name: 'Mistral', kind: 'compat', baseUrl: 'https://api.mistral.ai/v1',
    keyHint: 'From console.mistral.ai',
    models: ['mistral-large-latest', 'mistral-medium-latest'],
  },
  custom: {
    name: 'Custom (OpenAI-compatible)', kind: 'compat', baseUrl: '', customBase: true, keyOptional: true,
    keyHint: 'Any OpenAI-compatible API — e.g. Ollama (http://localhost:11434/v1), LM Studio, Together, Azure',
    models: [],
  },
};

export const DEFAULT_SETTINGS = {
  provider: 'anthropic',
  keys: {},            // per provider
  models: {},          // per provider
  customBaseUrl: 'http://localhost:11434/v1',
  web: true,
  userName: '',        // what the AI calls you
};

export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && PROVIDERS[s.provider]) {
      // migrate the older single-key format
      if (typeof s.apiKey === 'string') {
        s.keys = { ...(s.keys || {}), [s.provider]: s.apiKey };
        s.models = { ...(s.models || {}), [s.provider]: s.model };
        delete s.apiKey; delete s.model;
      }
      return { ...DEFAULT_SETTINGS, ...s, keys: { ...(s.keys || {}) }, models: { ...(s.models || {}) } };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS, keys: {}, models: {} };
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

/** The values the API layer needs for the selected provider. */
export function activeConfig(s) {
  const p = PROVIDERS[s.provider] || PROVIDERS.anthropic;
  return {
    provider: s.provider,
    kind: p.kind,
    apiKey: (s.keys?.[s.provider] || '').trim(),
    model: (s.models?.[s.provider] || p.models[0] || '').trim(),
    baseUrl: p.customBase ? (s.customBaseUrl || '').trim() : p.baseUrl,
    web: !!s.web,
    keyOptional: !!p.keyOptional,
  };
}

export function isReady(s) {
  const c = activeConfig(s);
  return !!c.model && (c.keyOptional || !!c.apiKey) && (c.kind !== 'compat' || !!c.baseUrl);
}
