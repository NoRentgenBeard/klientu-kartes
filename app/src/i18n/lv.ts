/**
 * All Latvian UI text in one place (SPEC 10). Every string here is reviewed by the owner.
 * Strings marked `// NEW` were added beyond SPEC 10 and still need review.
 */
export const lv = {
  // Sākums
  cards: 'Kartes',
  pinned: 'Piespraustās',
  all: 'Visas',
  allCards: 'Visas kartes',
  addCard: 'Pievienot karti',
  emptyText: 'Vēl nav nevienas kartes. Pievieno pirmo — nofotografē karti vai izvēlies attēlu.', // NEW

  // Holders (default names; renamable in Iestatījumi)
  holderPe: 'Personīgā',
  holderHf: 'Happy Fish',
  holderZj: 'Zaļā josta',

  // Status
  expiringSoon: 'Beidzas drīz',
  expired: 'Beigusies',
  validUntil: 'Derīga līdz',
  noEndDate: 'Bez termiņa',

  // Kasē
  photo: 'Foto',
  code: 'Kods',
  pin: 'Piespraust', // NEW — pin button (screen readers)
  unpin: 'Atspraust', // NEW
  pinFullTitle: 'Jau piespraustas 4 kartes', // NEW
  pinFullText: 'Kuru aizstāt?', // NEW
  codeUnavailable: 'No šī numura kodu izveidot nevar.', // NEW — shown if the number can't be drawn as a code
  close: 'Aizvērt', // NEW — close Kasē (screen readers; swipe down also closes)

  // Iestatījumi
  settings: 'Iestatījumi',
  appearance: 'Izskats',
  backup: 'Rezerves kopija',
  lastBackup: 'Pēdējā kopija',
  saveBackup: 'Saglabāt kopiju',
  restoreBackup: 'Atjaunot no kopijas',
  files: 'Faili',
  merge: 'Pievienot',
  replace: 'Aizstāt',
  holders: 'Turētāji',
  about: 'Par lietotni',
  version: 'Versija',
  never: 'Vēl nav', // NEW — "Pēdējā kopija: Vēl nav" before the first backup; also "Pēdējo reizi lietota"
  preparing: 'Sagatavo…', // NEW — while the backup file is made
  backupReady: 'Kopija ir gatava', // NEW — if iPhone needs one more tap before the share sheet
  backupFailed: 'Kopiju neizdevās saglabāt.', // NEW
  mergeHint: 'Pievieno jaunās kartes, esošās paliek.', // NEW — under "Pievienot"
  replaceHint: 'Izdzēš kartes šajā telefonā un ieliek kartes no kopijas.', // NEW — under "Aizstāt"
  replaceTitle: 'Aizstāt visas kartes?', // NEW
  restored: 'Kopija atjaunota', // NEW
  notABackup: 'Šis fails nav Klientu karšu kopija.', // NEW
  backupTooNew: 'Šī kopija ir no jaunākas lietotnes versijas. Vispirms atjaunini lietotni.', // NEW
  holderName: 'Turētāja nosaukums', // NEW — rename sheet title

  // Pievienot / Apstrāde
  takePhoto: 'Uzņemt foto',
  fromGallery: 'No galerijas',
  cancel: 'Atcelt',
  foundBarcode: 'Atrasts svītrkods',
  readingText: 'Lasa tekstu…',
  findingEndDate: 'Meklē derīguma termiņu',
  findingHolder: 'Meklē turētāju',
  searchingCode: 'Meklē kodu…', // NEW — first step before the code is found
  foundQr: 'Atrasts QR kods', // NEW — like "Atrasts svītrkods", for QR codes
  imageUnreadable: 'Šo attēlu neizdevās atvērt. Pamēģini citu foto.', // NEW

  // Pārbaude
  review: 'Pārbaude',
  company: 'Uzņēmums',
  number: 'Numurs',
  recrop: 'Apgriezt no jauna',
  holder: 'Turētājs',
  color: 'Krāsa',
  check: 'Pārbaudi',
  accept: 'Apstiprināt',
  noCodeFound: 'Kods netika atrasts',
  generatedFromNumber: 'Izveidots no numura',
  datePlaceholder: 'DD.MM.GGGG vai MM/GGGG', // NEW
  dateNotUnderstood: 'Nesaprotu datumu — raksti, piem., 30.09.2027 vai 09/2027', // NEW
  acceptHint: 'Lai apstiprinātu, vajag uzņēmumu, numuru un turētāju.', // NEW
  zoom: 'Tuvināt', // NEW — zoom slider in the crop editor (screen readers)

  // Apgriešana
  crop: 'Apgriezt',
  rotate90: 'Pagriezt 90°',
  reset: 'Atiestatīt',
  done: 'Gatavs',

  // Kartes detaļas
  cardDetails: 'Kartes detaļas',
  lastUsed: 'Pēdējo reizi lietota',
  delete: 'Dzēst',
  save: 'Saglabāt', // NEW — bottom button in Kartes detaļas
  originalPhoto: 'Oriģinālais foto', // NEW
  deleteTitle: 'Dzēst šo karti?', // NEW

  // System
  demo: 'Demo', // NEW — badge in the /demo/ build with sample cards
  addToHomeScreen: 'Pievienot sākuma ekrānam',
  updateAvailable: 'Pieejama jauna versija',
  reload: 'Pārlādēt',
} as const;

export type Strings = typeof lv;

/** Latvian: 1, 21, 31… take the singular; 11 doesn't. */
const one = (n: number) => n % 10 === 1 && n % 100 !== 11;

/** "14 kartes", "1 karte", "21 karte". */
export const cardCount = (n: number) => `${n} ${one(n) ? 'karte' : 'kartes'}`;

/** "Pievienotas 3 · Jau bija 11" (SPEC 8), plus "· Atjauninātas 2" when newer versions replaced old ones. */
export const restoreSummary = (added: number, existing: number, updated = 0) =>
  `${one(added) ? 'Pievienota' : 'Pievienotas'} ${added} · Jau bija ${existing}` +
  (updated ? ` · ${one(updated) ? 'Atjaunināta' : 'Atjauninātas'} ${updated}` : ''); // NEW: "Atjauninātas"

/** NEW — after "Aizstāt": "Atjaunotas 14 kartes". */
export const replaceSummary = (n: number) => `${one(n) ? 'Atjaunota' : 'Atjaunotas'} ${cardCount(n)}`;

/** NEW — "Kopijā ir 14 kartes · 23.11.2026". */
export const backupInfo = (n: number, date: string | null) => `Kopijā ir ${cardCount(n)}${date ? ` · ${date}` : ''}`;

/** NEW — "Telefonā ir 12 kartes — tās tiks izdzēstas. To nevar atsaukt." */
export const replaceWarning = (n: number) =>
  `Telefonā ir ${cardCount(n)} — ${one(n) ? 'tā tiks izdzēsta' : 'tās tiks izdzēstas'}. To nevar atsaukt.`;

/** NEW — "Karte „DEPO · Happy Fish“ tiks izdzēsta no šī telefona. To nevar atsaukt." */
export const deleteWarning = (name: string) => `Karte „${name}“ tiks izdzēsta no šī telefona. To nevar atsaukt.`;
