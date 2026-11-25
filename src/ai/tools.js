import { FIELDS, LISTS, SECTIONS } from '../schema.js';
import { includeAttachments } from '../caseStudyAttachments.js';

export const TOOL_NAME = 'update_case_study';
export const TOOL_DESCRIPTION =
  'Save content into the case study draft. Include only the keys you want to set or change. ' +
  'Text fields are plain strings (use a blank line between paragraphs). A list replaces the whole existing list, so send every item you want to keep. ' +
  'Call this whenever the user has confirmed new information, and whenever they ask for a change.';

const BRAND_KEYS = new Set(['green', 'navy', 'mint']);

/** JSON schema for the patch object, generated from the form schema. */
export function patchSchema() {
  const properties = {};
  FIELDS.filter((f) => !BRAND_KEYS.has(f.k)).forEach((f) => {
    properties[f.k] = { type: 'string', description: f.label };
  });
  LISTS.forEach((l) => {
    properties[l.id] = {
      type: 'array',
      description: `${l.name} (max ${l.max})`,
      items: {
        type: 'object',
        properties: Object.fromEntries(l.fields.map((f) => [f.k, { type: 'string', description: f.label }])),
      },
    };
  });
  properties.includeAttachments = {
    type: 'array',
    description: 'Files to add to the document when the user explicitly asks. Use an available attachment ID from the conversation.',
    items: {
      type: 'object',
      properties: { id: { type: 'string' }, placement: { type: 'string', enum: ['hero', 'appendix'] } },
      required: ['id', 'placement'],
    },
  };
  return { type: 'object', properties };
}

/** Apply a patch from the AI to the draft, ignoring anything unknown. Returns [newData, changedKeys]. */
export function applyPatch(data, patch, available = []) {
  if (!patch || typeof patch !== 'object') return [data, []];
  const next = { ...data };
  const changed = [];
  const requested = Array.isArray(patch.includeAttachments) ? patch.includeAttachments : [];
  for (const item of requested) {
    const file = available.find((candidate) => candidate.id && candidate.id === item?.id && candidate.data);
    if (!file) throw new Error('The requested attachment is unavailable. Ask the user to upload it again.');
    next.attachments = includeAttachments(next.attachments || [], [file], item.placement);
    if (!changed.includes('attachments')) changed.push('attachments');
  }
  FIELDS.forEach((f) => {
    if (typeof patch[f.k] === 'string' && !BRAND_KEYS.has(f.k)) { next[f.k] = patch[f.k]; changed.push(f.k); }
  });
  LISTS.forEach((l) => {
    if (Array.isArray(patch[l.id])) {
      next[l.id] = patch[l.id].slice(0, l.max).map((x) => Object.fromEntries(l.fields.map((f) => [f.k, String(x?.[f.k] ?? '')])));
      changed.push(l.id);
    }
  });
  return [next, changed];
}

/** Which sections have content (for the progress list). */
export function sectionProgress(data) {
  return SECTIONS.filter((s) => s.id !== 'brand' && (s.id !== 'attachments' || data.attachments?.length)).map((s) => {
    if (s.id === 'attachments') return { id: s.id, name: s.name, state: 'done' };
    const keys = s.fields.filter((f) => f.t !== 'color' && f.t !== 'file').map((f) => f.k);
    const filledFields = keys.filter((k) => String(data[k] || '').trim()).length;
    const filledLists = (s.lists || []).filter((l) => (data[l.id] || []).some((o) => Object.values(o).some((v) => String(v).trim()))).length;
    const total = keys.length + (s.lists || []).length;
    const done = filledFields + filledLists;
    return { id: s.id, name: s.name, state: done === 0 ? 'empty' : done >= Math.ceil(total * 0.6) ? 'done' : 'partial' };
  });
}

/** A compact description of the fields, for the system prompt. */
export function fieldGuide() {
  return SECTIONS.filter((s) => s.id !== 'brand' && s.id !== 'attachments').map((s) => {
    const f = s.fields.map((x) => `${x.k} (${x.label})`).join(', ');
    const l = (s.lists || []).map((x) => `${x.id}[] {${x.fields.map((y) => y.k).join(', ')}} (${x.name}, max ${x.max})`).join('; ');
    return `- ${s.name}: ${f}${l ? '; lists: ' + l : ''}`;
  }).join('\n');
}
