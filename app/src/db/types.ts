/** Data model — SPEC 4, with the code-format extension agreed in DECISIONS.md (D1). */

export type HolderId = 'pe' | 'hf' | 'zj'; // Personīgā, Happy Fish, Zaļā josta

export interface Holder {
  id: HolderId;
  name: string;
  /** Fixed sort order: pe=0, hf=1, zj=2. */
  order: number;
}

/**
 * Exact symbology as detected by the scanner, so the generated code matches the
 * original card (e.g. Code 39 stays Code 39). Auto-detected, not user-edited.
 */
export type CodeFormat =
  | 'code128'
  | 'code39'
  | 'code93'
  | 'codabar'
  | 'ean13'
  | 'ean8'
  | 'upca'
  | 'upce'
  | 'itf'
  | 'qr'
  | 'datamatrix'
  | 'pdf417'
  | 'aztec'
  | 'other';

export const CODE_FORMATS_2D: readonly CodeFormat[] = ['qr', 'datamatrix', 'pdf417', 'aztec'];

export interface Card {
  id: string;
  company: string; // "DEPO"
  holder: HolderId;
  codeValue: string; // source of truth for the generated code
  codeFormat: CodeFormat;
  codeSource: 'scanned' | 'typed';
  /** ISO "2027-09-30"; null = Bez termiņa. Month/year only → last day of month. */
  endDate: string | null;
  colorIndex: number; // 0–7
  layoutIndex: number; // 0–7
  pinned: boolean;
  pinOrder?: number;
  photoOriginal: Blob; // uncropped photo/screenshot
  photoCropped: Blob; // perspective-corrected card/code crop
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** What the add flow / seed provides; the repo fills id, timestamps and default style. */
export type NewCard = Omit<Card, 'id' | 'createdAt' | 'updatedAt' | 'colorIndex' | 'layoutIndex' | 'pinned'> &
  Partial<Pick<Card, 'colorIndex' | 'layoutIndex' | 'pinned'>>;

export const HOLDER_ORDER: readonly HolderId[] = ['pe', 'hf', 'zj'];
export const MAX_PINNED = 4;
export const SCHEMA_VERSION = 1;
