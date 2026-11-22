import { defaultTheme } from './default';
import type { Theme } from './types';

export type { Theme } from './types';

/** All available themes. Add a new token set here to offer it in Iestatījumi → Izskats. */
export const themes: readonly Theme[] = [defaultTheme];

export function getTheme(id: string | undefined): Theme {
  return themes.find((t) => t.id === id) ?? defaultTheme;
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

/** Theme → CSS custom properties, e.g. { '--text-secondary': '#6C6C70', '--card-0': '#A9B4C6' }. */
export function themeToCssVars(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(theme.colors)) vars[`--${kebab(key)}`] = value;
  theme.cardColors.forEach((c, i) => (vars[`--card-${i}`] = c));
  vars['--contour-stroke'] = theme.contour.stroke;
  vars['--contour-opacity'] = String(theme.contour.opacity);
  vars['--contour-index-opacity'] = String(theme.contour.indexOpacity);
  return vars;
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(themeToCssVars(theme))) root.style.setProperty(name, value);
  root.dataset.theme = theme.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.colors.bg);
}
