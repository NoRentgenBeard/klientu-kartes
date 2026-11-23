import { useCallback, useEffect, useState } from 'preact/hooks';
import { preloadCodeRenderer } from './codes/CodeView';
import { repo } from './db/repo';
import type { Card, Holder } from './db/types';
import { normalizeKey } from './lib/text';
import { Kase } from './screens/Kase';
import { PinReplace } from './screens/PinReplace';
import { Sakums } from './screens/Sakums';
import { Suspense, lazy } from 'preact/compat';

// The add flow (scanner + OCR) loads only when "+" is tapped, so start-up stays fast.
const AddFlow = lazy(() => import('./screens/add/AddFlow').then((m) => ({ default: m.AddFlow })));
import { UpdateBanner } from './components/UpdateBanner';

/** Screen state. Kartes detaļas and Iestatījumi (milestone 5) are added later. */
export function App() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pinChoice, setPinChoice] = useState<{ card: Card; pinned: Card[] } | null>(null);
  const [adding, setAdding] = useState(false);

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

  // Not built yet: card details and settings (milestone 5).
  const notYet = () => {};

  const open = cards?.find((c) => c.id === openId);
  const siblings = open ? cards!.filter((c) => normalizeKey(c.company) === normalizeKey(open.company)) : [];

  return (
    <>
      {cards && (
        <Sakums cards={cards} holders={holders} onOpenCard={openCard} onAdd={() => setAdding(true)} onSettings={notYet} />
      )}
      {open && (
        <Kase
          card={open}
          siblings={siblings}
          holders={holders}
          onSwitch={(c) => setOpenId(c.id)}
          onTogglePin={togglePin}
          onDetails={notYet}
          onClose={() => setOpenId(null)}
        />
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
