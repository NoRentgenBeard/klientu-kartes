import type { Repo } from './db/repo';

/**
 * Ask the browser to keep our IndexedDB data (SPEC 3). Installed Home Screen apps on iOS
 * are not subject to Safari's 7-day eviction anyway; the manual backup is still the safety net.
 */
export async function requestPersistentStorage(repo: Repo): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    const already = await navigator.storage.persisted?.();
    const granted = already || (await navigator.storage.persist());
    await repo.setMeta('storagePersisted', granted);
    return granted;
  } catch {
    return false;
  }
}

/** True when running as an installed Home Screen app (not in a Safari tab). */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
