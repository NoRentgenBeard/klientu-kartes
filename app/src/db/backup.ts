import { formatDate, localIsoDate } from '../lib/dates';
import { defaultColorIndex, defaultLayoutIndex } from '../lib/style';
import { HOLDER_ORDER, MAX_PINNED, SCHEMA_VERSION, type Card, type CodeFormat, type Holder } from './types';

/**
 * Rezerves kopija — SPEC 8. One JSON file with every card (photos as base64), the holder
 * names and a schema version, so future versions can migrate old files.
 */

export const BACKUP_APP = 'klientu-kartes';

interface SerializedPhoto {
  type: string;
  base64: string;
}

type SerializedCard = Omit<Card, 'photoOriginal' | 'photoCropped'> & {
  photoOriginal: SerializedPhoto;
  photoCropped: SerializedPhoto;
};

export interface BackupFile {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: string;
  holders: Holder[];
  cards: SerializedCard[];
}

/* ---------- Base64 ---------- */

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}

export function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/* ---------- Save ---------- */

/** "klientu-kartes-kopija-23.11.2026.json" */
export const backupFileName = (date: Date = new Date()) => `klientu-kartes-kopija-${formatDate(localIsoDate(date))}.json`;

const photo = async (blob: Blob): Promise<SerializedPhoto> => ({
  type: blob.type || 'image/jpeg',
  base64: await blobToBase64(blob),
});

export async function createBackup(cards: readonly Card[], holders: readonly Holder[], now = new Date()): Promise<string> {
  const file: BackupFile = {
    app: BACKUP_APP,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    holders: holders.map((h) => ({ ...h })),
    cards: await Promise.all(
      cards.map(async (c) => ({ ...c, photoOriginal: await photo(c.photoOriginal), photoCropped: await photo(c.photoCropped) })),
    ),
  };
  return JSON.stringify(file);
}

/* ---------- Read ---------- */

export type ParsedBackup =
  | { ok: true; cards: Card[]; holders: Holder[]; exportedAt: string | null }
  /** invalid: not our file or damaged · newer: made by a newer app version (update first). */
  | { ok: false; reason: 'invalid' | 'newer' };

const FORMATS: readonly CodeFormat[] = [
  'code128', 'code39', 'code93', 'codabar', 'ean13', 'ean8', 'upca', 'upce', 'itf',
  'qr', 'datamatrix', 'pdf417', 'aztec', 'other',
];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown): v is string => typeof v === 'string';
const isoOr = (v: unknown, fallback: string) => (str(v) && !Number.isNaN(Date.parse(v)) ? v : fallback);
const index8 = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 7 ? v : null);

function readPhoto(v: unknown): Blob | null {
  if (!isObj(v) || !str(v.base64)) return null;
  try {
    return base64ToBlob(v.base64, str(v.type) ? v.type : 'image/jpeg');
  } catch {
    return null;
  }
}

/** One card from the file, checked field by field. Cards without the essentials are skipped. */
function readCard(v: unknown, fallbackTime: string): Card | null {
  if (!isObj(v)) return null;
  const { id, company, holder, codeValue } = v;
  if (!str(company) || !company.trim() || !str(codeValue) || !codeValue.trim()) return null;
  if (!str(holder) || !HOLDER_ORDER.includes(holder as Card['holder'])) return null;
  const photoOriginal = readPhoto(v.photoOriginal);
  const photoCropped = readPhoto(v.photoCropped) ?? photoOriginal;
  if (!photoOriginal || !photoCropped) return null;
  const h = holder as Card['holder'];
  const updatedAt = isoOr(v.updatedAt, fallbackTime);
  return {
    id: str(id) && id ? id : '',
    company,
    holder: h,
    codeValue,
    codeFormat: FORMATS.includes(v.codeFormat as CodeFormat) ? (v.codeFormat as CodeFormat) : 'code128',
    codeSource: v.codeSource === 'typed' ? 'typed' : 'scanned',
    endDate: str(v.endDate) && /^\d{4}-\d{2}-\d{2}$/.test(v.endDate) ? v.endDate : null,
    colorIndex: index8(v.colorIndex) ?? defaultColorIndex(company, h),
    layoutIndex: index8(v.layoutIndex) ?? defaultLayoutIndex(company),
    pinned: v.pinned === true,
    pinOrder: typeof v.pinOrder === 'number' ? v.pinOrder : undefined,
    photoOriginal,
    photoCropped,
    lastUsedAt: str(v.lastUsedAt) && !Number.isNaN(Date.parse(v.lastUsedAt)) ? v.lastUsedAt : undefined,
    createdAt: isoOr(v.createdAt, updatedAt),
    updatedAt,
  };
}

export function parseBackup(text: string): ParsedBackup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (!isObj(data) || data.app !== BACKUP_APP || typeof data.schemaVersion !== 'number' || !Array.isArray(data.cards)) {
    return { ok: false, reason: 'invalid' };
  }
  if (data.schemaVersion > SCHEMA_VERSION) return { ok: false, reason: 'newer' };
  // Future schema versions: migrate `data` here, step by step, before reading the cards.

  const exportedAt = str(data.exportedAt) && !Number.isNaN(Date.parse(data.exportedAt)) ? data.exportedAt : null;
  const fallbackTime = exportedAt ?? new Date(0).toISOString();
  const cards = data.cards.map((c) => readCard(c, fallbackTime)).filter((c): c is Card => c !== null);

  const holders: Holder[] = [];
  if (Array.isArray(data.holders)) {
    for (const h of data.holders) {
      if (isObj(h) && HOLDER_ORDER.includes(h.id as Holder['id']) && str(h.name) && h.name.trim()) {
        holders.push({ id: h.id as Holder['id'], name: h.name.trim(), order: HOLDER_ORDER.indexOf(h.id as Holder['id']) });
      }
    }
  }
  return { ok: true, cards, holders, exportedAt };
}

/* ---------- Restore ---------- */

/** SPEC 8: the same card = same company + holder + number, ignoring case and spaces. */
export const cardKey = (c: Pick<Card, 'company' | 'holder' | 'codeValue'>) =>
  [c.company, c.holder, c.codeValue].map((s) => s.normalize('NFC').toLowerCase().replace(/\s+/g, '')).join('\u0000');

const time = (iso: string | undefined) => (iso ? Date.parse(iso) || 0 : 0);
const later = (a: string | undefined, b: string | undefined) => (time(a) >= time(b) ? a : b);

export interface MergeResult {
  /** Cards to write (new ones and newer versions of existing ones). */
  put: Card[];
  added: number;
  /** Already on the phone (skipped or replaced by a newer version). */
  existing: number;
  /** Of `existing`: replaced by the newer version from the file. */
  updated: number;
}

/**
 * "Pievienot": exact duplicates are skipped; if the same card differs, the newer `updatedAt`
 * wins. Pins on the phone stay as they are; pinned cards from the file stay pinned while
 * there's room (max 4), so restoring onto an empty phone brings the pins back.
 */
export function mergeCards(current: readonly Card[], incoming: readonly Card[], makeId: () => string): MergeResult {
  const byKey = new Map(current.map((c) => [cardKey(c), c]));
  const ids = new Set(current.map((c) => c.id));
  let pinnedCount = current.filter((c) => c.pinned).length;
  let nextPinOrder = current.reduce((m, c) => (c.pinned ? Math.max(m, c.pinOrder ?? 0) : m), -1) + 1;
  const put = new Map<string, Card>();
  let added = 0;
  let existing = 0;

  // Pinned ones first (in their order), so they get the free pin slots.
  const ordered = [...incoming].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || (a.pinOrder ?? 0) - (b.pinOrder ?? 0),
  );

  const onPhone = new Set(byKey.keys());
  const seen = new Set<string>();
  const updatedIds = new Set<string>();
  for (const inc of ordered) {
    const key = cardKey(inc);
    const repeat = seen.has(key); // the file itself has this card twice
    seen.add(key);
    const cur = byKey.get(key);
    if (!cur) {
      const pin = inc.pinned && pinnedCount < MAX_PINNED;
      const card: Card = {
        ...inc,
        id: inc.id && !ids.has(inc.id) ? inc.id : makeId(),
        pinned: pin,
        pinOrder: pin ? nextPinOrder++ : undefined,
      };
      if (pin) pinnedCount++;
      ids.add(card.id);
      byKey.set(key, card);
      put.set(card.id, card);
      added++;
      continue;
    }
    if (!repeat && onPhone.has(key)) existing++;
    if (time(inc.updatedAt) > time(cur.updatedAt)) {
      const card: Card = {
        ...inc,
        id: cur.id,
        pinned: cur.pinned,
        pinOrder: cur.pinOrder,
        createdAt: time(cur.createdAt) <= time(inc.createdAt) ? cur.createdAt : inc.createdAt,
        lastUsedAt: later(cur.lastUsedAt, inc.lastUsedAt),
      };
      if (onPhone.has(key)) updatedIds.add(cur.id);
      byKey.set(key, card);
      put.set(cur.id, card);
    }
  }
  const updated = updatedIds.size;
  return { put: [...put.values()], added, existing, updated };
}

/** "Aizstāt": the file's cards as they are, with at most 4 pinned (numbered 0..n-1). */
export function normalizePins(cards: readonly Card[]): Card[] {
  const pinned = cards.filter((c) => c.pinned).sort((a, b) => (a.pinOrder ?? 0) - (b.pinOrder ?? 0));
  const order = new Map(pinned.slice(0, MAX_PINNED).map((c, i) => [c, i]));
  return cards.map((c) =>
    order.has(c) ? { ...c, pinned: true, pinOrder: order.get(c) } : { ...c, pinned: false, pinOrder: undefined },
  );
}
