import { useEffect, useRef, useState } from 'preact/hooks';
import { HolderTag } from '../cards/HolderTag';
import { Sheet } from '../components/Sheet';
import { backupFileName, createBackup, mergeCards, normalizePins, parseBackup } from '../db/backup';
import { newId, repo } from '../db/repo';
import type { Card, Holder } from '../db/types';
import {
  backupInfo,
  lv,
  replaceSummary,
  replaceWarning,
  restoreSummary,
} from '../i18n/lv';
import { formatDate, localIsoDate } from '../lib/dates';
import { saveFile } from '../lib/share';
import { applyTheme, getTheme, themes } from '../theme';
import './Iestatijumi.css';

interface Props {
  cards: Card[];
  holders: Holder[];
  /** Cards or holders changed (restore, rename): reload them. */
  onChanged: () => void;
  onClose: () => void;
}

type Restore = { cards: Card[]; holders: Holder[]; exportedAt: string | null };

const VERSION = __APP_VERSION__ + (import.meta.env.VITE_COMMIT ? ` (${import.meta.env.VITE_COMMIT})` : '');

const day = (iso: string) => formatDate(localIsoDate(new Date(iso)));

/** Iestatījumi — SPEC 6.4 (and backup, SPEC 8). */
export function Iestatijumi({ cards, holders, onChanged, onClose }: Props) {
  const [themeId, setThemeId] = useState('default');
  const [lastBackup, setLastBackup] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [readyFile, setReadyFile] = useState<File | null>(null);
  const [restore, setRestore] = useState<Restore | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [message, setMessage] = useState<{ title: string; text: string } | null>(null);
  const [renaming, setRenaming] = useState<{ holder: Holder; name: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void repo.getMeta('lastBackupAt').then(setLastBackup);
    void repo.getMeta('themeId').then((id) => setThemeId(getTheme(id).id));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* ----- Izskats ----- */

  const pickTheme = async (id: string) => {
    setThemeId(id);
    applyTheme(getTheme(id));
    await repo.setMeta('themeId', id);
  };

  /* ----- Saglabāt kopiju ----- */

  const deliver = async (file: File) => {
    const outcome = await saveFile(file);
    if (outcome === 'needs-tap') {
      setReadyFile(file);
      return;
    }
    setReadyFile(null);
    if (outcome === 'shared' || outcome === 'downloaded') {
      const now = new Date().toISOString();
      await repo.setMeta('lastBackupAt', now);
      setLastBackup(now);
    }
  };

  const saveBackup = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const [all, hs] = await Promise.all([repo.listCards(), repo.listHolders()]);
      const text = await createBackup(all, hs);
      await deliver(new File([text], backupFileName(), { type: 'application/json' }));
    } catch {
      setMessage({ title: lv.saveBackup, text: lv.backupFailed });
    } finally {
      setSaving(false);
    }
  };

  /* ----- Atjaunot no kopijas ----- */

  const onFilePicked = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // so the same file can be picked again
    if (!file) return;
    let text = '';
    try {
      text = await file.text();
    } catch {
      /* unreadable → reported as not a backup */
    }
    const parsed = parseBackup(text);
    if (!parsed.ok) {
      setMessage({ title: lv.restoreBackup, text: parsed.reason === 'newer' ? lv.backupTooNew : lv.notABackup });
      return;
    }
    setRestore(parsed);
  };

  const merge = async () => {
    if (!restore) return;
    const result = mergeCards(await repo.listCards(), restore.cards, newId);
    await repo.putCards(result.put);
    setRestore(null);
    setMessage({ title: lv.restored, text: restoreSummary(result.added, result.existing, result.updated) });
    onChanged();
  };

  const replace = async () => {
    if (!restore) return;
    const incoming = normalizePins(restore.cards.map((c) => (c.id ? c : { ...c, id: newId() })));
    await repo.replaceAllCards(incoming);
    for (const h of restore.holders) await repo.renameHolder(h.id, h.name);
    setRestore(null);
    setConfirmReplace(false);
    setMessage({ title: lv.restored, text: replaceSummary(incoming.length) });
    onChanged();
  };

  /* ----- Turētāji ----- */

  const rename = async () => {
    if (!renaming || !renaming.name.trim()) return;
    await repo.renameHolder(renaming.holder.id, renaming.name);
    setRenaming(null);
    onChanged();
  };

  return (
    <div class="settings" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header class="settings__bar">
        <button type="button" class="settings__back" onClick={onClose}>
          <svg width="12" height="20" viewBox="0 0 12 20" aria-hidden="true">
            <path d="M10 2 2 10l8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {lv.cards}
        </button>
      </header>

      <div class="settings__body">
        <h1 id="settings-title" class="t-large-title settings__title">
          {lv.settings}
        </h1>

        <Group title={lv.appearance}>
          {themes.map((t) => (
            <button key={t.id} type="button" class="settings__row" aria-pressed={t.id === themeId} onClick={() => void pickTheme(t.id)}>
              <span class="settings__row-label">{t.name}</span>
              {t.id === themeId && <Check />}
            </button>
          ))}
        </Group>

        <Group title={lv.backup}>
          <div class="settings__row">
            <span class="settings__row-label">{lv.lastBackup}</span>
            <span class="settings__row-value">{lastBackup ? day(lastBackup) : lv.never}</span>
          </div>
          <button type="button" class="settings__row" disabled={saving} onClick={() => void saveBackup()}>
            <span class="settings__row-label settings__row-label--action">{lv.saveBackup}</span>
            <span class="settings__row-value">{saving ? lv.preparing : lv.files}</span>
          </button>
          <button type="button" class="settings__row" onClick={() => fileInput.current?.click()}>
            <span class="settings__row-label settings__row-label--action">{lv.restoreBackup}</span>
            <span class="settings__row-value">{lv.files}</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            class="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => void onFilePicked(e)}
          />
        </Group>

        <Group title={lv.holders}>
          {holders.map((h) => (
            <button key={h.id} type="button" class="settings__row" onClick={() => setRenaming({ holder: h, name: h.name })}>
              <span class="settings__row-label">
                {h.id === 'pe' ? h.name : <HolderTag holder={h} size="md" />}
              </span>
              <span class="settings__row-value">{cards.filter((c) => c.holder === h.id).length}</span>
              <Chevron />
            </button>
          ))}
        </Group>

        <Group title={lv.about}>
          <div class="settings__row">
            <span class="settings__row-label">{lv.version}</span>
            <span class="settings__row-value">{VERSION}</span>
          </div>
        </Group>
      </div>

      {readyFile && (
        <Sheet
          title={lv.backupReady}
          onDismiss={() => setReadyFile(null)}
          actions={[
            { label: lv.saveBackup, kind: 'primary', onClick: () => void deliver(readyFile) },
            { label: lv.cancel, onClick: () => setReadyFile(null) },
          ]}
        />
      )}

      {restore && !confirmReplace && (
        <Sheet
          title={lv.restoreBackup}
          text={backupInfo(restore.cards.length, restore.exportedAt && day(restore.exportedAt))}
          onDismiss={() => setRestore(null)}
          actions={[
            { label: lv.merge, kind: 'primary', hint: lv.mergeHint, onClick: () => void merge() },
            {
              label: lv.replace,
              hint: lv.replaceHint,
              disabled: restore.cards.length === 0,
              onClick: () => (cards.length ? setConfirmReplace(true) : void replace()),
            },
            { label: lv.cancel, onClick: () => setRestore(null) },
          ]}
        />
      )}

      {restore && confirmReplace && (
        <Sheet
          title={lv.replaceTitle}
          text={replaceWarning(cards.length)}
          onDismiss={() => setConfirmReplace(false)}
          actions={[
            { label: lv.replace, kind: 'destructive', onClick: () => void replace() },
            { label: lv.cancel, onClick: () => setConfirmReplace(false) },
          ]}
        />
      )}

      {message && (
        <Sheet
          title={message.title}
          text={message.text}
          onDismiss={() => setMessage(null)}
          actions={[{ label: lv.done, kind: 'primary', onClick: () => setMessage(null) }]}
        />
      )}

      {renaming && (
        <Sheet
          title={lv.holderName}
          onDismiss={() => setRenaming(null)}
          actions={[
            { label: lv.done, kind: 'primary', disabled: !renaming.name.trim(), onClick: () => void rename() },
            { label: lv.cancel, onClick: () => setRenaming(null) },
          ]}
        >
          <input
            class="sheet__input"
            value={renaming.name}
            aria-label={lv.holderName}
            autocomplete="off"
            autocapitalize="words"
            enterkeyhint="done"
            maxLength={30}
            ref={(el) => el?.focus()}
            onInput={(e) => setRenaming({ ...renaming, name: (e.currentTarget as HTMLInputElement).value })}
            onKeyDown={(e) => e.key === 'Enter' && void rename()}
          />
        </Sheet>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: preact.ComponentChildren }) {
  return (
    <section class="settings__group">
      <h2 class="settings__group-title">{title}</h2>
      <div class="settings__list">{children}</div>
    </section>
  );
}

const Check = () => (
  <svg class="settings__check" width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
    <path d="M1.5 7.5 6.5 12 16.5 2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
);

const Chevron = () => (
  <svg class="settings__chevron" width="8" height="14" viewBox="0 0 8 14" aria-hidden="true">
    <path d="m1.5 1.5 5 5.5-5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
);
