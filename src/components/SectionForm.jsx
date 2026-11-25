import { useRef, useState } from 'react';
import Field from './Field.jsx';
import ListEditor from './ListEditor.jsx';
import DocumentAttachments from './DocumentAttachments.jsx';
import { readImage } from '../exporters.js';

const SECTION_DRAG_TYPE = 'application/x-case-study-section';

export default function SectionForm({ section, data, setField, setList, onAddAttachments, onMove, previousId, nextId }) {
  const photoInput = useRef(null);
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const short = section.fields.filter((f) => f.t !== 'area');
  const long = section.fields.filter((f) => f.t === 'area');

  const choosePhoto = async (event) => {
    const input = event.currentTarget;
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    setPhotoError('');
    setReadingPhoto(true);
    try {
      const photo = await readImage(file);
      if (!photo) throw new Error('The image could not be opened.');
      if (input.isConnected) setField('photo', photo);
    } catch {
      setPhotoError('Couldn’t open this image. Try a JPG or PNG.');
    } finally {
      setReadingPhoto(false);
    }
  };

  return (
    <fieldset id={`s-${section.id}`}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(SECTION_DRAG_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        event.currentTarget.classList.add('section-drop-target');
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.classList.remove('section-drop-target');
      }}
      onDragEnd={(event) => event.currentTarget.classList.remove('section-drop-target')}
      onDrop={(event) => {
        event.currentTarget.classList.remove('section-drop-target');
        const source = event.dataTransfer.getData(SECTION_DRAG_TYPE);
        if (!source) return;
        event.preventDefault();
        onMove(source, section.id);
      }}>
      <legend>
        {section.name}
        <button type="button" className="section-handle" draggable aria-label={`Reorder ${section.name} with Up or Down`}
          title="Drag to reorder or use the arrow keys"
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData(SECTION_DRAG_TYPE, section.id);
          }}
          onKeyDown={(event) => {
            const target = { ArrowUp: previousId, ArrowDown: nextId }[event.key];
            if (!target) return;
            event.preventDefault();
            onMove(section.id, target);
          }}>⠿</button>
      </legend>
      {section.id === 'attachments' && (
        <DocumentAttachments files={data.attachments} onAdd={onAddAttachments}
          onChange={(files) => setField('attachments', files)} />
      )}
      {short.length > 0 && (
        <div className="row">
          {short.map((f) =>
            f.t === 'file' ? (
              <div className="photo-field" key={f.k}>
                <span id="brand-photo-label">{f.label}</span>
                <div className="photo">
                  {data.photo && <img src={data.photo} alt="" />}
                  <input ref={photoInput} type="file" accept="image/*" hidden onChange={choosePhoto} />
                  <button type="button" className="photo-change" aria-describedby="brand-photo-label" disabled={readingPhoto}
                    onClick={() => photoInput.current?.click()}>
                    {readingPhoto ? 'Reading…' : data.photo ? 'Change' : 'Add photo'}
                  </button>
                  {data.photo && (
                    <button type="button" className="photo-remove" aria-label="Remove photo" title="Remove photo" disabled={readingPhoto} onClick={() => {
                      setField('photo', '');
                      setPhotoError('');
                    }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 3v7m4-7v7" />
                      </svg>
                    </button>
                  )}
                </div>
                {photoError && <small className="photo-error" role="alert">{photoError}</small>}
              </div>
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
