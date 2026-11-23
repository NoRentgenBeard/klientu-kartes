import { useMemo, useState } from 'preact/hooks';
import { CardFace } from '../../cards/CardFace';
import { CodeView } from '../../codes/CodeView';
import type { Card, CodeFormat, Holder, HolderId } from '../../db/types';
import { lv } from '../../i18n/lv';
import { formatForTypedNumber } from '../../lib/codes';
import { formatDate, parseEndDate } from '../../lib/dates';
import { useObjectUrl } from '../../lib/hooks';
import { defaultColorIndex, defaultLayoutIndex } from '../../lib/style';
import { cropToJpeg, decodeImage, readCodeIn, rotatePhoto } from '../../scan/pipeline';
import { fullQuad, type Quad } from '../../scan/warp';
import { Apgriesana } from './Apgriesana';
import './add.css';

/** Starting values; the *Flag fields mark what the scanner was unsure about ("Pārbaudi"). */
export interface EditorInit {
  company: string;
  companyFlag: boolean;
  /** true = the code was read from the photo; false = generated from the number. */
  codeFound: boolean;
  codeValue: string;
  scannedFormat: CodeFormat | null;
  numberFlag: boolean;
  holder: HolderId | null;
  holderFlag: boolean;
  endDate: string | null;
  dateFlag: boolean;
  /** null = the default colour for this store and holder. */
  colorIndex: number | null;
  layoutIndex: number | null;
  photoOriginal: Blob;
  photoCropped: Blob;
  /** Crop corners from the scan; null = whole photo (worked out when the crop editor opens). */
  crop: { size: { width: number; height: number }; quad: Quad; autoQuad: Quad } | null;
}

export type EditorValues = Pick<
  Card,
  | 'company'
  | 'holder'
  | 'codeValue'
  | 'codeFormat'
  | 'codeSource'
  | 'endDate'
  | 'colorIndex'
  | 'layoutIndex'
  | 'photoOriginal'
  | 'photoCropped'
>;

interface Props {
  mode: 'new' | 'edit';
  title: string;
  submitLabel: string;
  init: EditorInit;
  /** Other cards (for the default colour, so two cards of one store differ). */
  cards: readonly Card[];
  holders: Holder[];
  onSubmit: (values: EditorValues) => Promise<void>;
  onCancel: () => void;
  /** Extra sections under Krāsa (card details: photo, last use, pin, delete). */
  children?: preact.ComponentChildren;
}

const COLORS = [0, 1, 2, 3, 4, 5, 6, 7];

/**
 * The card form used by Pārbaude (new card, SPEC 6.5) and Kartes detaļas (edit, SPEC 6.6).
 * Nothing is saved until the bottom button.
 */
export function CardEditor({ mode, title, submitLabel, init, cards, holders, onSubmit, onCancel, children }: Props) {
  const [company, setCompany] = useState(init.company);
  const [companyFlag, setCompanyFlag] = useState(init.companyFlag);

  const [codeFound, setCodeFound] = useState(init.codeFound);
  const [codeValue, setCodeValue] = useState(init.codeValue);
  const [scannedFormat, setScannedFormat] = useState<CodeFormat | null>(init.scannedFormat);
  const [numberFlag, setNumberFlag] = useState(init.numberFlag);

  const [holder, setHolder] = useState<HolderId | null>(init.holder);
  const [holderFlag, setHolderFlag] = useState(init.holderFlag);

  const [noEndDate, setNoEndDate] = useState(!init.endDate);
  const [dateText, setDateText] = useState(init.endDate ? formatDate(init.endDate) : '');
  const [dateFlag, setDateFlag] = useState(init.dateFlag);

  const [colorPicked, setColorPicked] = useState<number | null>(init.colorIndex);

  const [photoOriginal, setPhotoOriginal] = useState(init.photoOriginal);
  const [photoCropped, setPhotoCropped] = useState(init.photoCropped);
  const [crop, setCrop] = useState(init.crop);
  const [cropping, setCropping] = useState(false);
  const [saving, setSaving] = useState(false);

  const croppedUrl = useObjectUrl(photoCropped);
  const originalUrl = useObjectUrl(mode === 'edit' ? photoOriginal : undefined);

  const codeFormat: CodeFormat = codeFound && scannedFormat ? scannedFormat : formatForTypedNumber(codeValue);
  const parsedDate = noEndDate ? null : parseEndDate(dateText);
  const dateInvalid = !noEndDate && dateText.trim() !== '' && !parsedDate;

  const colorIndex = colorPicked ?? defaultColorIndex(company || '?', holder ?? 'pe', cards);
  const layoutIndex = init.layoutIndex ?? defaultLayoutIndex(company || '?');

  const values: EditorValues = {
    company: company.trim(),
    holder: holder ?? 'pe',
    codeValue: codeValue.trim(),
    codeFormat,
    codeSource: codeFound ? 'scanned' : 'typed',
    endDate: parsedDate,
    colorIndex,
    layoutIndex,
    photoOriginal,
    photoCropped,
  };

  const preview: Card = useMemo(
    () => ({ ...values, company: values.company || '—', id: 'preview', pinned: false, createdAt: '', updatedAt: '' }),
    [company, holder, codeValue, codeFormat, codeFound, parsedDate, colorIndex, layoutIndex, photoOriginal, photoCropped],
  );

  const changed =
    mode === 'new' ||
    values.company !== init.company ||
    values.holder !== init.holder ||
    values.codeValue !== init.codeValue ||
    values.codeFormat !== (init.scannedFormat ?? formatForTypedNumber(init.codeValue)) ||
    values.endDate !== init.endDate ||
    values.colorIndex !== init.colorIndex ||
    photoOriginal !== init.photoOriginal ||
    photoCropped !== init.photoCropped;

  const valid = !!values.company && !!values.codeValue && !!holder && !dateInvalid && (noEndDate || !!parsedDate);
  const canSave = valid && changed && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setSaving(false);
    }
  };

  const openCrop = async () => {
    if (!crop) {
      // Editing a saved card: start from the whole photo.
      const img = await decodeImage(photoOriginal);
      const size = 'naturalWidth' in img ? { width: img.naturalWidth, height: img.naturalHeight } : { width: img.width, height: img.height };
      if ('close' in img) img.close();
      const whole = fullQuad(size.width, size.height);
      setCrop({ size, quad: whole, autoQuad: whole });
    }
    setCropping(true);
  };

  const applyCrop = async (newQuad: Quad, rotatedOriginal?: Blob) => {
    if (!crop) return;
    setCropping(false);
    let original = photoOriginal;
    let { size, autoQuad } = crop;
    if (rotatedOriginal) {
      original = rotatedOriginal;
      setPhotoOriginal(rotatedOriginal);
      size = { width: size.height, height: size.width };
      autoQuad = fullQuad(size.width, size.height);
    }
    setCrop({ size, quad: newQuad, autoQuad });
    const { blob, pixels } = await cropToJpeg(original, newQuad);
    setPhotoCropped(blob);
    // The new crop may show the code better: read it again.
    const found = await readCodeIn(pixels);
    if (found) {
      setCodeFound(true);
      setScannedFormat(found.format);
      setCodeValue(found.value);
      setNumberFlag(false);
    }
  };

  if (cropping && crop) {
    return (
      <Apgriesana
        photo={photoOriginal}
        size={crop.size}
        quad={crop.quad}
        autoQuad={crop.autoQuad}
        onRotate={rotatePhoto}
        onCancel={() => setCropping(false)}
        onDone={applyCrop}
      />
    );
  }

  return (
    <div class="review" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <header class="review__bar">
        <button type="button" class="review__cancel" onClick={onCancel}>
          {lv.cancel}
        </button>
        <h1 id="review-title" class="review__title">
          {title}
        </h1>
        <span class="review__spacer" />
      </header>

      <div class="review__body">
        <div class="review__preview">
          <CardFace card={preview} holder={holders.find((h) => h.id === preview.holder)} />
        </div>

        <Section label={lv.company} flagged={companyFlag}>
          <input
            class={`review__input${companyFlag ? ' review__input--flag' : ''}`}
            value={company}
            autocomplete="off"
            autocapitalize="words"
            enterkeyhint="done"
            onInput={(e) => {
              setCompany((e.currentTarget as HTMLInputElement).value);
              setCompanyFlag(false);
            }}
          />
        </Section>

        <Section label={lv.code} flagged={numberFlag && !!codeValue}>
          {codeFound ? (
            <div class="review__crop">{croppedUrl && <img src={croppedUrl} alt="" />}</div>
          ) : (
            mode === 'new' && <p class="review__nocode">{lv.noCodeFound}</p>
          )}
          <button type="button" class="review__link" onClick={() => void openCrop()}>
            {lv.recrop}
          </button>
          <label class="review__sublabel" for="review-number">
            {lv.number}
          </label>
          <input
            id="review-number"
            class={`review__input review__input--mono${numberFlag && codeValue ? ' review__input--flag' : ''}`}
            value={codeValue}
            inputmode={codeFound ? 'text' : 'numeric'}
            autocomplete="off"
            autocapitalize="characters"
            spellcheck={false}
            enterkeyhint="done"
            onInput={(e) => {
              setCodeValue((e.currentTarget as HTMLInputElement).value.replace(/\s+/g, ''));
              setNumberFlag(false);
            }}
          />
          {!codeFound && codeValue.trim() && (
            <div class="review__generated">
              <CodeView value={codeValue.trim()} format={codeFormat} layout="portrait" />
              <span class="review__caption">{lv.generatedFromNumber}</span>
            </div>
          )}
        </Section>

        <Section label={lv.holder} flagged={holderFlag}>
          <div class={`review__seg${holderFlag ? ' review__seg--flag' : ''}`} role="radiogroup" aria-label={lv.holder}>
            {holders.map((h) => (
              <button
                key={h.id}
                type="button"
                role="radio"
                aria-checked={holder === h.id}
                class={`review__seg-btn${holder === h.id ? ' review__seg-btn--on' : ''}`}
                onClick={() => {
                  setHolder(h.id);
                  setHolderFlag(false);
                }}
              >
                {h.name}
              </button>
            ))}
          </div>
        </Section>

        <Section label={lv.validUntil} flagged={dateFlag && !noEndDate}>
          <label class="review__toggle">
            <span>{lv.noEndDate}</span>
            <input
              type="checkbox"
              role="switch"
              checked={noEndDate}
              onChange={(e) => {
                setNoEndDate((e.currentTarget as HTMLInputElement).checked);
                setDateFlag(false);
              }}
            />
            <span class="review__switch" aria-hidden="true" />
          </label>
          {!noEndDate && (
            <>
              <input
                class={`review__input${dateFlag || dateInvalid ? ' review__input--flag' : ''}`}
                value={dateText}
                placeholder={lv.datePlaceholder}
                inputmode="numeric"
                autocomplete="off"
                enterkeyhint="done"
                onInput={(e) => {
                  setDateText((e.currentTarget as HTMLInputElement).value);
                  setDateFlag(false);
                }}
              />
              {parsedDate && dateText.trim() !== formatDate(parsedDate) && (
                <span class="review__caption">→ {formatDate(parsedDate)}</span>
              )}
              {dateInvalid && <span class="review__caption review__caption--warn">{lv.dateNotUnderstood}</span>}
            </>
          )}
        </Section>

        <Section label={lv.color}>
          <div class="review__swatches" role="radiogroup" aria-label={lv.color}>
            {COLORS.map((i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={colorIndex === i}
                aria-label={`${lv.color} ${i + 1}`}
                class={`review__swatch${colorIndex === i ? ' review__swatch--on' : ''}`}
                style={{ background: `var(--card-${i})` }}
                onClick={() => setColorPicked(i)}
              />
            ))}
          </div>
        </Section>

        {mode === 'edit' && (
          <Section label={lv.originalPhoto}>
            <div class="review__photo">{originalUrl && <img src={originalUrl} alt="" />}</div>
          </Section>
        )}

        {children}
      </div>

      <footer class="review__footer">
        {!valid && !saving && <p class="review__hint">{lv.acceptHint}</p>}
        <button type="button" class="btn-primary" disabled={!canSave} onClick={save}>
          {submitLabel}
        </button>
      </footer>
    </div>
  );
}

export function Section({
  label,
  flagged,
  children,
}: {
  label: string;
  flagged?: boolean;
  children: preact.ComponentChildren;
}) {
  return (
    <section class="review__section">
      <div class="review__label">
        <span>{label}</span>
        {flagged && (
          <span class="review__flag">
            <span class="review__flag-dot" aria-hidden="true" />
            {lv.check}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
