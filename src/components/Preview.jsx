import { useEffect, useMemo, useRef, useState } from 'react';
import { caseStudyDocument } from '../renderCaseStudy.js';

const DESIGN_WIDTH = 1240;

/** Live preview: the real case study page in an iframe, scaled to fit the panel. */
export default function Preview({ data }) {
  const wrapRef = useRef(null);
  const contentObserver = useRef(null);
  const [scale, setScale] = useState(0.5);
  const [height, setHeight] = useState(2000);

  const html = useMemo(() => caseStudyDocument(data, { fonts: true, preview: true }), [data]);

  useEffect(() => {
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / DESIGN_WIDTH));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => contentObserver.current?.disconnect(), []);

  const measure = (event) => {
    contentObserver.current?.disconnect();
    const doc = event.currentTarget.contentDocument;
    const article = doc?.querySelector('.ma-case');
    if (!article) return;
    doc.documentElement.style.overflow = 'hidden';
    const resize = () => setHeight(Math.ceil(article.getBoundingClientRect().height));
    contentObserver.current = new ResizeObserver(resize);
    contentObserver.current.observe(article);
    resize();
  };

  return (
    <div className="preview-frame" ref={wrapRef} style={{ height: height * scale }}>
      <iframe
        title="Case study preview"
        srcDoc={html}
        onLoad={measure}
        style={{ width: DESIGN_WIDTH, height, transform: `scale(${scale})` }}
      />
    </div>
  );
}
