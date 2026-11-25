import { acceptsAttachment } from './ai/attachments.js';

const MAX_BYTES = 24 * 1024 * 1024;
export const isImage = (file) => file.type.startsWith('image/');

export function normalizeAttachments(files) {
  if (!Array.isArray(files)) return [];
  return files.filter((file) => file && typeof file.id === 'string' && typeof file.name === 'string'
    && acceptsAttachment('gemini', file.type) && typeof file.data === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(file.data)
    && file.data.length % 4 === 0)
    .map(({ id, name, type, data, placement, layout, text }) => ({ id, name, type, data,
      ...(isImage({ type }) && {
        layout: layout === 'full' || layout === 'text' ? layout : 'pair',
        text: typeof text === 'string' ? text : '',
      }),
      placement: placement === 'hero' && type.startsWith('image/') ? 'hero' : 'appendix' }));
}

export function includeAttachments(current, files, placement = 'appendix') {
  const merged = new Map(current.map((file) => [file.id, file]));
  for (const { id, name, type, data } of files) {
    const target = placement === 'hero' && type.startsWith('image/') ? 'hero' : 'appendix';
    merged.set(id, { ...merged.get(id), id, name, type, data, placement: target });
  }
  const next = [...merged.values()];
  if (next.reduce((total, file) => total + file.data.length, 0) > MAX_BYTES * 4 / 3) {
    throw new Error('Case study attachments exceed 24 MB. Remove a file in the Form tab and try again.');
  }
  return next;
}

function attachmentStorage(mode, operation) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('case-study-builder:media', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('draft');
    open.onerror = () => reject(open.error);
    open.onblocked = () => reject(new Error('Attachment storage is blocked.'));
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction('draft', mode);
      const request = operation(transaction.objectStore('draft'));
      transaction.oncomplete = () => { db.close(); resolve(request.result); };
      transaction.onabort = () => { db.close(); reject(transaction.error); };
    };
  });
}

export const loadDraftAttachments = () => attachmentStorage('readonly', (store) => store.get('files'));
export const saveDraftAttachments = (files) => attachmentStorage('readwrite', (store) => store.put(files, 'files'));
