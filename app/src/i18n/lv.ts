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
  never: 'Vēl nav', // NEW — "Pēdējā kopija: Vēl nav" before the first backup

  // Pievienot / Apstrāde
  takePhoto: 'Uzņemt foto',
  fromGallery: 'No galerijas',
  cancel: 'Atcelt',
  foundBarcode: 'Atrasts svītrkods',
  readingText: 'Lasa tekstu…',
  findingEndDate: 'Meklē derīguma termiņu',
  findingHolder: 'Meklē turētāju',

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

  // Apgriešana
  crop: 'Apgriezt',
  rotate90: 'Pagriezt 90°',
  reset: 'Atiestatīt',
  done: 'Gatavs',

  // Kartes detaļas
  cardDetails: 'Kartes detaļas',
  lastUsed: 'Pēdējo reizi lietota',
  delete: 'Dzēst',

  // System
  demo: 'Demo', // NEW — badge in the /demo/ build with sample cards
  addToHomeScreen: 'Pievienot sākuma ekrānam',
  updateAvailable: 'Pieejama jauna versija',
  reload: 'Pārlādēt',
} as const;

export type Strings = typeof lv;

/** "Pievienotas 3 · Jau bija 11" (SPEC 8). */
export const restoreSummary = (added: number, existing: number) =>
  `Pievienotas ${added} · Jau bija ${existing}`;
