import Field from './Field.jsx';

export default function ListEditor({ list, items, onChange }) {
  const update = (i, k, val) => onChange(items.map((it, j) => (j === i ? { ...it, [k]: val } : it)));
  const remove = (i) => onChange(items.filter((_, j) => j !== i));
  const add = () => onChange([...items, Object.fromEntries(list.fields.map((f) => [f.k, '']))]);
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="list">
      <h5>{list.name}</h5>
      {items.map((it, i) => (
        <div className="item" key={i}>
          <div className="item-fields">
            {list.fields.map((f) => (
              <Field key={f.k} field={f} value={it[f.k]} ariaLabel={`${list.name} ${i + 1} ${f.label}`} onChange={(v) => update(i, f.k, v)} />
            ))}
          </div>
          <div className="item-actions">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down">↓</button>
            <button type="button" onClick={() => remove(i)} aria-label="Remove">✕</button>
          </div>
        </div>
      ))}
      {items.length < list.max && (
        <button type="button" className="add" onClick={add}>+ Add</button>
      )}
    </div>
  );
}
