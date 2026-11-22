/** Date helpers. Storage: ISO "YYYY-MM-DD". Display: "DD.MM.YYYY" (SPEC 0). */

const pad = (n: number) => String(n).padStart(2, '0');

const lastDayOfMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

function toIso(year: number, month: number, day: number): string | null {
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  if (day < 1 || day > lastDayOfMonth(year, month)) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

const fullYear = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));

/**
 * Parse what's printed on a card or typed by the user:
 * "30.09.2026", "30/09/2026", "30-09-26", "09/2027", "09.2027", "9/27", "2027-09-30".
 * Month/year only → last day of that month. Returns ISO or null.
 */
export function parseEndDate(input: string): string | null {
  const s = input.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return toIso(Number(m[1]), Number(m[2]), Number(m[3]));

  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})$/);
  if (m) return toIso(fullYear(m[3]), Number(m[2]), Number(m[1]));

  m = s.match(/^(\d{1,2})[./-](\d{4}|\d{2})$/);
  if (m) {
    const year = fullYear(m[2]);
    const month = Number(m[1]);
    if (month < 1 || month > 12) return null;
    return toIso(year, month, lastDayOfMonth(year, month));
  }
  return null;
}

/** "2026-09-30" → "30.09.2026". */
export function formatDate(iso: string): string {
  const [y, mo, d] = iso.slice(0, 10).split('-');
  return `${d}.${mo}.${y}`;
}

/** Local calendar date as ISO, e.g. today → "2026-11-22". */
export function localIsoDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

export type ExpiryStatus = 'expired' | 'expiring' | null;

/** SPEC 7: "Beidzas drīz" if ≤ 30 days left; "Beigusies" if past. The end date itself is still valid. */
export function expiryStatus(endDate: string | null, today: string = localIsoDate()): ExpiryStatus {
  if (!endDate) return null;
  const daysLeft = dayNumber(endDate) - dayNumber(today);
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 30) return 'expiring';
  return null;
}
