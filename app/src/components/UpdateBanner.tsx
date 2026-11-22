import { useRegisterSW } from 'virtual:pwa-register/preact';
import { lv } from '../i18n/lv';
import './UpdateBanner.css';

/**
 * Registers the service worker. When a new version has been downloaded, shows
 * "Pieejama jauna versija — Pārlādēt" (SPEC 6.7). Final styling in milestone 6.
 */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a new version whenever the app comes back to the foreground.
      if (!registration) return;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update();
      });
    },
  });

  if (!needRefresh) return null;
  return (
    <div class="update-banner" role="status">
      <span>{lv.updateAvailable}</span>
      <button class="update-banner__btn" onClick={() => void updateServiceWorker(true)}>
        {lv.reload}
      </button>
    </div>
  );
}
