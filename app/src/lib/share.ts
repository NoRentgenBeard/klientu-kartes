/**
 * Hands a file to the user: the iOS share sheet (→ "Saglabāt failos" / Save to Files) where
 * available, otherwise a normal download.
 *
 * - shared / downloaded: done
 * - cancelled: the user closed the share sheet
 * - needs-tap: Safari wants a fresh tap before opening the share sheet (preparing the file
 *   took too long after the original tap); call again from a button press.
 */
export type SaveOutcome = 'shared' | 'downloaded' | 'cancelled' | 'needs-tap';

export async function saveFile(file: File): Promise<SaveOutcome> {
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      const name = e instanceof DOMException ? e.name : '';
      if (name === 'AbortError') return 'cancelled';
      if (name === 'NotAllowedError') return 'needs-tap';
      // Anything else: fall back to a download.
    }
  }
  download(file);
  return 'downloaded';
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
