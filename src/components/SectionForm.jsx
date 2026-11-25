import Field from './Field.jsx';
import ListEditor from './ListEditor.jsx';
import DocumentAttachments from './DocumentAttachments.jsx';
import { readImage } from '../exporters.js';

export default function SectionForm({ section, data, setField, setList, onAddAttachments }) {
  const short = section.fields.filter((f) => f.t !== 'area');
  const long = section.fields.filter((f) => f.t === 'area');

  return (
    <fieldset id={`s-${section.id}`}>
      <legend>{section.name}</legend>
      {section.id === 'attachments' && (
        <DocumentAttachments files={data.attachments} onAdd={onAddAttachments}
          onChange={(files) => setField('attachments', files)} />
      )}
      {short.length > 0 && (
        <div className="row">
          {short.map((f) =>
            f.t === 'file' ? (
              <label key={f.k}>
                {f.label}
                <div className="photo">
                  {data.photo && <img src={data.photo} alt="" />}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (file) setField('photo', await readImage(file));
                      e.target.value = '';
                    }}
                  />
                  {data.photo && <button type="button" onClick={() => setField('photo', '')}>Remove</button>}
                </div>
              </label>
            ) : (
              <label key={f.k}>
                {f.label}
                <Field field={f} value={data[f.k]} onChange={(v) => setField(f.k, v)} />
              </label>
            )
          )}
        </div>
      )}
      {long.map((f) => (
        <label key={f.k}>
          <span>
            {f.label} {f.hint && <small>{f.hint}</small>}
          </span>
          <Field field={f} value={data[f.k]} onChange={(v) => setField(f.k, v)} />
        </label>
      ))}
      {(section.lists || []).map((l) => (
        <ListEditor key={l.id} list={l} items={data[l.id]} onChange={(items) => setList(l.id, items)} />
      ))}
    </fieldset>
  );
}
