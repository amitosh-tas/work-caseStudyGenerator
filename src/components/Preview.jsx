import { useEffect, useMemo, useRef, useState } from 'react';
import { caseStudyDocument } from '../renderCaseStudy.js';

const DESIGN_WIDTH = 1240;

/** Live preview: the real case study page in an iframe, scaled to fit the panel. */
export default function Preview({ data }) {
  const wrapRef = useRef(null);
  const frameRef = useRef(null);
  const [scale, setScale] = useState(0.5);
  const [height, setHeight] = useState(2000);

  const html = useMemo(() => caseStudyDocument(data, { fonts: true, forPdf: true }), [data]);

  useEffect(() => {
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / DESIGN_WIDTH));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const measure = () => {
    const doc = frameRef.current?.contentDocument;
    if (doc?.documentElement) setHeight(doc.documentElement.scrollHeight);
  };

  useEffect(() => {
    const t = setTimeout(measure, 300); // after fonts settle
    return () => clearTimeout(t);
  }, [html]);

  return (
    <div className="preview-frame" ref={wrapRef} style={{ height: height * scale }}>
      <iframe
        ref={frameRef}
        title="Case study preview"
        srcDoc={html}
        onLoad={measure}
        style={{ width: DESIGN_WIDTH, height, transform: `scale(${scale})` }}
      />
    </div>
  );
}
