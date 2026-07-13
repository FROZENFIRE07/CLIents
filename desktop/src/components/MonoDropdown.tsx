import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

type Option = {
  label: string;
  value: string;
};

type MonoDropdownProps = {
  label: string;
  value: string;
  options: Option[];
  placeholder?: string;
  onChange: (value: string) => void;
  minWidth?: number;
};

export default function MonoDropdown({
  label,
  value,
  options,
  placeholder = 'Select…',
  onChange,
  minWidth = 180,
}: MonoDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label || placeholder,
    [options, placeholder, value]
  );

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <div className="form-group" style={{ marginBottom: 0, minWidth, position: 'relative' }} ref={rootRef}>
      <label>{label}</label>
      <button
        type="button"
        className="mono-dropdown-trigger"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="mono-dropdown-value">{selectedLabel}</span>
        <ChevronDown size={16} strokeWidth={2} />
      </button>
      {open && (
        <div className="mono-dropdown-menu" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`mono-dropdown-option ${option.value === value ? 'mono-dropdown-option--active' : ''}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}