import type { Theme } from './types';

/** "Default" theme — values from SPEC 5.1–5.3. */
export const defaultTheme: Theme = {
  id: 'default',
  name: 'Default',
  colors: {
    bg: '#FFFFFF',
    text: '#000000',
    textSecondary: '#6C6C70',
    groupHeader: '#6A665E',
    groupedFill: '#F4F4F6',
    separator: '#DADADF',
    chevron: '#B8B8BD',
    cardInk: '#1F2328',
    tagBg: '#1F2328',
    tagText: '#F4F2EC',
    buttonBg: '#1F2328',
    buttonText: '#F4F2EC',
    chipSelectedBg: '#1F2328',
    chipSelectedText: '#F4F2EC',
    chipBg: '#E6E4DF',
    chipText: '#1F2328',
    sheet: '#2A2A2D',
    sheetGrabber: '#5A5A5F',
    sheetControl: '#3A3A3E',
    sheetControlText: '#FFFFFF',
    flagBg: '#FFF1D6',
    flagText: '#6B4200',
    flagDot: '#B87500',
    flagBorder: '#D9A441',
    statusExpiring: '#6B3F00',
    statusExpired: '#7F1A1A',
    codeBg: '#FFFFFF',
    codeInk: '#000000',
  },
  cardColors: [
    '#A9B4C6', // slate blue
    '#A9C2AE', // sage
    '#E3D4B8', // sand
    '#CFC8E6', // lavender
    '#E2CD8C', // pale mustard
    '#D9B7A0', // clay
    '#A7C4C6', // grey teal
    '#C5CBD0', // steel grey
  ],
  contour: {
    stroke: '#1F2328',
    opacity: 0.12,
    indexOpacity: 0.24,
    width: 0.85,
    indexWidth: 1.2,
  },
};
