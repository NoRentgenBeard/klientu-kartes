import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  backupFileName,
  base64ToBlob,
  blobToBase64,
  cardKey,
  createBackup,
  mergeCards,
  normalizePins,
  parseBackup,
} from './backup';
import { createRepo, DEFAULT_HOLDERS, type Repo } from './repo';
import type { Card } from './types';

// Made-up cards only.
let seq = 0;
const make = (company: string, extra: Partial<Card> = {}): Card => ({
  id: `id-${seq++}`,
  company,
  holder: 'pe',
  codeValue: '123456',
  codeFormat: 'code128',
  codeSource: 'scanned',
  endDate: null,
  colorIndex: 1,
  layoutIndex: 2,
  pinned: false,
  photoOriginal: new Blob([`orig ${company}`], { type: 'image/jpeg' }),
  photoCropped: new Blob([`crop ${company}`], { type: 'image/jpeg' }),
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
  ...extra,
});

let ids = 0;
const makeId = () => `new-${ids++}`;

describe('base64', () => {
  it('round-trips binary data, also large', async () => {
    const bytes = new Uint8Array(100_000).map((_, i) => (i * 37) % 256);
    const b64 = await blobToBase64(new Blob([bytes]));
    const back = new Uint8Array(await base64ToBlob(b64, 'image/jpeg').arrayBuffer());
    expect(back).toEqual(bytes);
  });
});

describe('backup file', () => {
  it('is named with the date', () => {
    expect(backupFileName(new Date(2026, 10, 3))).toBe('klientu-kartes-kopija-03.11.2026.json');
  });

  it('saves and reads back cards, photos and holder names', async () => {
    const cards = [make('Veikals A', { endDate: '2027-09-30', pinned: true, pinOrder: 0 }), make('Veikals B', { holder: 'hf' })];
    const holders = DEFAULT_HOLDERS.map((h) => (h.id === 'hf' ? { ...h, name: 'HF SIA' } : { ...h }));
    const text = await createBackup(cards, holders, new Date('2026-11-23T08:00:00Z'));
    const json = JSON.parse(text);
    expect(json.app).toBe('klientu-kartes');
    expect(json.schemaVersion).toBe(1);

    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error('not ok');
    expect(parsed.exportedAt).toBe('2026-11-23T08:00:00.000Z');
    expect(parsed.holders.find((h) => h.id === 'hf')?.name).toBe('HF SIA');
    expect(parsed.cards).toHaveLength(2);
    const a = parsed.cards[0];
    expect({ ...a, photoOriginal: null, photoCropped: null }).toEqual({ ...cards[0], photoOriginal: null, photoCropped: null });
    expect(await a.photoOriginal.text()).toBe('orig Veikals A');
    expect(await a.photoCropped.text()).toBe('crop Veikals A');
    expect(a.photoOriginal.type).toBe('image/jpeg');
  });

  it('rejects other files and newer versions', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseBackup('{"cards":[]}')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseBackup('{"app":"klientu-kartes","schemaVersion":99,"cards":[]}')).toEqual({ ok: false, reason: 'newer' });
  });

  it('skips damaged cards and repairs odd fields', () => {
    const photo = { type: 'image/jpeg', base64: btoa('x') };
    const text = JSON.stringify({
      app: 'klientu-kartes',
      schemaVersion: 1,
      cards: [
        { company: 'Bez numura', holder: 'pe', codeValue: '', photoOriginal: photo, photoCropped: photo },
        { company: 'Bez foto', holder: 'pe', codeValue: '1' },
        { company: 'Svešs turētājs', holder: 'xx', codeValue: '1', photoOriginal: photo, photoCropped: photo },
        { company: 'Labs', holder: 'zj', codeValue: '77', codeFormat: 'weird', colorIndex: 12, endDate: '31.12.2027', photoOriginal: photo },
      ],
    });
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error('not ok');
    expect(parsed.cards).toHaveLength(1);
    const c = parsed.cards[0];
    expect(c.company).toBe('Labs');
    expect(c.codeFormat).toBe('code128');
    expect(c.colorIndex).toBeGreaterThanOrEqual(0);
    expect(c.colorIndex).toBeLessThanOrEqual(7);
    expect(c.endDate).toBeNull();
    expect(c.photoCropped).toBe(c.photoOriginal);
  });
});

describe('cardKey', () => {
  it('ignores case and spaces', () => {
    expect(cardKey({ company: 'Cenu Klubs', holder: 'pe', codeValue: 'L000 12345' })).toBe(
      cardKey({ company: 'cenu klubs ', holder: 'pe', codeValue: 'l00012345' }),
    );
    expect(cardKey({ company: 'DEPO', holder: 'hf', codeValue: '1' })).not.toBe(cardKey({ company: 'DEPO', holder: 'zj', codeValue: '1' }));
  });
});

describe('mergeCards (Pievienot)', () => {
  it('adds new cards and skips exact duplicates', () => {
    const phone = [make('A'), make('B')];
    const file = [make('a '), make('C')]; // "a " = A
    const r = mergeCards(phone, file, makeId);
    expect(r.added).toBe(1);
    expect(r.existing).toBe(1);
    expect(r.updated).toBe(0);
    expect(r.put.map((c) => c.company)).toEqual(['C']);
  });

  it('keeps the newer version of the same card, with its id and pin from the phone', () => {
    const phone = [make('A', { colorIndex: 1, pinned: true, pinOrder: 0, lastUsedAt: '2026-11-20T00:00:00Z' })];
    const newer = make('A', { colorIndex: 5, updatedAt: '2026-06-01T00:00:00Z', lastUsedAt: '2026-03-01T00:00:00Z' });
    const r = mergeCards(phone, [newer], makeId);
    expect(r).toMatchObject({ added: 0, existing: 1, updated: 1 });
    expect(r.put[0]).toMatchObject({ id: phone[0].id, colorIndex: 5, pinned: true, pinOrder: 0, lastUsedAt: '2026-11-20T00:00:00Z' });
  });

  it('keeps the phone version when it is newer', () => {
    const phone = [make('A', { colorIndex: 1, updatedAt: '2026-06-01T00:00:00Z' })];
    const r = mergeCards(phone, [make('A', { colorIndex: 5 })], makeId);
    expect(r).toMatchObject({ added: 0, existing: 1, updated: 0, put: [] });
  });

  it('gives a new id when the id is taken by a different card', () => {
    const phone = [make('A', { id: 'same' })];
    const r = mergeCards(phone, [make('B', { id: 'same' })], makeId);
    expect(r.put[0].id).not.toBe('same');
  });

  it('brings pins back while there is room (max 4)', () => {
    const phone = [0, 1, 2].map((i) => make(`P${i}`, { pinned: true, pinOrder: i }));
    const file = [make('X', { pinned: true, pinOrder: 1 }), make('Y', { pinned: true, pinOrder: 0 }), make('Z')];
    const r = mergeCards(phone, file, makeId);
    const byName = Object.fromEntries(r.put.map((c) => [c.company, c]));
    expect(byName.Y).toMatchObject({ pinned: true, pinOrder: 3 });
    expect(byName.X).toMatchObject({ pinned: false, pinOrder: undefined });
    expect(byName.Z.pinned).toBe(false);
  });

  it('counts a card listed twice in the file once', () => {
    const r = mergeCards([], [make('A'), make('A', { colorIndex: 6, updatedAt: '2026-05-01T00:00:00Z' })], makeId);
    expect(r).toMatchObject({ added: 1, existing: 0, updated: 0 });
    expect(r.put).toHaveLength(1);
    expect(r.put[0].colorIndex).toBe(6);
  });
});

describe('normalizePins (Aizstāt)', () => {
  it('keeps at most 4 pins, numbered 0..3', () => {
    const cards = [5, 2, 9, 1, 7].map((o, i) => make(`K${i}`, { pinned: true, pinOrder: o }));
    const out = normalizePins(cards);
    expect(out.filter((c) => c.pinned).map((c) => [c.company, c.pinOrder])).toEqual([
      ['K0', 2],
      ['K1', 1],
      ['K3', 0],
      ['K4', 3],
    ]);
  });
});

describe('restore into the repository', () => {
  let repo: Repo;
  afterEach(() => repo?.close());

  it('merge writes the result and deleting a pinned card closes the gap', async () => {
    repo = createRepo('backup-test-1');
    const a = await repo.addCard({ ...make('A'), pinned: true });
    const b = await repo.addCard({ ...make('B'), pinned: true });
    const r = mergeCards(await repo.listCards(), [make('A'), make('C')], makeId);
    await repo.putCards(r.put);
    expect((await repo.listCards()).map((c) => c.company)).toEqual(['A', 'B', 'C']);

    await repo.deleteCard(a.id);
    expect((await repo.getCard(b.id))?.pinOrder).toBe(0);
  });

  it('markUsed returns the previous use', async () => {
    repo = createRepo('backup-test-2');
    const c = await repo.addCard(make('A'));
    expect(await repo.markUsed(c.id)).toBeUndefined();
    const first = (await repo.getCard(c.id))?.lastUsedAt;
    expect(await repo.markUsed(c.id)).toBe(first);
  });
});
