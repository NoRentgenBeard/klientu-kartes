import type { Repo } from './repo';
import type { CodeFormat, HolderId } from './types';

/**
 * SPEC 9 sample data — fictional numbers, dev mode only.
 * EAN numbers were given valid check digits so the code generator accepts them (DECISIONS.md D3).
 */
export interface SampleCard {
  company: string;
  holder: HolderId;
  codeValue: string;
  codeFormat: CodeFormat;
  codeSource: 'scanned' | 'typed';
  endDate: string | null;
  pinned?: boolean;
}

export const SAMPLE_CARDS: readonly SampleCard[] = [
  { company: 'DEPO', holder: 'hf', codeValue: 'LV000012345', codeFormat: 'code128', codeSource: 'scanned', endDate: null, pinned: true },
  { company: 'DEPO', holder: 'zj', codeValue: 'LV000067890', codeFormat: 'code128', codeSource: 'scanned', endDate: null, pinned: true },
  { company: 'Drogas', holder: 'pe', codeValue: '2690012345671', codeFormat: 'ean13', codeSource: 'scanned', endDate: null, pinned: true },
  { company: 'PROMO Cash&Carry', holder: 'hf', codeValue: '9845000111222', codeFormat: 'code128', codeSource: 'scanned', endDate: null, pinned: true },
  { company: 'Ksenukai', holder: 'hf', codeValue: '800111222', codeFormat: 'code128', codeSource: 'typed', endDate: null },
  { company: 'JYSK', holder: 'zj', codeValue: '2400012345676', codeFormat: 'ean13', codeSource: 'scanned', endDate: null },
  { company: 'Cenu klubs', holder: 'pe', codeValue: 'L00012345', codeFormat: 'code128', codeSource: 'scanned', endDate: '2027-09-30' },
  { company: 'Denim Dream', holder: 'pe', codeValue: '9233000011112222', codeFormat: 'code128', codeSource: 'scanned', endDate: null },
  { company: 'Dino zoo', holder: 'pe', codeValue: '11223344', codeFormat: 'ean8', codeSource: 'scanned', endDate: null },
  { company: 'Douglas', holder: 'pe', codeValue: 'DGL-LV-0004417', codeFormat: 'qr', codeSource: 'scanned', endDate: null },
  { company: 'Peek & Cloppenburg', holder: 'pe', codeValue: '520300011122', codeFormat: 'qr', codeSource: 'scanned', endDate: null },
  { company: 'Apollo kino', holder: 'pe', codeValue: 'APOLLO-77310042', codeFormat: 'qr', codeSource: 'scanned', endDate: '2026-12-31' },
  { company: 'Mēness aptieka', holder: 'pe', codeValue: 'MA-2219034', codeFormat: 'qr', codeSource: 'scanned', endDate: '2026-09-30' },
  { company: 'XS toys', holder: 'pe', codeValue: 'XS-000358', codeFormat: 'qr', codeSource: 'scanned', endDate: null },
];

/** Makes a placeholder "photo" for a sample card (a canvas JPEG in the browser). */
export type PhotoFactory = (sample: SampleCard) => Promise<Blob>;

/** Fills an empty database with the sample cards. Returns how many were added. */
export async function seedIfEmpty(repo: Repo, makePhoto: PhotoFactory): Promise<number> {
  if ((await repo.countCards()) > 0) return 0;
  for (const sample of SAMPLE_CARDS) {
    const photo = await makePhoto(sample);
    const { pinned, ...rest } = sample;
    await repo.addCard({ ...rest, pinned, photoOriginal: photo, photoCropped: photo });
  }
  return SAMPLE_CARDS.length;
}
