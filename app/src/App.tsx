import { useEffect, useState } from 'preact/hooks';
import { repo } from './db/repo';
import type { Card, Holder } from './db/types';
import { lv } from './i18n/lv';
import { expiryStatus, formatDate } from './lib/dates';
import { UpdateBanner } from './components/UpdateBanner';
import './App.css';

/**
 * Milestone 1 shell: header, empty state, and a plain temporary list that proves the
 * database works. The designed Sākums (pinned grid, chips, Wallet stacks) is milestone 2.
 */
export function App() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [holders, setHolders] = useState<Holder[]>([]);

  useEffect(() => {
    void Promise.all([repo.listCards(), repo.listHolders()]).then(([c, h]) => {
      setCards(c);
      setHolders(h);
    });
  }, []);

  return (
    <main class="shell">
      <header class="shell__header">
        <h1 class="t-large-title">{lv.cards}</h1>
        <div class="shell__actions">
          <button class="btn-icon shell__icon" aria-label={lv.addCard} disabled>
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
              <path d="M11 3v16M3 11h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
            </svg>
          </button>
          <button class="btn-icon shell__icon" aria-label={lv.settings} disabled>
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" fill="currentColor">
              <circle cx="4" cy="11" r="2" />
              <circle cx="11" cy="11" r="2" />
              <circle cx="18" cy="11" r="2" />
            </svg>
          </button>
        </div>
      </header>

      {cards && cards.length === 0 && (
        <section class="shell__empty">
          <p class="t-secondary">{lv.emptyText}</p>
          <button class="btn-primary" disabled>
            {lv.addCard}
          </button>
        </section>
      )}

      {cards &&
        holders.map((h) => {
          const group = cards.filter((c) => c.holder === h.id);
          if (group.length === 0) return null;
          return (
            <section key={h.id} class="shell__group">
              <h2 class="t-label shell__group-title">
                {h.name} · {group.length}
              </h2>
              <ul class="shell__list">
                {group.map((c) => {
                  const status = expiryStatus(c.endDate);
                  return (
                    <li key={c.id} class="shell__row">
                      <span
                        class="shell__swatch"
                        style={{ background: `var(--card-${c.colorIndex})` }}
                        aria-hidden="true"
                      />
                      <span class="shell__name">{c.company}</span>
                      {c.pinned && <span class="shell__pin" aria-label={lv.pinned}>●</span>}
                      {status && c.endDate && (
                        <span class={`shell__status shell__status--${status}`}>
                          {status === 'expired' ? lv.expired : lv.expiringSoon} · {formatDate(c.endDate)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}

      <UpdateBanner />
    </main>
  );
}
