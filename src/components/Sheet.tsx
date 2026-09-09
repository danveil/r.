import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
export function Sheet({
  title,
  onClose,
  children,
  dirty = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  dirty?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [discard, setDiscard] = useState(false);
  const close = () => (dirty ? setDiscard(true) : onClose());
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
    document.body.classList.add('sheet-open');
    return () => {
      dialog.close();
      document.body.classList.remove('sheet-open');
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  return (
    <dialog
      className="sheet"
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const rect = ref.current.getBoundingClientRect();
          if (e.clientY < rect.top || e.clientX < rect.left || e.clientX > rect.right) close();
        }
      }}
    >
      <div className="sheet-handle" aria-hidden="true" />
      <header className="sheet-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="icon-button" aria-label="Close" onClick={close}>
          <Icon name="close" />
        </button>
      </header>
      {discard ? (
        <div className="stack">
          <p>Leave without saving your changes?</p>
          <button className="primary" onClick={() => setDiscard(false)}>
            Keep editing
          </button>
          <button className="danger-text" onClick={onClose}>
            Discard changes
          </button>
        </div>
      ) : (
        children
      )}
    </dialog>
  );
}
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p className="error" role="alert">
      {message}
    </p>
  ) : null;
}
export function Chips({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: readonly string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset className="chip-group">
      <legend>{title}</legend>
      <div className="chips">
        {options.map((option) => (
          <button
            type="button"
            key={option}
            className="chip"
            aria-pressed={selected.includes(option)}
            onClick={() =>
              onChange(
                selected.includes(option) ? selected.filter((s) => s !== option) : [...selected, option],
              )
            }
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
