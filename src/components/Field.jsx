export default function Field({ field, value, onChange, ariaLabel }) {
  const common = {
    value: value ?? '',
    placeholder: field.ph || undefined,
    'aria-label': ariaLabel,
    onChange: (e) => onChange(e.target.value),
  };
  if (field.t === 'area') return <textarea {...common} />;
  if (field.t === 'color') return <input type="color" {...common} />;
  return <input type="text" {...common} />;
}
