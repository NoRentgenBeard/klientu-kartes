import { useState } from 'preact/hooks';
import { Sheet } from '../../components/Sheet';
import { repo } from '../../db/repo';
import type { Card, Holder } from '../../db/types';
import { deleteWarning, lv } from '../../i18n/lv';
import { formatDate, localIsoDate } from '../../lib/dates';
import { CardEditor, Section, type EditorInit, type EditorValues } from './CardEditor';

interface Props {
  /** The saved card (kept current by App, e.g. after pinning). */
  card: Card;
  /** When the card was used before this time on Kasē. */
  lastUsedAt: string | undefined;
  cards: Card[];
  holders: Holder[];
  onTogglePin: (card: Card) => void;
  onSaved: () => void;
  onDeleted: () => void;
  onClose: () => void;
}

/** Kartes detaļas — SPEC 6.6. The Pārbaude fields for a saved card, plus photo, last use, pin and delete. */
export function KartesDetalas({ card, lastUsedAt, cards, holders, onTogglePin, onSaved, onDeleted, onClose }: Props) {
  const [init] = useState<EditorInit>(() => ({
    company: card.company,
    companyFlag: false,
    codeFound: card.codeSource === 'scanned',
    codeValue: card.codeValue,
    scannedFormat: card.codeSource === 'scanned' ? card.codeFormat : null,
    numberFlag: false,
    holder: card.holder,
    holderFlag: false,
    endDate: card.endDate,
    dateFlag: false,
    colorIndex: card.colorIndex,
    layoutIndex: card.layoutIndex,
    photoOriginal: card.photoOriginal,
    photoCropped: card.photoCropped,
    crop: null,
  }));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const holder = holders.find((h) => h.id === card.holder);
  const name = holder && holder.id !== 'pe' ? `${card.company} · ${holder.name}` : card.company;

  const save = async (values: EditorValues) => {
    // Re-read so a pin change made while editing isn't undone.
    const latest = (await repo.getCard(card.id)) ?? card;
    await repo.updateCard({ ...latest, ...values });
    onSaved();
  };

  const remove = async () => {
    await repo.deleteCard(card.id);
    onDeleted();
  };

  return (
    <>
      <CardEditor
        mode="edit"
        title={lv.cardDetails}
        submitLabel={lv.save}
        init={init}
        cards={cards.filter((c) => c.id !== card.id)}
        holders={holders}
        onSubmit={save}
        onCancel={onClose}
      >
        <Section label={lv.lastUsed}>
          <p class="review__value">{lastUsedAt ? formatDate(localIsoDate(new Date(lastUsedAt))) : lv.never}</p>
        </Section>

        <section class="review__section">
          <label class="review__toggle review__toggle--row">
            <span>{lv.pin}</span>
            <input type="checkbox" role="switch" checked={card.pinned} onChange={() => onTogglePin(card)} />
            <span class="review__switch" aria-hidden="true" />
          </label>
        </section>

        <section class="review__section">
          <button type="button" class="review__delete" onClick={() => setConfirmDelete(true)}>
            {lv.delete}
          </button>
        </section>
      </CardEditor>

      {confirmDelete && (
        <Sheet
          title={lv.deleteTitle}
          text={deleteWarning(name)}
          onDismiss={() => setConfirmDelete(false)}
          actions={[
            { label: lv.delete, kind: 'destructive', onClick: () => void remove() },
            { label: lv.cancel, onClick: () => setConfirmDelete(false) },
          ]}
        />
      )}
    </>
  );
}
