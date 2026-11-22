import { render } from 'preact';
import { App } from './App';
import { repo } from './db/repo';
import { applyTheme, getTheme } from './theme';
import { requestPersistentStorage } from './pwa';
import './styles/base.css';

async function start() {
  applyTheme(getTheme(await repo.getMeta('themeId')));
  void requestPersistentStorage(repo);

  // Sample data only in dev mode and the separate /demo/ build (SPEC 9, DECISIONS D8).
  // Not part of the real app's bundle: the condition must be written inline (not via
  // IS_DEMO) so the bundler can drop the sample-data chunk from the real build.
  if (import.meta.env.DEV || import.meta.env.MODE === 'demo') {
    const [{ seedIfEmpty }, { canvasSeedPhoto }] = await Promise.all([
      import('./db/seed'),
      import('./db/seedPhoto'),
    ]);
    await seedIfEmpty(repo, canvasSeedPhoto);
  }

  render(<App />, document.getElementById('app')!);
}

void start();
