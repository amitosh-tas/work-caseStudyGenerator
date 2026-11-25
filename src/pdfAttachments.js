// jsPDF exposes serialization hooks for adding the PDF catalog's EmbeddedFiles name tree.
export function embedPdfAttachments(pdf, files) {
  if (!files.length) return;
  pdf.__private__.setPdfVersion('1.7');
  const { events, newObject, write } = pdf.internal;
  const nameAsHex = (name) => {
    let hex = 'FEFF';
    for (let i = 0; i < name.length; i++) hex += name.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
    return `<${hex}>`;
  };
  const entries = files.map((file, index) => ({ file, key: nameAsHex(`${index + 1}. ${file.name}`) }));
  entries.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  let tree;
  events.subscribe('putResources', () => {
    const names = entries.map(({ file, key }) => {
      const stream = newObject();
      pdf.__private__.putStream({
        data: atob(file.data),
        objectId: stream,
        additionalKeyValues: [
          { key: 'Type', value: '/EmbeddedFile' },
          { key: 'Subtype', value: '/' + file.type.replace('/', '#2F') },
        ],
      });
      write('endobj');
      const spec = newObject();
      write(`<< /Type /Filespec /F (attachment.${file.name.split('.').at(-1)?.replace(/[^a-z0-9]/gi, '') || 'bin'}) /UF ${nameAsHex(file.name)} /EF << /F ${stream} 0 R /UF ${stream} 0 R >> >>`);
      write('endobj');
      return `${key} ${spec} 0 R`;
    });
    tree = newObject();
    write(`<< /Names [${names.join(' ')}] >>`);
    write('endobj');
  });
  events.subscribe('putCatalog', () => write(`/Names << /EmbeddedFiles ${tree} 0 R >>`));
}
