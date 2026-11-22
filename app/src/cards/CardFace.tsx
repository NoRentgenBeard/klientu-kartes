import type { Card, Holder } from '../db/types';
import { lv } from '../i18n/lv';
import { expiryStatus, formatDate } from '../lib/dates';
import { HolderTag } from './HolderTag';
import { Topo } from './Topo';
import './cards.css';

interface Props {
  card: Card;
  holder: Holder | undefined;
  /** full = credit-card size in the list; tile = 96-pt pinned tile. */
  variant?: 'full' | 'tile';
  onOpen?: (card: Card) => void;
}

/** Status line "Beidzas drīz · 31.12.2026" / "Beigusies · 30.09.2026", or nothing. */
export function StatusLine({ card }: { card: Card }) {
  const status = expiryStatus(card.endDate);
  if (!status || !card.endDate) return null;
  return (
    <span class={`card-status card-status--${status}`}>
      {status === 'expired' ? lv.expired : lv.expiringSoon} · {formatDate(card.endDate)}
    </span>
  );
}

export function CardFace({ card, holder, variant = 'full', onOpen }: Props) {
  const label = holder && holder.id !== 'pe' ? `${card.company}, ${holder.name}` : card.company;
  return (
    <button
      type="button"
      class={`card-face card-face--${variant}`}
      style={{ background: `var(--card-${card.colorIndex})` }}
      aria-label={label}
      onClick={() => onOpen?.(card)}
    >
      <Topo layoutIndex={card.layoutIndex} />
      {variant === 'full' ? (
        <span class="card-face__top">
          <span class="card-face__text">
            <span class="card-face__name">{card.company}</span>
            <StatusLine card={card} />
          </span>
          <HolderTag holder={holder} size="md" />
        </span>
      ) : (
        // Tile: the tag floats top-right and the name wraps around it, so long
        // names like "PROMO Cash&Carry" get the full width on their second line.
        <span class="card-face__tile-text">
          <HolderTag holder={holder} size="sm" />
          {card.company}
        </span>
      )}
    </button>
  );
}
