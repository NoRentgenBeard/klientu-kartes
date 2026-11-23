import { useEffect } from 'preact/hooks';
import './Sheet.css';

export interface SheetAction {
  label: string;
  onClick: () => void;
  kind?: 'primary' | 'destructive' | 'plain';
  /** Small grey text under the button. */
  hint?: string;
  disabled?: boolean;
}

interface Props {
  title: string;
  text?: string;
  children?: preact.ComponentChildren;
  actions: SheetAction[];
  /** Tap outside / Escape. */
  onDismiss: () => void;
}

/** Dark bottom sheet with a title, optional text and stacked buttons (same look as PinReplace). */
export function Sheet({ title, text, children, actions, onDismiss }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onDismiss();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onDismiss]);

  return (
    <div class="sheet" role="alertdialog" aria-modal="true" aria-labelledby="sheet-title">
      <div class="sheet__backdrop" onClick={onDismiss} />
      <div class="sheet__panel">
        <h2 id="sheet-title" class="sheet__title">
          {title}
        </h2>
        {text && <p class="sheet__text">{text}</p>}
        {children}
        <div class="sheet__actions">
          {actions.map((a) => (
            <div key={a.label}>
              <button
                type="button"
                class={`sheet__btn sheet__btn--${a.kind ?? 'plain'}`}
                disabled={a.disabled}
                onClick={a.onClick}
              >
                {a.label}
              </button>
              {a.hint && <p class="sheet__hint">{a.hint}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
