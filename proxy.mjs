// Shared API middleware, used by Vite (dev + preview) and by server.mjs (production).
//   /api/anthropic/*  → https://api.anthropic.com/*
//   /api/openai/*     → https://api.openai.com/*
//   /api/gemini/*     → https://generativelanguage.googleapis.com/*
//   /api/compat/*     → <x-target-base header>/*   (OpenRouter, Groq, DeepSeek, Mistral, Ollama, …)
//   /api/fetch?url=   → fetches a web page and returns its readable text + platform hints
// Meant for local / internal use. Don't expose it publicly without adding authentication.

const TARGETS = {
  '/api/anthropic': 'https://api.anthropic.com',
  '/api/openai': 'https://api.openai.com',
  '/api/gemini': 'https://generativelanguage.googleapis.com',
};
const PASS = ['content-type', 'authorization', 'x-api-key', 'x-goog-api-key', 'anthropic-version', 'anthropic-beta', 'anthropic-dangerous-direct-browser-access', 'http-referer', 'x-title'];

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

function send(res, status, obj, type = 'application/json') {
  res.writeHead(status, { 'content-type': type });
  res.end(typeof obj === 'string' || Buffer.isBuffer(obj) ? obj : JSON.stringify(obj));
}

async function forward(req, res, base, path) {
  const headers = {};
  for (const h of PASS) if (req.headers[h]) headers[h] = req.headers[h];
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
  const up = await fetch(base.replace(/\/$/, '') + path, { method: req.method, headers, body });
  res.writeHead(up.status, { 'content-type': up.headers.get('content-type') || 'application/json' });
  res.end(Buffer.from(await up.arrayBuffer()));
}

/* ---------- web page reader ---------- */
const HINTS = [
  [/cdn\.shopify\.com|Shopify\.theme/i, 'Shopify'],
  [/wp-content|wp-includes/i, 'WordPress'],
  [/woocommerce/i, 'WooCommerce'],
  [/elementor/i, 'Elementor'],
  [/static\.wixstatic\.com|wix\.com/i, 'Wix'],
  [/squarespace/i, 'Squarespace'],
  [/webflow/i, 'Webflow'],
  [/framerusercontent|framer\.com/i, 'Framer'],
  [/\/_next\/|__NEXT_DATA__/i, 'Next.js'],
  [/__nuxt|_nuxt\//i, 'Nuxt'],
  [/data-reactroot|react-dom/i, 'React'],
  [/gatsby/i, 'Gatsby'],
  [/googletagmanager\.com\/gtm/i, 'Google Tag Manager'],
  [/gtag\(|google-analytics\.com|googletagmanager\.com\/gtag/i, 'Google Analytics'],
  [/fbq\(|connect\.facebook\.net/i, 'Meta Pixel'],
  [/klaviyo/i, 'Klaviyo'],
  [/hubspot/i, 'HubSpot'],
  [/intercom/i, 'Intercom'],
  [/tawk\.to/i, 'Tawk.to'],
  [/wa\.me\/|api\.whatsapp\.com/i, 'WhatsApp link'],
  [/calendly/i, 'Calendly'],
  [/stripe\.com/i, 'Stripe'],
  [/razorpay/i, 'Razorpay'],
  [/leadconnectorhq|msgsndr|gohighlevel/i, 'GoHighLevel'],
  [/zoho/i, 'Zoho'],
];

function htmlToText(html) {
  return html
    .replace(/<(script|style|noscript|svg|iframe|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|section|li|h[1-6]|br|tr|header|footer|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

async function readPage(url) {
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error('Only http(s) URLs are allowed');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(u, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; CaseStudyBuilder/1.0)', accept: 'text/html,application/xhtml+xml' },
    });
    const html = (await r.text()).slice(0, 2_000_000);
    const pick = (re) => (html.match(re)?.[1] || '').trim();
    const hints = new Set(HINTS.filter(([re]) => re.test(html)).map(([, n]) => n));
    const gen = pick(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i);
    if (gen) hints.add(`Generator: ${gen}`);
    const server = r.headers.get('server');
    if (server) hints.add(`Server header: ${server}`);
    if (r.headers.get('x-powered-by')) hints.add(`X-Powered-By: ${r.headers.get('x-powered-by')}`);
    if (r.headers.get('cf-ray')) hints.add('Cloudflare');
    if (r.headers.get('x-vercel-id')) hints.add('Vercel hosting');
    if (r.headers.get('x-nf-request-id')) hints.add('Netlify hosting');
    const links = [...html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)]
      .map((m) => { try { return new URL(m[1], r.url).href; } catch { return null; } })
      .filter((h) => h && h.startsWith(new URL(r.url).origin))
      .filter((h, i, a) => a.indexOf(h) === i)
      .slice(0, 25);
    return {
      url: r.url,
      status: r.status,
      title: pick(/<title[^>]*>([^<]*)<\/title>/i),
      description: pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i) || pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)/i),
      platformHints: [...hints],
      internalLinks: links,
      text: htmlToText(html).slice(0, 12000),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function apiMiddleware(req, res, next) {
  const url = req.url || '';
  if (!url.startsWith('/api/')) return next();
  try {
    if (url.startsWith('/api/fetch')) {
      const target = new URL(url, 'http://x').searchParams.get('url') || '';
      return send(res, 200, await readPage(target));
    }
    if (url.startsWith('/api/compat/')) {
      const base = req.headers['x-target-base'];
      if (!base || !/^https?:\/\//i.test(base)) return send(res, 400, { error: { message: 'Missing or invalid base URL for this provider (check Settings).' } });
      return await forward(req, res, base, url.slice('/api/compat'.length));
    }
    const prefix = Object.keys(TARGETS).find((p) => url.startsWith(p + '/'));
    if (prefix) return await forward(req, res, TARGETS[prefix], url.slice(prefix.length));
    return send(res, 404, { error: { message: 'Unknown API route' } });
  } catch (err) {
    return send(res, 502, { error: { message: `Couldn't reach the service: ${err.message}` } });
  }
}
