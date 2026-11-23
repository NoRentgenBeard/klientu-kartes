import { useRef, useState } from 'preact/hooks';
import { lv } from '../../i18n/lv';
import { useObjectUrl } from '../../lib/hooks';
import { fullQuad, type Point, type Quad } from '../../scan/warp';

interface Props {
  photo: Blob;
  size: { width: number; height: number };
  quad: Quad;
  /** The crop the scan suggested ("Atiestatīt" goes back to it). */
  autoQuad: Quad;
  onRotate: (photo: Blob) => Promise<Blob>;
  onCancel: () => void;
  /** New corners; `rotated` is the turned photo if the user rotated it. */
  onDone: (quad: Quad, rotated?: Blob) => void;
}

/** Apgriešana — drag 4 corners over the original photo (SPEC 6.5). */
export function Apgriesana({ photo, size: initialSize, quad: initialQuad, autoQuad, onRotate, onCancel, onDone }: Props) {
  const [image, setImage] = useState(photo);
  const [rotated, setRotated] = useState(false);
  const [size, setSize] = useState(initialSize);
  const [quad, setQuad] = useState<Quad>(initialQuad);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const url = useObjectUrl(image);
  const stage = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);

  const toImage = (e: PointerEvent): Point => {
    const r = stage.current!.getBoundingClientRect();
    return {
      x: Math.min(size.width, Math.max(0, ((e.clientX - r.left) / r.width) * size.width)),
      y: Math.min(size.height, Math.max(0, ((e.clientY - r.top) / r.height) * size.height)),
    };
  };

  const onHandleDown = (i: number) => (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = i;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: PointerEvent) => {
    const i = dragging.current;
    if (i === null) return;
    const p = toImage(e);
    setQuad((q) => q.map((c, k) => (k === i ? p : c)) as Quad);
  };
  const onHandleUp = () => (dragging.current = null);

  const rotate = async () => {
    setBusy(true);
    try {
      const turned = await onRotate(image);
      setImage(turned);
      setRotated(true);
      const next = { width: size.height, height: size.width };
      setSize(next);
      setQuad(fullQuad(next.width, next.height));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => setQuad(rotated ? fullQuad(size.width, size.height) : autoQuad);

  const pct = (p: Point) => ({ left: `${(p.x / size.width) * 100}%`, top: `${(p.y / size.height) * 100}%` });
  const polygon = quad.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div class="crop" role="dialog" aria-modal="true" aria-label={lv.crop}>
      <div class="crop__viewport">
        <div
          ref={stage}
          class="crop__stage"
          style={{
            // Fit the whole photo at zoom 1 (by width or height), then grow with the slider.
            width: `calc(${zoom} * min(100cqw - 48px, (100cqh - 48px) * ${size.width / size.height}))`,
            aspectRatio: `${size.width} / ${size.height}`,
          }}
        >
          {url && <img src={url} alt="" draggable={false} />}
          <svg class="crop__overlay" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" aria-hidden="true">
            <path
              d={`M0 0H${size.width}V${size.height}H0Z M${polygon.replace(/ /g, ' L')}Z`}
              fill="rgb(0 0 0 / 0.55)"
              fill-rule="evenodd"
            />
            <polygon points={polygon} fill="none" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke" />
          </svg>
          {quad.map((p, i) => (
            <span
              key={i}
              class="crop__handle"
              style={pct(p)}
              onPointerDown={onHandleDown(i)}
              onPointerMove={onHandleMove}
              onPointerUp={onHandleUp}
              onPointerCancel={onHandleUp}
            />
          ))}
        </div>
      </div>

      <div class="crop__tools">
        <label class="crop__zoom">
          <span class="sr-only">{lv.zoom}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="10.5" cy="10.5" r="6" />
            <path d="M15 15l5 5" stroke-linecap="round" />
          </svg>
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onInput={(e) => setZoom(Number((e.currentTarget as HTMLInputElement).value))}
          />
        </label>
        <div class="crop__buttons">
          <button type="button" class="crop__tool" onClick={rotate} disabled={busy}>
            {lv.rotate90}
          </button>
          <button type="button" class="crop__tool" onClick={reset} disabled={busy}>
            {lv.reset}
          </button>
        </div>
      </div>

      <div class="crop__bar">
        <button type="button" class="crop__cancel" onClick={onCancel}>
          {lv.cancel}
        </button>
        <button type="button" class="crop__done" onClick={() => onDone(quad, rotated ? image : undefined)} disabled={busy}>
          {lv.done}
        </button>
      </div>
    </div>
  );
}
