import type { Holder } from '../db/types';

/**
 * Holder tag on cards: "HAPPY FISH" / "ZAĻĀ JOSTA". Personīgā has no tag (SPEC 5.3).
 * Kept as its own component so it can later become a company logo image.
 */
export function HolderTag({ holder, size = 'md' }: { holder: Holder | undefined; size?: 'sm' | 'md' | 'lg' }) {
  if (!holder || holder.id === 'pe') return null;
  return <span class={`holder-tag holder-tag--${size}`}>{holder.name}</span>;
}
