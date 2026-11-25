const IMAGES = ['image/jpeg', 'image/png', 'image/webp'];
const PDF = 'application/pdf';
const GEMINI_MEDIA = ['audio/mpeg', 'audio/wav', 'video/mp4', 'video/webm'];
const MIME_BY_EXTENSION = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  pdf: PDF, mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'video/mp4', webm: 'video/webm',
};

export const MAX_FILES = 4;
export const MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024;
export const MAX_HISTORY_BYTES = 12 * 1024 * 1024;
export const ATTACHMENT_PROMPT = 'Review the attached files. Summarize what matters for the case study and ask me to confirm any facts you propose adding.';

function supportedTypes(kind) {
  if (kind === 'gemini') return [...IMAGES, PDF, ...GEMINI_MEDIA];
  if (kind === 'compat') return IMAGES;
  return [...IMAGES, PDF];
}

export const acceptsAttachment = (kind, type) => supportedTypes(kind).includes(type);
export const attachmentAccept = (kind) => Object.entries(MIME_BY_EXTENSION)
  .filter(([, type]) => acceptsAttachment(kind, type))
  .map(([extension]) => '.' + extension)
  .join(',');

export function describeAttachment(file, kind) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const type = Object.hasOwn(MIME_BY_EXTENSION, extension) ? MIME_BY_EXTENSION[extension] : file.type;
  if (!acceptsAttachment(kind, type)) throw new Error(`${file.name} is unsupported by this provider.`);
  if (!file.size) throw new Error(`${file.name} is empty.`);
  if (kind === 'anthropic' && IMAGES.includes(type) && file.size > 3 * 1024 * 1024) {
    throw new Error(`${file.name} exceeds the 3 MB image limit for Claude.`);
  }
  return { name: file.name, type, size: file.size };
}

export function readAttachment(file, metadata) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      ...metadata, id: Array.from(crypto.getRandomValues(new Uint32Array(2)), (part) => part.toString(36)).join('-'),
      data: reader.result.split(',')[1],
    });
    reader.onerror = reader.onabort = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

export const attachmentUrl = ({ type, data }) => `data:${type};base64,${data}`;
