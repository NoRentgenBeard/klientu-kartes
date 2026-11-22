import { render } from 'preact';
import { App } from './App';
import { repo } from './db/repo';
import { applyTheme, getTheme } from './theme';
import { requestPersistentStorage } from './pwa';
import './styles/base.css';

async function start() {
  applyTheme(getTheme(await repo.getMeta('themeId')));
  void requestPersistentStorage(repo);

  // Sample data only in dev mode (SPEC 9). Not part of the production bundle.
  if (import.meta.env.DEV) {
    const [{ seedIfEmpty }, { canvasSeedPhoto }] = await Promise.all([
      import('./db/seed'),
      import('./db/seedPhoto'),
    ]);
    await seedIfEmpty(repo, canvasSeedPhoto);
  }

  render(<App />, document.getElementById('app')!);
}

void start();
