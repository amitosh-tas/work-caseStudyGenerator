// Turns the form data into the case study markup, using the uploaded design (ma-case classes).
import designCss from './caseStudy.css?raw';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paras = (t) => String(t || '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
const filled = (a = []) => a.filter((o) => Object.values(o).some((v) => String(v).trim()));
const safeUrl = (u) => (/^https:\/\/\S+\.\S+/i.test(u || '') ? u : '');

/** CSS for the case study: the original design plus the chosen brand colours. */
export function caseStudyCss(d) {
  return `${designCss}\n.ma-case{--green:${d.green};--navy:${d.navy};--mint:${d.mint}}`;
}

/**
 * Inner HTML of <article class="ma-case">.
 * forPdf: opens the FAQ answers so they appear in the PDF.
 */
export function caseStudyBody(d, { forPdf = false } = {}) {
  const v = (k) => String(d[k] ?? '').trim();
  const ag = v('agency') || 'Agency';
  const au = v('author');
  const title = v('title') || 'Case study';
  const link = safeUrl(v('link'));
  const img = (sz) => (d.photo ? `<img src="${d.photo}" alt="${esc(au || ag)}" width="${sz}" height="${sz}" loading="lazy" decoding="async">` : '');
  const P = (t) => paras(t).map((p) => `<p>${esc(p)}</p>`).join('');
  const section = (cls, inner, id) => `<section class="ma-section ${cls}"${id ? ` id="${id}"` : ''}><div class="ma-inner">${inner}</div></section>`;
  const kh = (k, h) => `${k ? `<div class="ma-kicker"><p>${esc(k)}</p></div>` : ''}${h ? `<h2>${esc(h)}</h2>` : ''}`;
  const node = (n, c = '') => `<div class="ma-node ${c}"><strong>${esc(n.title)}</strong>${n.sub ? `<small>${esc(n.sub)}</small>` : ''}</div>`;
  const chain = (a, lastCls = '') => a.map((n, i) => node(n, i === a.length - 1 ? lastCls : '')).join('<div class="ma-connector" aria-hidden="true"></div>');

  const facts = filled(d.facts), cards = filled(d.chCards), steps = filled(d.steps);
  const trunk = filled(d.trunk), yes = filled(d.yes), no = filled(d.no), sep = filled(d.sep);
  const tools = filled(d.tools), faq = filled(d.faq), metrics = filled(d.metrics);
  const stack = v('stack').split(',').map((x) => x.trim()).filter(Boolean);
  let h = '';

  // Hero
  h += section('ma-hero', `${v('kicker') ? `<div class="ma-kicker"><p>${esc(v('kicker'))}</p></div>` : ''}<h1>${esc(title)}</h1>${v('deck') ? `<div class="ma-deck"><p>${esc(v('deck'))}</p></div>` : ''}${v('intro') ? `<div class="ma-prose"><p>${esc(v('intro'))}</p></div>` : ''}${v('byline') ? `<div class="ma-small"><p>${esc(v('byline'))}</p></div>` : ''}${v('heroBtn') && trunk.length ? `<div class="ma-button ma-gap"><a href="#workflow">${esc(v('heroBtn'))}</a></div>` : ''}${facts.length ? `<div class="ma-grid ma-four">${facts.map((f) => `<div class="ma-card"><span class="ma-label">${esc(f.label)}</span><strong>${esc(f.value)}</strong></div>`).join('')}</div>` : ''}`);

  // Challenge
  if (v('chHead') || v('chText') || cards.length)
    h += section('', `${kh('The challenge', v('chHead'))}<div class="ma-prose">${P(v('chText'))}</div>${cards.length ? `<div class="ma-grid">${cards.map((c) => `<div class="ma-card"><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></div>`).join('')}</div>` : ''}`);

  // What we built
  if (v('buHead') || steps.length)
    h += section('ma-mint', `${kh('What we built', v('buHead'))}<div class="ma-grid">${steps.map((c, i) => `<div class="ma-card"><div class="ma-step"><p>${String(i + 1).padStart(2, '0')}</p></div><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></div>`).join('')}</div>`, 'implementation');

  // CTA bar
  if (v('barTitle'))
    h += `<section class="ma-section ma-bar-zone"><div class="ma-inner"><aside class="ma-cta-bar" aria-label="${esc(v('barTitle'))}"><div class="ma-contact">${img(56)}<div><strong>${esc(v('barTitle'))}</strong><p>${esc(v('barText'))}</p></div></div>${v('btnLabel') ? `<a class="ma-button" href="${esc(link || '#')}">${esc(v('btnLabel'))} ↗</a>` : ''}</aside></div></section>`;

  // Workflow diagram
  if (v('wfHead') || trunk.length) {
    const branches = yes.length || no.length
      ? `<div class="ma-branches"><div class="ma-branch"><div class="ma-branch-label">${esc(v('yesLabel').toUpperCase())}</div>${chain(yes, 'ma-result')}</div><div class="ma-branch"><div class="ma-branch-label">${esc(v('noLabel').toUpperCase())}</div>${chain(no)}</div></div>`
      : '';
    h += section('ma-dark', `${kh('The workflow', v('wfHead'))}${v('wfIntro') ? `<p>${esc(v('wfIntro'))}</p>` : ''}<figure class="ma-diagram" aria-label="${esc(title)} workflow diagram"><div class="ma-trunk">${chain(trunk)}${v('decTitle') ? `${trunk.length ? '<div class="ma-connector" aria-hidden="true"></div>' : ''}${node({ title: v('decTitle'), sub: v('decSub') }, 'ma-decision')}` : ''}</div>${branches}${sep.length ? `<div class="ma-phone-path"><div class="ma-branch-label">${esc(v('sepLabel').toUpperCase())}</div>${chain(sep)}</div>` : ''}${v('wfCaption') ? `<figcaption>${esc(v('wfCaption'))}</figcaption>` : ''}</figure>${v('wfNote') ? `<div class="ma-small ma-gap"><p>${esc(v('wfNote'))}</p></div>` : ''}`, 'workflow');
  }

  // Extra section
  if (v('exHead') || v('exText'))
    h += section('', `${kh(v('exKicker'), v('exHead'))}<div class="ma-prose">${P(v('exText'))}</div>`);

  // Tools, stack & hosting
  if (v('toHead') || tools.length || stack.length || v('hosting'))
    h += section('ma-mint', `${kh('The connected tools', v('toHead'))}<div class="ma-grid">${tools.map((c) => `<div class="ma-card"><h3>${esc(c.name)}</h3><p>${esc(c.role)}</p></div>`).join('')}${stack.length ? `<div class="ma-card"><h3>Tech stack</h3><p>${stack.map(esc).join(' · ')}</p></div>` : ''}${v('hosting') ? `<div class="ma-card"><h3>Server &amp; hosting</h3>${v('hosting').split('\n').filter((x) => x.trim()).map((x) => `<p>${esc(x.trim())}</p>`).join('')}</div>` : ''}</div>`);

  // Outcome
  if (v('ouHead') || v('ouText') || metrics.length)
    h += section('', `${kh('The outcome', v('ouHead'))}<div class="ma-prose">${P(v('ouText'))}</div>${metrics.length ? `<div class="ma-grid ma-four">${metrics.map((m) => `<div class="ma-card"><strong style="font-size:30px;color:var(--green)">${esc(m.value)}</strong><span class="ma-label">${esc(m.label)}</span></div>`).join('')}</div>` : ''}${v('ouNote') ? `<div class="ma-note"><p>${esc(v('ouNote'))}</p></div>` : ''}`);

  // FAQ
  if (faq.length)
    h += section('ma-mint', `${kh('Project questions', v('faHead'))}<div>${faq.map((q) => `<details class="ma-faq"${forPdf ? ' open' : ''}><summary>${esc(q.q)}</summary><p>${esc(q.a)}</p></details>`).join('')}</div>`);

  // Closing
  h += section('ma-dark', `${kh('Work with ' + (au || ag), v('endHead'))}<div class="ma-prose">${P(v('endText'))}</div><div class="ma-contact">${img(64)}<div><p><strong>${esc(au ? 'Talk with ' + au : ag)}</strong></p><p>${esc(v('tagline'))}</p></div></div>${v('btnLabel') ? `<div class="ma-button ma-gap"><a href="${esc(link || '#')}">${esc(v('btnLabel'))}</a></div>` : ''}`);

  return h;
}

/** Complete standalone web page (for WordPress / Elementor or hosting as-is). */
export function caseStudyDocument(d, opts = {}) {
  const v = (k) => String(d[k] ?? '').trim();
  const ag = v('agency') || 'Agency';
  const title = v('title') || 'Case study';
  const url = safeUrl(v('pageUrl'));
  const ld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Article', headline: title, description: v('deck'),
    author: { '@type': 'Person', name: v('author') || ag }, publisher: { '@type': 'Organization', name: ag },
    ...(url ? { mainEntityOfPage: url } : {}), inLanguage: 'en',
  }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | ${esc(ag)}</title><meta name="description" content="${esc(v('deck'))}">${url ? `<link rel="canonical" href="${esc(url)}"><meta property="og:url" content="${esc(url)}">` : ''}<meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(v('deck'))}">${opts.fonts ? '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">' : ''}<style>body{margin:0}\n${caseStudyCss(d)}</style><script type="application/ld+json">${ld}</script></head><body><article class="ma-case">${caseStudyBody(d, opts)}</article></body></html>`;
}

export function fileSlug(d) {
  return (String(d.title || 'case-study').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)) || 'case-study';
}
