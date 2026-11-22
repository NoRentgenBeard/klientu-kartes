import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { lv } from '../i18n/lv';
import { defaultColorIndex, defaultLayoutIndex } from '../lib/style';
import {
  HOLDER_ORDER,
  MAX_PINNED,
  SCHEMA_VERSION,
  type Card,
  type Holder,
  type HolderId,
  type NewCard,
} from './types';

/** Small key/value settings stored next to the cards. */
export interface Meta {
  schemaVersion: number;
  lastBackupAt: string; // ISO timestamp
  themeId: string;
  storagePersisted: boolean;
}

interface KartesDB extends DBSchema {
  cards: { key: string; value: Card; indexes: { byHolder: HolderId } };
  holders: { key: HolderId; value: Holder };
  meta: { key: keyof Meta; value: Meta[keyof Meta] };
}

export const DB_NAME = 'klientu-kartes';
const DB_VERSION = 1;

export const DEFAULT_HOLDERS: readonly Holder[] = [
  { id: 'pe', name: lv.holderPe, order: 0 },
  { id: 'hf', name: lv.holderHf, order: 1 },
  { id: 'zj', name: lv.holderZj, order: 2 },
];

export type PinResult =
  | { ok: true }
  /** Already 4 pinned: UI asks which one to replace, then calls setPinned(id, true, replaceId). */
  | { ok: false; reason: 'full'; pinned: Card[] };

const now = () => new Date().toISOString();
const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** Personīgā → Happy Fish → Zaļā josta, then A–Z (Latvian collation) inside each holder. */
export function sortCards(cards: readonly Card[]): Card[] {
  const collator = new Intl.Collator('lv', { sensitivity: 'base', numeric: true });
  return [...cards].sort(
    (a, b) =>
      HOLDER_ORDER.indexOf(a.holder) - HOLDER_ORDER.indexOf(b.holder) || collator.compare(a.company, b.company),
  );
}

/**
 * All storage goes through this repository, so screens never touch IndexedDB directly.
 * `createRepo(name)` makes an isolated database (used by tests).
 */
export function createRepo(name: string = DB_NAME) {
  let dbPromise: Promise<IDBPDatabase<KartesDB>> | undefined;

  const db = () =>
    (dbPromise ??= openDB<KartesDB>(name, DB_VERSION, {
      upgrade(database, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          const cards = database.createObjectStore('cards', { keyPath: 'id' });
          cards.createIndex('byHolder', 'holder');
          const holders = database.createObjectStore('holders', { keyPath: 'id' });
          for (const h of DEFAULT_HOLDERS) void holders.put({ ...h });
          const meta = database.createObjectStore('meta');
          void meta.put(SCHEMA_VERSION, 'schemaVersion');
        }
        void tx; // future migrations use tx
      },
    }));

  async function listCards(): Promise<Card[]> {
    return sortCards(await (await db()).getAll('cards'));
  }

  async function getCard(id: string): Promise<Card | undefined> {
    return (await db()).get('cards', id);
  }

  async function pinnedCards(): Promise<Card[]> {
    const cards = (await (await db()).getAll('cards')).filter((c) => c.pinned);
    return cards.sort((a, b) => (a.pinOrder ?? 0) - (b.pinOrder ?? 0));
  }

  async function addCard(input: NewCard): Promise<Card> {
    const existing = await (await db()).getAll('cards');
    const t = now();
    const card: Card = {
      ...input,
      id: newId(),
      colorIndex: input.colorIndex ?? defaultColorIndex(input.company, input.holder, existing),
      layoutIndex: input.layoutIndex ?? defaultLayoutIndex(input.company),
      pinned: false,
      createdAt: t,
      updatedAt: t,
    };
    await (await db()).put('cards', card);
    if (input.pinned) await setPinned(card.id, true);
    return (await getCard(card.id))!;
  }

  /** Save edits to an existing card; bumps updatedAt. */
  async function updateCard(card: Card): Promise<Card> {
    const saved = { ...card, updatedAt: now() };
    await (await db()).put('cards', saved);
    return saved;
  }

  async function deleteCard(id: string): Promise<void> {
    await (await db()).delete('cards', id);
  }

  /** Opening a card on Kasē. Doesn't bump updatedAt (that's for edits, used by backup merge). */
  async function markUsed(id: string): Promise<void> {
    const card = await getCard(id);
    if (card) await (await db()).put('cards', { ...card, lastUsedAt: now() });
  }

  async function setPinned(id: string, pinned: boolean, replaceId?: string): Promise<PinResult> {
    const database = await db();
    const tx = database.transaction('cards', 'readwrite');
    const all = await tx.store.getAll();
    const card = all.find((c) => c.id === id);
    if (!card) {
      await tx.done;
      return { ok: true };
    }
    let current = all.filter((c) => c.pinned && c.id !== id).sort((a, b) => (a.pinOrder ?? 0) - (b.pinOrder ?? 0));

    if (pinned && !card.pinned) {
      if (replaceId) {
        const replaced = current.find((c) => c.id === replaceId);
        if (replaced) {
          await tx.store.put({ ...replaced, pinned: false, pinOrder: undefined });
          // The new card takes the replaced card's slot.
          await tx.store.put({ ...card, pinned: true, pinOrder: replaced.pinOrder });
          await tx.done;
          return { ok: true };
        }
      }
      if (current.length >= MAX_PINNED) {
        await tx.done;
        return { ok: false, reason: 'full', pinned: current };
      }
      const nextOrder = current.reduce((max, c) => Math.max(max, c.pinOrder ?? 0), -1) + 1;
      await tx.store.put({ ...card, pinned: true, pinOrder: nextOrder });
    } else if (!pinned && card.pinned) {
      await tx.store.put({ ...card, pinned: false, pinOrder: undefined });
      // Close the gap so pinOrder stays 0..n-1.
      current = current.map((c, i) => ({ ...c, pinOrder: i }));
      for (const c of current) await tx.store.put(c);
    }
    await tx.done;
    return { ok: true };
  }

  async function listHolders(): Promise<Holder[]> {
    return (await (await db()).getAll('holders')).sort((a, b) => a.order - b.order);
  }

  async function renameHolder(id: HolderId, name: string): Promise<void> {
    const database = await db();
    const holder = await database.get('holders', id);
    const trimmed = name.trim();
    if (holder && trimmed) await database.put('holders', { ...holder, name: trimmed });
  }

  async function getMeta<K extends keyof Meta>(key: K): Promise<Meta[K] | undefined> {
    return (await (await db()).get('meta', key)) as Meta[K] | undefined;
  }

  async function setMeta<K extends keyof Meta>(key: K, value: Meta[K]): Promise<void> {
    await (await db()).put('meta', value, key);
  }

  /** Used by "Atjaunot no kopijas → Aizstāt" (milestone 5). */
  async function replaceAllCards(cards: readonly Card[]): Promise<void> {
    const tx = (await db()).transaction('cards', 'readwrite');
    await tx.store.clear();
    for (const c of cards) await tx.store.put(c);
    await tx.done;
  }

  async function countCards(): Promise<number> {
    return (await db()).count('cards');
  }

  async function close(): Promise<void> {
    if (dbPromise) (await dbPromise).close();
    dbPromise = undefined;
  }

  return {
    listCards,
    getCard,
    pinnedCards,
    addCard,
    updateCard,
    deleteCard,
    markUsed,
    setPinned,
    listHolders,
    renameHolder,
    getMeta,
    setMeta,
    replaceAllCards,
    countCards,
    close,
  };
}

export type Repo = ReturnType<typeof createRepo>;

/** The app's database. */
export const repo: Repo = createRepo();
