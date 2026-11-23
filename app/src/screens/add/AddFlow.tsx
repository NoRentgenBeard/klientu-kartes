import { useEffect, useRef, useState } from 'preact/hooks';
import type { Card, Holder } from '../../db/types';
import { lv } from '../../i18n/lv';
import { useObjectUrl } from '../../lib/hooks';
import { scanPhoto, warmUpOcr, type ScanResult, type StepId, type StepState } from '../../scan/pipeline';
import { Parbaude } from './Parbaude';
import './add.css';

interface Props {
  cards: Card[];
  holders: Holder[];
  onSaved: (card: Card) => void;
  onCancel: () => void;
}

type Stage = { name: 'pick' } | { name: 'processing'; file: File } | { name: 'review'; scan: ScanResult };

/** Pievienot karti → Apstrāde → Pārbaude (SPEC 6.5). */
export function AddFlow({ cards, holders, onSaved, onCancel }: Props) {
  const [stage, setStage] = useState<Stage>({ name: 'pick' });

  useEffect(() => warmUpOcr(), []);

  if (stage.name === 'pick') {
    return <Pievienot onFile={(file) => setStage({ name: 'processing', file })} onCancel={onCancel} />;
  }
  if (stage.name === 'processing') {
    return (
      <Apstrade
        file={stage.file}
        cards={cards}
        holders={holders}
        onDone={(scan) => setStage({ name: 'review', scan })}
        onCancel={onCancel}
        onRetry={() => setStage({ name: 'pick' })}
      />
    );
  }
  return <Parbaude scan={stage.scan} cards={cards} holders={holders} onSaved={onSaved} onCancel={onCancel} />;
}

/* ---------- Pievienot: camera or gallery ---------- */

function Pievienot({ onFile, onCancel }: { onFile: (f: File) => void; onCancel: () => void }) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const pick = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) onFile(file);
  };

  return (
    <div class="add-pick" role="dialog" aria-modal="true" aria-label={lv.addCard}>
      <div class="add-pick__backdrop" onClick={onCancel} />
      <div class="add-pick__sheet">
        <span class="add-grabber" aria-hidden="true" />
        <h2 class="add-pick__title">{lv.addCard}</h2>
        <div class="add-pick__options">
          <button type="button" class="add-pick__option" onClick={() => camera.current?.click()}>
            <CameraIcon />
            <span>{lv.takePhoto}</span>
          </button>
          <button type="button" class="add-pick__option" onClick={() => gallery.current?.click()}>
            <GalleryIcon />
            <span>{lv.fromGallery}</span>
          </button>
        </div>
        <button type="button" class="add-pick__cancel" onClick={onCancel}>
          {lv.cancel}
        </button>
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
        <input ref={gallery} type="file" accept="image/*" hidden onChange={pick} />
      </div>
    </div>
  );
}

/* ---------- Apstrāde: scanning progress ---------- */

const STEP_ORDER: StepId[] = ['code', 'text', 'date', 'holder'];

function Apstrade({
  file,
  cards,
  holders,
  onDone,
  onCancel,
  onRetry,
}: {
  file: File;
  cards: Card[];
  holders: Holder[];
  onDone: (scan: ScanResult) => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const url = useObjectUrl(file);
  const [steps, setSteps] = useState<Record<StepId, { state: StepState; detail?: string }>>({
    code: { state: 'waiting' },
    text: { state: 'waiting' },
    date: { state: 'waiting' },
    holder: { state: 'waiting' },
  });
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const companies = [...new Set(cards.map((c) => c.company))];
    scanPhoto(file, { companies, holders }, (step, state, detail) => {
      if (alive) setSteps((s) => ({ ...s, [step]: { state, detail } }));
    })
      .then((result) => alive && onDone(result))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [file]);

  const label = (id: StepId) => {
    const s = steps[id];
    switch (id) {
      case 'code':
        if (s.state === 'done') return s.detail === 'qr' ? lv.foundQr : lv.foundBarcode;
        if (s.state === 'failed') return lv.noCodeFound;
        return lv.searchingCode;
      case 'text':
        return lv.readingText;
      case 'date':
        return lv.findingEndDate;
      case 'holder':
        return lv.findingHolder;
    }
  };

  return (
    <div class="add-scan" role="dialog" aria-modal="true" aria-label={lv.addCard}>
      <div class="add-scan__top">
        <button type="button" class="add-scan__cancel" onClick={onCancel}>
          {lv.cancel}
        </button>
      </div>
      <div class="add-scan__photo">
        {url && <img src={url} alt="" />}
        <span class="add-scan__corner add-scan__corner--tl" />
        <span class="add-scan__corner add-scan__corner--tr" />
        <span class="add-scan__corner add-scan__corner--br" />
        <span class="add-scan__corner add-scan__corner--bl" />
        {!error && <span class="add-scan__line" />}
      </div>
      {error ? (
        <div class="add-scan__error">
          <p>{lv.imageUnreadable}</p>
          <button type="button" class="btn-primary add-scan__retry" onClick={onRetry}>
            {lv.addCard}
          </button>
        </div>
      ) : (
        <ul class="add-scan__steps" aria-live="polite">
          {STEP_ORDER.map((id) => (
            <li key={id} class={`add-step add-step--${steps[id].state}`}>
              <span class="add-step__mark" aria-hidden="true">
                {steps[id].state === 'done' ? '✓' : steps[id].state === 'failed' ? '–' : ''}
              </span>
              {label(id)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7">
      <rect x="3" y="6" width="18" height="14" rx="3" />
      <path d="M8.5 6l1.5-2.5h4L15.5 6" stroke-linejoin="round" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="9.5" r="1.8" />
      <path d="M3.5 17l5-5 4 4 3-3 5 5" />
    </svg>
  );
}
