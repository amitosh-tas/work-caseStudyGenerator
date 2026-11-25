// All sections, fields and repeatable lists of the case study.
// Field types: 'text' (default), 'area', 'color', 'file'.

import { normalizeAttachments } from './caseStudyAttachments.js';

const T = (k, label, o = {}) => ({ k, label, t: 'text', ...o });
const A = (k, label, o = {}) => ({ k, label, t: 'area', ...o });

const TITLE_TEXT = [{ k: 'title', label: 'Title' }, { k: 'text', label: 'Text', t: 'area' }];
const NODE = [{ k: 'title', label: 'Box text' }, { k: 'sub', label: 'Small line' }];

export const SECTIONS = [
  {
    id: 'brand', name: 'Brand & contact', color: '#116e08',
    fields: [
      T('agency', 'Agency / brand name'),
      T('author', 'Your name'),
      T('tagline', 'Your tagline', { ph: 'e.g. Shopify, AI agents and workflow automation' }),
      T('link', 'Booking / contact link', { ph: 'https://' }),
      T('pageUrl', 'Web page URL', { ph: 'https://' }),
      { k: 'photo', label: 'Your photo', t: 'file' },
      { k: 'green', label: 'Accent', t: 'color' },
      { k: 'navy', label: 'Dark', t: 'color' },
      { k: 'mint', label: 'Tint', t: 'color' },
    ],
  },
  {
    id: 'hero', name: 'Hero', color: '#3fae5a',
    fields: [
      T('kicker', 'Small label above title', { ph: 'Client case study · Real estate' }),
      T('title', 'Title'),
      A('deck', 'One-line summary'),
      A('intro', 'Intro paragraph'),
      T('byline', 'Byline', { ph: 'By Alex · Client name withheld for confidentiality' }),
      T('heroBtn', 'Button text', { ph: 'Explore the workflow' }),
    ],
    lists: [{ id: 'facts', name: 'Fact cards', max: 4, fields: [{ k: 'label', label: 'Label' }, { k: 'value', label: 'Value' }] }],
  },
  {
    id: 'challenge', name: 'The challenge', color: '#e0115f',
    fields: [T('chHead', 'Heading'), A('chText', 'Text', { hint: 'Blank line = new paragraph' })],
    lists: [{ id: 'chCards', name: 'Goal cards', max: 4, fields: TITLE_TEXT }],
  },
  {
    id: 'built', name: 'What we built', color: '#2563eb',
    fields: [T('buHead', 'Heading')],
    lists: [{ id: 'steps', name: 'Steps', max: 10, fields: TITLE_TEXT }],
  },
  {
    id: 'workflow', name: 'Workflow diagram', color: '#001935',
    fields: [
      T('wfHead', 'Heading'),
      A('wfIntro', 'Intro line'),
      T('decTitle', 'Decision question', { ph: 'Do budget and property type match?' }),
      T('decSub', 'Decision small line'),
      T('yesLabel', 'Left path label', { ph: 'Yes · portfolio match' }),
      T('noLabel', 'Right path label', { ph: 'No · not an immediate match' }),
      T('sepLabel', 'Separate path label', { ph: 'Separate entry point · direct phone call' }),
      T('wfCaption', 'Caption under diagram'),
      A('wfNote', 'Footnote'),
    ],
    lists: [
      { id: 'trunk', name: 'Main flow boxes (top to bottom)', max: 6, fields: NODE },
      { id: 'yes', name: 'Left path boxes', max: 4, fields: NODE },
      { id: 'no', name: 'Right path boxes', max: 4, fields: NODE },
      { id: 'sep', name: 'Separate path boxes', max: 4, fields: NODE },
    ],
  },
  {
    id: 'extra', name: 'Extra section', color: '#d97706',
    fields: [T('exKicker', 'Small label'), T('exHead', 'Heading'), A('exText', 'Text')],
  },
  {
    id: 'tools', name: 'Tools, stack & hosting', color: '#7c3aed',
    fields: [T('toHead', 'Heading'), A('stack', 'Tech stack', { hint: 'comma separated' }), A('hosting', 'Server & hosting')],
    lists: [{ id: 'tools', name: 'Tool cards', max: 8, fields: [{ k: 'name', label: 'Tool' }, { k: 'role', label: 'Its role', t: 'area' }] }],
  },
  {
    id: 'outcome', name: 'The outcome', color: '#059669',
    fields: [T('ouHead', 'Heading'), A('ouText', 'Text'), A('ouNote', 'Results note', { hint: 'state what is and isn’t claimed' })],
    lists: [{ id: 'metrics', name: 'Measured results (optional)', max: 4, fields: [{ k: 'value', label: 'Number', ph: '+38%' }, { k: 'label', label: 'What it measures' }] }],
  },
  {
    id: 'faq', name: 'Project questions', color: '#0891b2',
    fields: [T('faHead', 'Heading')],
    lists: [{ id: 'faq', name: 'Questions', max: 8, fields: [{ k: 'q', label: 'Question' }, { k: 'a', label: 'Answer', t: 'area' }] }],
  },
  {
    id: 'attachments', name: 'Attachments', color: '#52647a', fields: [],
  },
  {
    id: 'cta', name: 'Call to action', color: '#111827',
    fields: [
      T('barTitle', 'Mid-page banner title'),
      T('barText', 'Banner line'),
      T('btnLabel', 'Button text', { ph: 'Schedule a call' }),
      T('endHead', 'Closing heading'),
      A('endText', 'Closing text'),
    ],
  },
];

export const FIELDS = SECTIONS.flatMap((s) => s.fields.filter((f) => f.t !== 'file'));
export const LISTS = SECTIONS.flatMap((s) => s.lists || []);
export const DEFAULT_COLORS = { green: '#116e08', navy: '#001935', mint: '#f4f9f3' };

export function emptyData(keep = {}) {
  const d = { photo: '', attachments: [] };
  FIELDS.forEach((f) => (d[f.k] = f.t === 'color' ? DEFAULT_COLORS[f.k] : ''));
  LISTS.forEach((l) => (d[l.id] = []));
  return { ...d, ...keep };
}

/** Clean any loaded object (saved brief, localStorage) into the expected shape. */
export function normalize(o) {
  const d = emptyData();
  if (!o || typeof o !== 'object') return d;
  FIELDS.forEach((f) => { if (typeof o[f.k] === 'string') d[f.k] = o[f.k]; });
  LISTS.forEach((l) => {
    if (Array.isArray(o[l.id])) d[l.id] = o[l.id].slice(0, l.max).map((x) => Object.fromEntries(l.fields.map((f) => [f.k, String(x?.[f.k] ?? '')])));
  });
  d.photo = typeof o.photo === 'string' && o.photo.startsWith('data:image/') ? o.photo : '';
  d.attachments = normalizeAttachments(o.attachments);
  return d;
}

export const SAMPLE = normalize({
  agency: 'Brightside Studio', author: 'Alex', tagline: 'Shopify, AI agents and workflow automation', link: 'https://', pageUrl: '',
  ...DEFAULT_COLORS,
  kicker: 'Client case study · E-commerce',
  title: 'AI Support Agent for Order Tracking and Returns',
  deck: 'From answering every “where is my order?” message by hand to resolving routine questions automatically.',
  intro: 'We built an AI agent that read incoming customer messages, looked up live order data in Shopify, answered routine questions and handed complex cases to the support team.',
  byline: 'By Alex · Client name withheld for confidentiality',
  heroBtn: 'Explore the workflow',
  facts: [
    { label: 'Industry', value: 'D2C home goods' },
    { label: 'Core platforms', value: 'Shopify · OpenAI · n8n' },
    { label: 'Scope', value: 'Order status + returns' },
    { label: 'Channels', value: 'WhatsApp · Email · Web chat' },
  ],
  chHead: 'Too many routine questions, too little time for the hard ones.',
  chText: 'Most support messages asked the same few things: where an order was, how to start a return, or when a product would be back in stock. The team answered each one by hand by searching Shopify.\n\nThe order data was already there. What was missing was a connected process that could read a message, find the right order and reply — while still bringing a person in when it mattered.',
  chCards: [
    { title: 'Answer the routine fast', text: 'Reply to order-status and return questions with live order details, on the channel the customer used.' },
    { title: 'Escalate the rest cleanly', text: 'Pass anything unusual to the team with a summary, so nobody has to re-read the whole thread.' },
  ],
  buHead: 'One connected journey from message to resolution.',
  steps: [
    { title: 'Capture the message', text: 'WhatsApp, email and the website chat widget all fed into a single n8n workflow.' },
    { title: 'Understand the intent', text: 'OpenAI classified each message: order status, return, product question or something else.' },
    { title: 'Find the order', text: 'The workflow matched the customer to their Shopify orders by phone number or email.' },
    { title: 'Reply with real details', text: 'For routine questions, the agent replied with live status, tracking links and return eligibility.' },
    { title: 'Hand off when needed', text: 'Other messages became helpdesk tickets with a summary and a suggested reply for the team.' },
    { title: 'Log everything', text: 'Every conversation and action was logged so the team could review what the agent said.' },
  ],
  wfHead: 'From a new message to the right reply.',
  wfIntro: 'The intent of the message decides which path it takes.',
  trunk: [
    { title: 'Customer sends a message', sub: 'WhatsApp, email or chat widget' },
    { title: 'n8n receives the message', sub: 'Normalises channel and customer details' },
    { title: 'OpenAI classifies the intent', sub: 'Order status, return, product question or other' },
  ],
  decTitle: 'Is it a routine order question?', decSub: 'Tag the conversation by intent',
  yesLabel: 'Yes · routine question', noLabel: 'No · needs a person',
  yes: [
    { title: 'Agent looks up the order', sub: 'Live status, tracking and return eligibility' },
    { title: 'Personalised reply', sub: 'Sent on the same channel' },
    { title: 'Conversation resolved', sub: 'Logged in the helpdesk' },
  ],
  no: [
    { title: 'Ticket created for the team', sub: 'Summary + suggested reply attached' },
    { title: 'Support agent responds', sub: 'Human handoff' },
  ],
  sepLabel: 'Separate entry point · returns page',
  sep: [{ title: 'Customer starts a return on the website' }, { title: 'Agent checks eligibility and sends the label' }],
  wfCaption: 'Workflow based on the delivered project. The returns page is shown separately from message handling.',
  wfNote: '“Routine” meant order status and standard returns. Refund decisions always stayed with a person.',
  exKicker: 'Returns page', exHead: 'Returns got a self-serve path, too.',
  exText: 'Some customers went straight to the returns page instead of messaging. We connected that page to the same workflow, so eligibility checks and return labels were handled the same way as in chat.',
  toHead: 'The role of each platform.',
  tools: [
    { name: 'Shopify', role: 'Orders, customers, fulfilment status and return records.' },
    { name: 'OpenAI', role: 'Intent classification and natural, on-brand replies.' },
    { name: 'n8n', role: 'Orchestration connecting the channels, Shopify and the helpdesk.' },
    { name: 'Messaging channels', role: 'WhatsApp Cloud API, Gmail and the website chat widget.' },
  ],
  stack: 'Shopify Admin API, OpenAI API, n8n, WhatsApp Cloud API, Gmail API',
  hosting: 'n8n self-hosted on a DigitalOcean droplet\nDocker + Nginx, SSL via Cloudflare\nDaily workflow backups',
  ouHead: 'More of the team’s time spent on the conversations that need them.',
  ouText: 'The agent took on the repetitive lookups and replies. The team now starts each day with a shorter queue of genuine cases, each with a summary attached.',
  ouNote: 'Results context: Outcomes are qualitative and based on the project account. No measured time savings or conversion changes are claimed.',
  faHead: 'A closer look at the implementation.',
  faq: [
    { q: 'How did the agent know which order a customer meant?', a: 'It matched the phone number or email on the message to the customer’s Shopify orders and asked a short question if there were several.' },
    { q: 'What happened to messages it couldn’t handle?', a: 'They became helpdesk tickets with a summary and a suggested reply for the team.' },
    { q: 'Could the agent issue refunds?', a: 'No. Refund decisions always stayed with a person.' },
  ],
  barTitle: 'Want a similar AI agent for your business?',
  barText: 'Talk with Alex about your support, follow-up and order workflows.',
  btnLabel: 'Schedule a call',
  endHead: 'Connect every customer message to the right next step.',
  endText: 'We help businesses build Shopify workflows and AI agents around their own rules, channels and team. Bring your current setup and we can talk through what the system needs to handle.',
});
