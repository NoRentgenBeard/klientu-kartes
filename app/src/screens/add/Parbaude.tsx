import { repo } from '../../db/repo';
import type { Card, Holder } from '../../db/types';
import { lv } from '../../i18n/lv';
import type { ScanResult } from '../../scan/pipeline';
import { CardEditor, type EditorInit } from './CardEditor';

interface Props {
  scan: ScanResult;
  cards: Card[];
  holders: Holder[];
  onSaved: (card: Card) => void;
  onCancel: () => void;
}

/** Pārbaude — SPEC 6.5. The scan's guesses, to check; nothing is saved until "Apstiprināt". */
export function Parbaude({ scan, cards, holders, onSaved, onCancel }: Props) {
  const init: EditorInit = {
    company: scan.company?.value ?? '',
    companyFlag: !scan.company?.confident,
    codeFound: !!scan.code,
    codeValue: scan.code?.value ?? scan.numberFromText?.value ?? '',
    scannedFormat: scan.code?.format ?? null,
    numberFlag: !scan.code,
    holder: scan.holder?.value ?? null,
    holderFlag: !scan.holder?.confident,
    endDate: scan.endDate?.value ?? null,
    dateFlag: !!scan.endDate && !scan.endDate.confident,
    colorIndex: null,
    layoutIndex: null,
    photoOriginal: scan.photoOriginal,
    photoCropped: scan.photoCropped,
    crop: { size: scan.size, quad: scan.cropQuad, autoQuad: scan.autoQuad },
  };

  return (
    <CardEditor
      mode="new"
      title={lv.review}
      submitLabel={lv.accept}
      init={init}
      cards={cards}
      holders={holders}
      onCancel={onCancel}
      onSubmit={async (values) => onSaved(await repo.addCard(values))}
    />
  );
}
