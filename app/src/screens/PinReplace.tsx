import { CardFace } from '../cards/CardFace';
import type { Card, Holder } from '../db/types';
import { lv } from '../i18n/lv';
import './PinReplace.css';

interface Props {
  pinned: Card[];
  holders: Holder[];
  onChoose: (replace: Card) => void;
  onCancel: () => void;
}

/** SPEC 7: "If 4 are pinned, pinning another asks which to replace." */
export function PinReplace({ pinned, holders, onChoose, onCancel }: Props) {
  return (
    <div class="pin-replace" role="dialog" aria-modal="true" aria-labelledby="pin-replace-title">
      <div class="pin-replace__backdrop" onClick={onCancel} />
      <div class="pin-replace__sheet">
        <h2 id="pin-replace-title" class="pin-replace__title">
          {lv.pinFullTitle}
        </h2>
        <p class="pin-replace__text">{lv.pinFullText}</p>
        <div class="pin-replace__grid">
          {pinned.map((c) => (
            <CardFace
              key={c.id}
              card={c}
              holder={holders.find((h) => h.id === c.holder)}
              variant="tile"
              onOpen={onChoose}
            />
          ))}
        </div>
        <button type="button" class="pin-replace__cancel" onClick={onCancel}>
          {lv.cancel}
        </button>
      </div>
    </div>
  );
}
