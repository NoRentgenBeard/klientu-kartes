import { useCallback, useEffect, useState } from 'preact/hooks';
import { Suspense, lazy } from 'preact/compat';
import { preloadCodeRenderer } from './codes/CodeView';
import { UpdateBanner } from './components/UpdateBanner';
import { repo } from './db/repo';
import type { Card, Holder } from './db/types';
import { normalizeKey } from './lib/text';
import { Kase } from './screens/Kase';
import { PinReplace } from './screens/PinReplace';
import { Sakums } from './screens/Sakums';

// Loaded on first use, so start-up and Kasē stay fast. The add flow and card details share
// the scanner (zxing + OCR) chunk.
const AddFlow = lazy(() => import('./screens/add/AddFlow').then((m) => ({ default: m.AddFlow })));
const KartesDetalas = lazy(() => import('./screens/add/KartesDetalas').then((m) => ({ default: m.KartesDetalas })));
const Iestatijumi = lazy(() => import('./screens/Iestatijumi').then((m) => ({ default: m.Iestatijumi })));

/** Screen state: Sākums underneath; Kasē, card details, add flow and settings on top. */
export function App() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<{ id: string; lastUsedAt: string | undefined } | null>(null);
  const [pinChoice, setPinChoice] = useState<{ card: Card; pinned: Card[] } | null>(null);
  const [adding, setAdding] = useState(false);
  const [settings, setSettings] = useState(false);

  const reload = useCallback(async () => {
    const [c, h] = await Promise.all([repo.listCards(), repo.listHolders()]);
    setCards(c);
    setHolders(h);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openCard = (card: Card) => {
    preloadCodeRenderer();
    setOpenId(card.id);
  };

  const closeKase = () => {
    setOpenId(null);
    void reload(); // picks up lastUsedAt
  };

  const togglePin = async (card: Card) => {
    const result = await repo.setPinned(card.id, !card.pinned);
    if (!result.ok) setPinChoice({ card, pinned: result.pinned });
    await reload();
  };

  const replacePin = async (replace: Card) => {
    if (!pinChoice) return;
    await repo.setPinned(pinChoice.card.id, true, replace.id);
    setPinChoice(null);
    await reload();
  };

  const closeSettings = useCallback(() => setSettings(false), []);

  const open = cards?.find((c) => c.id === openId);
  const siblings = open ? cards!.filter((c) => normalizeKey(c.company) === normalizeKey(open.company)) : [];
  const detailsCard = details ? cards?.find((c) => c.id === details.id) : undefined;

  return (
    <>
      {cards && (
        <Sakums
          cards={cards}
          holders={holders}
          onOpenCard={openCard}
          onAdd={() => setAdding(true)}
          onSettings={() => setSettings(true)}
        />
      )}
      {open && (
        <Kase
          card={open}
          siblings={siblings}
          holders={holders}
          onSwitch={(c) => setOpenId(c.id)}
          onTogglePin={togglePin}
          onDetails={(c, lastUsedAt) => setDetails({ id: c.id, lastUsedAt })}
          onClose={closeKase}
        />
      )}
      {details && detailsCard && cards && (
        <Suspense fallback={null}>
          <KartesDetalas
            card={detailsCard}
            lastUsedAt={details.lastUsedAt}
            cards={cards}
            holders={holders}
            onTogglePin={togglePin}
            onSaved={() => {
              setDetails(null);
              void reload();
            }}
            onDeleted={() => {
              setDetails(null);
              setOpenId(null);
              void reload();
            }}
            onClose={() => setDetails(null)}
          />
        </Suspense>
      )}
      {adding && cards && (
        <Suspense fallback={null}>
          <AddFlow
            cards={cards}
            holders={holders}
            onSaved={() => {
              setAdding(false);
              void reload();
            }}
            onCancel={() => setAdding(false)}
          />
        </Suspense>
      )}
      {settings && cards && (
        <Suspense fallback={null}>
          <Iestatijumi cards={cards} holders={holders} onChanged={() => void reload()} onClose={closeSettings} />
        </Suspense>
      )}
      {pinChoice && (
        <PinReplace
          pinned={pinChoice.pinned}
          holders={holders}
          onChoose={replacePin}
          onCancel={() => setPinChoice(null)}
        />
      )}
      <UpdateBanner />
    </>
  );
}
