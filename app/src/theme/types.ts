/**
 * A theme is just a token set (SPEC 6.4: "new themes are just new token sets").
 * Every token becomes a CSS custom property: `bg` → `--bg`, `cardColors[3]` → `--card-3`.
 */
export interface Theme {
  id: string;
  /** Name shown in Iestatījumi → Izskats. */
  name: string;
  colors: {
    bg: string;
    text: string;
    textSecondary: string;
    groupHeader: string;
    groupedFill: string;
    separator: string;
    chevron: string;
    cardInk: string;
    tagBg: string;
    tagText: string;
    buttonBg: string;
    buttonText: string;
    chipSelectedBg: string;
    chipSelectedText: string;
    chipBg: string;
    chipText: string;
    sheet: string;
    sheetGrabber: string;
    sheetControl: string;
    sheetControlText: string;
    flagBg: string;
    flagText: string;
    flagDot: string;
    flagBorder: string;
    statusExpiring: string;
    statusExpired: string;
    /** Background behind generated codes — always white for scanners. */
    codeBg: string;
    codeInk: string;
  };
  /** Exactly 8 card colours, indexed by Card.colorIndex. */
  cardColors: readonly [string, string, string, string, string, string, string, string];
  contour: {
    stroke: string;
    opacity: number;
    indexOpacity: number;
    width: number;
    indexWidth: number;
  };
}
