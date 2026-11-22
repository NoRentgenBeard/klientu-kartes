import { useState } from 'preact/hooks';
import { CardFace } from '../cards/CardFace';
import { IS_DEMO } from '../db/repo';
import { HOLDER_ORDER, MAX_PINNED, type Card, type Holder, type HolderId } from '../db/types';
import { lv } from '../i18n/lv';
import './Sakums.css';

interface Props {
  cards: Card[];
  holders: Holder[];
  onOpenCard: (card: Card) => void;
  onAdd: () => void;
  onSettings: () => void;
}

type Filter = 'all' | HolderId;

/** Sākums — SPEC 6.1. Cards arrive already sorted (holder order, then A–Z). */
export function Sakums({ cards, holders, onOpenCard, onAdd, onSettings }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const holderById = new Map(holders.map((h) => [h.id, h]));

  const pinned = cards
    .filter((c) => c.pinned)
    .sort((a, b) => (a.pinOrder ?? 0) - (b.pinOrder ?? 0))
    .slice(0, MAX_PINNED);

  const groups = HOLDER_ORDER.filter((id) => filter === 'all' || filter === id)
    .map((id) => ({ holder: holderById.get(id), cards: cards.filter((c) => c.holder === id) }))
    .filter((g) => g.cards.length > 0);

  const chips: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: lv.all },
    ...holders.map((h) => ({ id: h.id as Filter, label: h.name })),
  ];

  return (
    <main class="sakums">
      <header class="sakums__header">
        <h1 class="t-large-title">
          {lv.cards}
          {IS_DEMO && <span class="sakums__demo">{lv.demo}</span>}
        </h1>
        <div class="sakums__actions">
          <button type="button" class="btn-icon" aria-label={lv.addCard} onClick={onAdd}>
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
            </svg>
          </button>
          <button type="button" class="btn-icon" aria-label={lv.settings} onClick={onSettings}>
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
        </div>
      </header>

      {cards.length === 0 ? (
        <section class="sakums__empty">
          <p class="t-secondary">{lv.emptyText}</p>
          <button type="button" class="btn-primary" onClick={onAdd}>
            {lv.addCard}
          </button>
        </section>
      ) : (
        <>
          {pinned.length > 0 && (
            <section class="sakums__section" aria-labelledby="pinned-title">
              <div class="sakums__section-head">
                <h2 id="pinned-title" class="t-section">
                  {lv.pinned}
                </h2>
                <span class="t-secondary sakums__counter">
                  {pinned.length} / {MAX_PINNED}
                </span>
              </div>
              <div class="sakums__pinned">
                {pinned.map((c) => (
                  <CardFace key={c.id} card={c} holder={holderById.get(c.holder)} variant="tile" onOpen={onOpenCard} />
                ))}
              </div>
            </section>
          )}

          <div class="sakums__chips" role="group" aria-label={lv.holders}>
            {chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                class={`chip${filter === chip.id ? ' chip--selected' : ''}`}
                aria-pressed={filter === chip.id}
                onClick={() => setFilter(chip.id)}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <section class="sakums__section" aria-labelledby="all-title">
            <h2 id="all-title" class="t-section sakums__section-head">
              {lv.allCards}
            </h2>
            {groups.map((g) => (
              <div key={g.holder?.id} class="sakums__group">
                <h3 class="sakums__group-title">
                  {g.holder?.name} <span class="sakums__group-count">{g.cards.length}</span>
                </h3>
                <ul class="stack">
                  {g.cards.map((c) => (
                    <li key={c.id} class="stack__item">
                      <CardFace card={c} holder={g.holder} onOpen={onOpenCard} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
