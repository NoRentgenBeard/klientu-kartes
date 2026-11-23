import { useEffect, useRef, useState } from 'preact/hooks';
import { HolderTag } from '../cards/HolderTag';
import { Topo } from '../cards/Topo';
import { CodeView } from '../codes/CodeView';
import { repo } from '../db/repo';
import type { Card, Holder } from '../db/types';
import { lv } from '../i18n/lv';
import { formatDate } from '../lib/dates';
import { useMediaQuery, useObjectUrl, useWakeLock } from '../lib/hooks';
import './Kase.css';

interface Props {
  card: Card;
  /** Cards of the same store (including this one), in holder order. */
  siblings: Card[];
  holders: Holder[];
  onSwitch: (card: Card) => void;
  onTogglePin: (card: Card) => void;
  onDetails: (card: Card) => void;
  onClose: () => void;
}

type PhotoMode = 'off' | 'cropped' | 'original';

const LANDSCAPE = '(orientation: landscape) and (max-height: 540px)';
const CLOSE_DISTANCE = 110; // pt dragged down
const CLOSE_VELOCITY = 0.6; // pt per ms

/** Kasē — SPEC 6.2 (portrait sheet) and 6.3 (landscape). */
export function Kase({ card, siblings, holders, onSwitch, onTogglePin, onDetails, onClose }: Props) {
  const landscape = useMediaQuery(LANDSCAPE);
  const [photo, setPhoto] = useState<PhotoMode>('off');
  const [closing, setClosing] = useState(false);
  const holder = holders.find((h) => h.id === card.holder);
  const photoUrl = useObjectUrl(photo === 'original' ? card.photoOriginal : card.photoCropped);

  useWakeLock();

  useEffect(() => {
    void repo.markUsed(card.id);
    setPhoto('off');
  }, [card.id]);

  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 240);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const togglePhoto = () => setPhoto((p) => (p === 'off' ? 'cropped' : 'off'));
  const flipPhoto = () => setPhoto((p) => (p === 'cropped' ? 'original' : 'cropped'));

  const codeOrPhoto = (layout: 'portrait' | 'landscape') =>
    photo === 'off' ? (
      <CodeView value={card.codeValue} format={card.codeFormat} layout={layout} />
    ) : (
      <button type="button" class={`kase-photo kase-photo--${layout}`} onClick={flipPhoto} aria-label={lv.photo}>
        {photoUrl && <img src={photoUrl} alt="" draggable={false} />}
      </button>
    );

  if (landscape) {
    return (
      <div class="kase-land" role="dialog" aria-modal="true" aria-label={card.company}>
        <div class="kase-land__panel">
          <div class="kase-land__title">
            <span>{card.company}</span>
            <HolderTag holder={holder} size="sm" />
          </div>
          {codeOrPhoto('landscape')}
        </div>
        <button
          type="button"
          class={`kase-land__toggle${photo !== 'off' ? ' kase-land__toggle--code' : ''}`}
          onClick={togglePhoto}
        >
          {photo === 'off' ? lv.photo : lv.code}
        </button>
      </div>
    );
  }

  return (
    <div class={`kase-overlay${closing ? ' kase-overlay--closing' : ''}`}>
      <Sheet onClose={close} label={card.company}>
        <div class="kase-sheet__bar">
          <button type="button" class="kase-sheet__close sr-only" onClick={close}>
            {lv.close}
          </button>
          <span class="kase-grabber" aria-hidden="true" />
          <div class="kase-sheet__tools">
            <button
              type="button"
              class={`kase-tool${card.pinned ? ' kase-tool--on' : ''}`}
              aria-label={card.pinned ? lv.unpin : lv.pin}
              aria-pressed={card.pinned}
              onClick={() => onTogglePin(card)}
            >
              <PinIcon filled={card.pinned} />
            </button>
            <button type="button" class="kase-tool" aria-label={lv.cardDetails} onClick={() => onDetails(card)}>
              <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" fill="currentColor">
                <circle cx="4" cy="11" r="2" />
                <circle cx="11" cy="11" r="2" />
                <circle cx="18" cy="11" r="2" />
              </svg>
            </button>
          </div>
        </div>

        <article class="kase-card" style={{ background: `var(--card-${card.colorIndex})` }}>
          <Topo layoutIndex={card.layoutIndex} />
          <div class="kase-card__head">
            <h2 class="kase-card__name">{card.company}</h2>
            <HolderTag holder={holder} size="lg" />
          </div>
          <div class="kase-card__field">
            <span class="kase-card__label">{lv.validUntil}</span>
            <span class="kase-card__value">{card.endDate ? formatDate(card.endDate) : lv.noEndDate}</span>
          </div>
          {codeOrPhoto('portrait')}
        </article>

        <button
          type="button"
          class={`kase-photo-btn${photo !== 'off' ? ' kase-photo-btn--on' : ''}`}
          onClick={togglePhoto}
        >
          {photo === 'off' ? <PhotoIcon /> : <CodeIcon />}
          <span>{photo === 'off' ? lv.photo : lv.code}</span>
        </button>
        {siblings.length > 1 && (
          <div class="kase-holders" role="group" aria-label={lv.holder}>
            {siblings.map((s) => (
              <button
                key={s.id}
                type="button"
                class={`kase-holders__seg${s.id === card.id ? ' kase-holders__seg--on' : ''}`}
                aria-pressed={s.id === card.id}
                onClick={() => s.id !== card.id && onSwitch(s)}
              >
                {holders.find((h) => h.id === s.holder)?.name}
                {/* Two cards of this store for the same holder: tell them apart by the number. */}
                {siblings.filter((o) => o.holder === s.holder).length > 1 && ` ·${s.codeValue.slice(-4)}`}
              </button>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** Dark sheet that follows the finger and closes when swiped down far or fast enough. */
function Sheet({ children, onClose, label }: { children: preact.ComponentChildren; onClose: () => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; dy: number; active: boolean; moved: boolean } | null>(null);

  const setY = (dy: number, animate: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = animate ? 'transform 0.22s ease-out' : 'none';
    el.style.transform = dy > 0 ? `translateY(${dy}px)` : '';
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { y: e.clientY, t: e.timeStamp, dy: 0, active: false, moved: false };
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    d.dy = e.clientY - d.y;
    if (!d.active && d.dy > 8) {
      d.active = true;
      d.moved = true;
      ref.current?.setPointerCapture(e.pointerId);
    }
    if (d.active) setY(Math.max(0, d.dy), false);
  };

  const onPointerUp = (e: PointerEvent) => {
    const d = drag.current;
    if (!d?.active) {
      drag.current = null;
      return;
    }
    const velocity = d.dy / Math.max(1, e.timeStamp - d.t);
    if (d.dy > CLOSE_DISTANCE || velocity > CLOSE_VELOCITY) {
      setY(window.innerHeight, true);
      onClose();
    } else {
      setY(0, true);
    }
    // keep `moved` so the click that follows a drag is swallowed
    setTimeout(() => (drag.current = null), 0);
  };

  return (
    <div
      ref={ref}
      class="kase-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={(e) => {
        if (drag.current?.moved) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
    >
      {children}
    </div>
  );
}


function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 3h6l-1 6 4 4v2h-5v6l-1 1-1-1v-6H6v-2l4-4z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linejoin="round"
      />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8">
      <rect x="3" y="6" width="18" height="14" rx="3" />
      <path d="M8.5 6l1.5-2.5h4L15.5 6" stroke-linejoin="round" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <rect x="3" y="5" width="2" height="14" />
      <rect x="7" y="5" width="1" height="14" />
      <rect x="10" y="5" width="3" height="14" />
      <rect x="15" y="5" width="1" height="14" />
      <rect x="18" y="5" width="3" height="14" />
    </svg>
  );
}

