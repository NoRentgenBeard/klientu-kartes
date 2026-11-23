import { useMemo, useState } from 'preact/hooks';
import { CardFace } from '../../cards/CardFace';
import { CodeView } from '../../codes/CodeView';
import { repo } from '../../db/repo';
import type { Card, CodeFormat, Holder, HolderId } from '../../db/types';
import { lv } from '../../i18n/lv';
import { formatForTypedNumber } from '../../lib/codes';
import { formatDate, parseEndDate } from '../../lib/dates';
import { useObjectUrl } from '../../lib/hooks';
import { defaultColorIndex, defaultLayoutIndex } from '../../lib/style';
import { cropToJpeg, readCodeIn, rotatePhoto, type ScanResult } from '../../scan/pipeline';
import { fullQuad, type Quad } from '../../scan/warp';
import { Apgriesana } from './Apgriesana';

interface Props {
  scan: ScanResult;
  cards: Card[];
  holders: Holder[];
  onSaved: (card: Card) => void;
  onCancel: () => void;
}

const COLORS = [0, 1, 2, 3, 4, 5, 6, 7];

/** Pārbaude — SPEC 6.5. Nothing is saved until "Apstiprināt". */
export function Parbaude({ scan, cards, holders, onSaved, onCancel }: Props) {
  const scannedNumber = scan.code?.value ?? scan.numberFromText?.value ?? '';

  const [company, setCompany] = useState(scan.company?.value ?? '');
  const [companyFlag, setCompanyFlag] = useState(!scan.company?.confident);

  const [codeFound, setCodeFound] = useState(!!scan.code);
  const [codeValue, setCodeValue] = useState(scannedNumber);
  const [scannedFormat, setScannedFormat] = useState<CodeFormat | null>(scan.code?.format ?? null);
  const [numberFlag, setNumberFlag] = useState(!scan.code);

  const [holder, setHolder] = useState<HolderId | null>(scan.holder?.value ?? null);
  const [holderFlag, setHolderFlag] = useState(!scan.holder?.confident);

  const [noEndDate, setNoEndDate] = useState(!scan.endDate);
  const [dateText, setDateText] = useState(scan.endDate ? formatDate(scan.endDate.value) : '');
  const [dateFlag, setDateFlag] = useState(!!scan.endDate && !scan.endDate.confident);

  const [colorPicked, setColorPicked] = useState<number | null>(null);

  const [photoOriginal, setPhotoOriginal] = useState(scan.photoOriginal);
  const [photoCropped, setPhotoCropped] = useState(scan.photoCropped);
  const [quad, setQuad] = useState<Quad>(scan.cropQuad);
  const [autoQuad, setAutoQuad] = useState<Quad>(scan.autoQuad);
  const [size, setSize] = useState(scan.size);
  const [cropping, setCropping] = useState(false);
  const [saving, setSaving] = useState(false);

  const croppedUrl = useObjectUrl(photoCropped);

  const codeFormat: CodeFormat = codeFound && scannedFormat ? scannedFormat : formatForTypedNumber(codeValue);
  const parsedDate = noEndDate ? null : parseEndDate(dateText);
  const dateInvalid = !noEndDate && dateText.trim() !== '' && !parsedDate;

  const colorIndex =
    colorPicked ?? (holder ? defaultColorIndex(company || '?', holder, cards) : defaultColorIndex(company || '?', 'pe', cards));

  const preview: Card = useMemo(
    () => ({
      id: 'preview',
      company: company.trim() || '—',
      holder: holder ?? 'pe',
      codeValue,
      codeFormat,
      codeSource: codeFound ? 'scanned' : 'typed',
      endDate: parsedDate,
      colorIndex,
      layoutIndex: defaultLayoutIndex(company || '?'),
      pinned: false,
      photoOriginal,
      photoCropped,
      createdAt: '',
      updatedAt: '',
    }),
    [company, holder, codeValue, codeFormat, codeFound, parsedDate, colorIndex, photoOriginal, photoCropped],
  );

  const canSave = !!company.trim() && !!codeValue.trim() && !!holder && !dateInvalid && (noEndDate || !!parsedDate) && !saving;

  const save = async () => {
    if (!canSave || !holder) return;
    setSaving(true);
    try {
      const card = await repo.addCard({
        company: company.trim(),
        holder,
        codeValue: codeValue.trim(),
        codeFormat,
        codeSource: codeFound ? 'scanned' : 'typed',
        endDate: parsedDate,
        colorIndex,
        photoOriginal,
        photoCropped,
      });
      onSaved(card);
    } finally {
      setSaving(false);
    }
  };

  const applyCrop = async (newQuad: Quad, rotatedOriginal?: Blob) => {
    setCropping(false);
    let original = photoOriginal;
    if (rotatedOriginal) {
      original = rotatedOriginal;
      setPhotoOriginal(rotatedOriginal);
      setSize({ width: size.height, height: size.width });
      setAutoQuad(fullQuad(size.height, size.width));
    }
    setQuad(newQuad);
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

  if (cropping) {
    return (
      <Apgriesana
        photo={photoOriginal}
        size={size}
        quad={quad}
        autoQuad={autoQuad}
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
          {lv.review}
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
            <div class="review__crop">
              {croppedUrl && <img src={croppedUrl} alt="" />}
            </div>
          ) : (
            <p class="review__nocode">{lv.noCodeFound}</p>
          )}
          <button type="button" class="review__link" onClick={() => setCropping(true)}>
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
                class={`review__input${(dateFlag || dateInvalid) ? ' review__input--flag' : ''}`}
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
      </div>

      <footer class="review__footer">
        {!canSave && !saving && <p class="review__hint">{lv.acceptHint}</p>}
        <button type="button" class="btn-primary" disabled={!canSave} onClick={save}>
          {lv.accept}
        </button>
      </footer>
    </div>
  );
}

function Section({
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
