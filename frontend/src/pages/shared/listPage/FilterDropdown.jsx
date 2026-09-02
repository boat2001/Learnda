import { useEffect, useRef, useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { playListPageToggleSound } from './toggleSound';

export default function FilterDropdown({ label, value, options = [], onChange }) {
  const rootRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption =
    options.find((option) => String(option.value) === String(value)) || options[0] || { value, label: 'Select' };

  useEffect(() => {
    const handlePointerDown = (event) => {
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div ref={rootRef} className={`learn-filter-field ${isOpen ? 'open' : ''}`}>
      <span>{label}</span>
      <button
        type="button"
        className="learn-filter-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() =>
          setIsOpen((prev) => {
            const nextIsOpen = !prev;
            playListPageToggleSound(nextIsOpen ? 'open' : 'close');
            return nextIsOpen;
          })
        }
      >
        <span className="learn-filter-trigger-text">{selectedOption.label}</span>
        <FiChevronDown className="learn-filter-chevron" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="learn-filter-menu" role="listbox" aria-label={`${label} options`}>
          {options.map((option) => {
            const selected = String(option.value) === String(value);
            return (
              <button
                key={`${label}-${option.value}`}
                type="button"
                role="option"
                aria-selected={selected}
                className={`learn-filter-option ${selected ? 'selected' : ''}`}
                onClick={() => {
                  playListPageToggleSound('select');
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
