import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { createRepo, type Repo } from './repo';
import { SAMPLE_CARDS, seedIfEmpty } from './seed';
import type { NewCard } from './types';

let n = 0;
let repo: Repo;
const fresh = () => (repo = createRepo(`test-${n++}`));
afterEach(() => repo?.close());

const photo = () => Promise.resolve(new Blob(['x'], { type: 'image/jpeg' }));

const card = (company: string, holder: NewCard['holder'] = 'pe', extra: Partial<NewCard> = {}): NewCard => ({
  company,
  holder,
  codeValue: '123',
  codeFormat: 'code128',
  codeSource: 'typed',
  endDate: null,
  photoOriginal: new Blob(['o']),
  photoCropped: new Blob(['c']),
  ...extra,
});

describe('repo', () => {
  it('creates the three holders in fixed order', async () => {
    fresh();
    const holders = await repo.listHolders();
    expect(holders.map((h) => [h.id, h.name])).toEqual([
      ['pe', 'Personīgā'],
      ['hf', 'Happy Fish'],
      ['zj', 'Zaļā josta'],
    ]);
  });

  it('renames a holder, ignoring blank names', async () => {
    fresh();
    await repo.renameHolder('hf', '  HF SIA ');
    await repo.renameHolder('zj', '   ');
    const names = (await repo.listHolders()).map((h) => h.name);
    expect(names).toEqual(['Personīgā', 'HF SIA', 'Zaļā josta']);
  });

  it('adds, reads, updates and deletes a card', async () => {
    fresh();
    const added = await repo.addCard(card('DEPO', 'hf'));
    expect(added.id).toBeTruthy();
    expect(added.colorIndex).toBeGreaterThanOrEqual(0);
    expect(added.createdAt).toBe(added.updatedAt);

    const got = await repo.getCard(added.id);
    expect(got?.company).toBe('DEPO');
    expect(got?.photoOriginal).toBeInstanceOf(Blob);

    await new Promise((r) => setTimeout(r, 5));
    const updated = await repo.updateCard({ ...got!, company: 'DEPO DIY' });
    expect(updated.updatedAt > added.updatedAt).toBe(true);

    await repo.deleteCard(added.id);
    expect(await repo.getCard(added.id)).toBeUndefined();
  });

  it('two DEPO cards for different holders get different colours', async () => {
    fresh();
    const a = await repo.addCard(card('DEPO', 'hf'));
    const b = await repo.addCard(card('depo', 'zj'));
    expect(a.colorIndex).not.toBe(b.colorIndex);
    expect(a.layoutIndex).toBe(b.layoutIndex);
  });

  it('sorts Personīgā → Happy Fish → Zaļā josta, then A–Z with Latvian letters', async () => {
    fresh();
    await repo.addCard(card('JYSK', 'zj'));
    await repo.addCard(card('Mēness aptieka', 'pe'));
    await repo.addCard(card('DEPO', 'hf'));
    await repo.addCard(card('Apollo kino', 'pe'));
    await repo.addCard(card('Ksenukai', 'hf'));
    const order = (await repo.listCards()).map((c) => `${c.holder}:${c.company}`);
    expect(order).toEqual(['pe:Apollo kino', 'pe:Mēness aptieka', 'hf:DEPO', 'hf:Ksenukai', 'zj:JYSK']);
  });

  it('allows max 4 pinned and can replace one', async () => {
    fresh();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push((await repo.addCard(card(`S${i}`))).id);
    for (let i = 0; i < 4; i++) expect(await repo.setPinned(ids[i], true)).toEqual({ ok: true });

    const full = await repo.setPinned(ids[4], true);
    expect(full.ok).toBe(false);
    if (!full.ok) expect(full.pinned.map((c) => c.id)).toEqual(ids.slice(0, 4));

    expect(await repo.setPinned(ids[4], true, ids[1])).toEqual({ ok: true });
    expect((await repo.pinnedCards()).map((c) => c.id)).toEqual([ids[0], ids[4], ids[2], ids[3]]);

    await repo.setPinned(ids[0], false);
    const pinned = await repo.pinnedCards();
    expect(pinned.map((c) => c.id)).toEqual([ids[4], ids[2], ids[3]]);
    expect(pinned.map((c) => c.pinOrder)).toEqual([0, 1, 2]);
  });

  it('markUsed sets lastUsedAt without touching updatedAt', async () => {
    fresh();
    const c = await repo.addCard(card('Drogas'));
    await repo.markUsed(c.id);
    const after = await repo.getCard(c.id);
    expect(after?.lastUsedAt).toBeTruthy();
    expect(after?.updatedAt).toBe(c.updatedAt);
  });

  it('stores meta values', async () => {
    fresh();
    expect(await repo.getMeta('schemaVersion')).toBe(1);
    await repo.setMeta('lastBackupAt', '2026-11-23T10:00:00.000Z');
    expect(await repo.getMeta('lastBackupAt')).toBe('2026-11-23T10:00:00.000Z');
  });

  it('seeds the 14 sample cards once, with the 4 demo pins', async () => {
    fresh();
    expect(await seedIfEmpty(repo, photo)).toBe(SAMPLE_CARDS.length);
    expect(await seedIfEmpty(repo, photo)).toBe(0);
    expect(await repo.countCards()).toBe(14);
    const pinned = (await repo.pinnedCards()).map((c) => `${c.company}/${c.holder}`);
    expect(pinned).toEqual(['DEPO/hf', 'DEPO/zj', 'Drogas/pe', 'PROMO Cash&Carry/hf']);
  });

  it('replaceAllCards swaps the whole set', async () => {
    fresh();
    await repo.addCard(card('Old'));
    const other = createRepo(`test-${n++}`);
    const fresh1 = await other.addCard(card('New A'));
    const fresh2 = await other.addCard(card('New B'));
    await repo.replaceAllCards([fresh1, fresh2]);
    expect((await repo.listCards()).map((c) => c.company)).toEqual(['New A', 'New B']);
    await other.close();
  });
});
