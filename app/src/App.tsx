import { useCallback, useEffect, useState } from 'preact/hooks';
import { repo } from './db/repo';
import type { Card, Holder } from './db/types';
import { Sakums } from './screens/Sakums';
import { UpdateBanner } from './components/UpdateBanner';

/** Screen state. Kasē (M3), Pievienot (M4) and Iestatījumi (M5) are added later. */
export function App() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [holders, setHolders] = useState<Holder[]>([]);

  const reload = useCallback(async () => {
    const [c, h] = await Promise.all([repo.listCards(), repo.listHolders()]);
    setCards(c);
    setHolders(h);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Not built yet: Kasē (milestone 3), add flow (4), settings (5).
  const notYet = () => {};

  return (
    <>
      {cards && (
        <Sakums cards={cards} holders={holders} onOpenCard={notYet} onAdd={notYet} onSettings={notYet} />
      )}
      <UpdateBanner />
    </>
  );
}
