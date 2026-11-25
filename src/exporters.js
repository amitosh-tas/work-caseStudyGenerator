import { caseStudyBody, caseStudyCss, caseStudyDocument, fileSlug } from './renderCaseStudy.js';

const PAGE_WIDTH = 1240; // desktop width the design is rendered at

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadHtml(data) {
  downloadBlob(new Blob([caseStudyDocument(data, { fonts: true })], { type: 'text/html' }), `${fileSlug(data)}.html`);
}

export function downloadBrief(data) {
  downloadBlob(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), `${fileSlug(data)}-brief.json`);
}

/**
 * Renders the case study off-screen at desktop width and saves it as a PDF.
 * mode 'long': one continuous page, exactly like the web design.
 * mode 'a4':   the same render sliced into A4 pages, breaking between sections where possible.
 */
export async function downloadPdf(data, mode = 'long', onProgress = () => {}) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${PAGE_WIDTH}px;background:#fff`;
  host.innerHTML = `<style>${caseStudyCss(data)}\n.ma-case summary{list-style:none}.ma-case summary::-webkit-details-marker{display:none}</style><article class="ma-case">${caseStudyBody(data, { forPdf: true })}</article>`;
  document.body.appendChild(host);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    await Promise.all([...host.querySelectorAll('img')].map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r)))));
    const el = host.querySelector('.ma-case');
    const heightPx = el.offsetHeight;
    // keep the canvas under ~16 MP so it works in every browser
    const scale = Math.min(2, Math.sqrt(16e6 / (PAGE_WIDTH * heightPx)));
    onProgress('Rendering…');
    const canvas = await html2canvas(el, { scale, backgroundColor: '#ffffff', logging: false, windowWidth: PAGE_WIDTH, width: PAGE_WIDTH, useCORS: true });

    let pdf;
    if (mode === 'a4') {
      // section boundaries (in canvas pixels) are the preferred cut points
      const cuts = [...el.querySelectorAll('.ma-section, .ma-card, .ma-node, .ma-faq')].map((n) => {
        const r = n.getBoundingClientRect(), top = el.getBoundingClientRect().top;
        return Math.round((r.top - top) * scale);
      });
      pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
      const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight();
      const sliceMax = Math.floor(canvas.width * (pageH / pageW));
      let y = 0, page = 0;
      while (y < canvas.height - 2) {
        let end = Math.min(y + sliceMax, canvas.height);
        if (end < canvas.height) {
          const best = cuts.filter((c) => c > y + sliceMax * 0.55 && c <= end).sort((a, b) => b - a)[0];
          if (best) end = best;
        }
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = end - y;
        slice.getContext('2d').drawImage(canvas, 0, y, canvas.width, end - y, 0, 0, canvas.width, end - y);
        if (page++) pdf.addPage();
        pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, (end - y) * (pageW / canvas.width));
        onProgress(`Page ${page}…`);
        y = end;
      }
    } else {
      let w = 595, h = (w * canvas.height) / canvas.width;
      if (h > 14000) { w = (w * 14000) / h; h = 14000; } // PDF page size limit
      pdf = new jsPDF({ unit: 'pt', format: [w, h], orientation: h >= w ? 'portrait' : 'landscape', compress: true });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, w, h);
    }
    pdf.save(`${fileSlug(data)}-case-study.pdf`);
  } finally {
    host.remove();
  }
}

/** Reads an image file, optionally square-cropped, as a compressed data URL. */
export function readImage(file, max = 320, square = true) {
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        let sx = 0, sy = 0, sw = im.width, sh = im.height;
        if (square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; }
        const k = Math.min(1, max / sw), c = document.createElement('canvas');
        c.width = sw * k; c.height = sh * k;
        c.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.88));
      };
      im.onerror = () => resolve('');
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
