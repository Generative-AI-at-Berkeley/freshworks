import { STORAGE_KEYS } from '@/config/constants';
import { DEW_THEME_CLASS, Theme } from '@/config/enums';
import { readLocalStorage, writeLocalStorage } from '@/lib/local-store';

/**
 * Dew switches themes by a class on <html>, so that class is the single
 * source of truth. A stored value is an explicit choice. No stored value means
 * follow the system.
 */
export function readStoredTheme(): Theme | null {
  const stored = readLocalStorage(STORAGE_KEYS.theme);
  return stored === Theme.Dark || stored === Theme.Light ? stored : null;
}

export function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? Theme.Dark : Theme.Light;
}

export function resolveTheme(): Theme {
  return readStoredTheme() ?? systemTheme();
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.remove(DEW_THEME_CLASS.light, DEW_THEME_CLASS.dark);
  root.classList.add(DEW_THEME_CLASS[theme]);
  root.style.colorScheme = theme;
  writeLocalStorage(STORAGE_KEYS.theme, theme);
}

/**
 * Runs before first paint, inlined in <head>. Without it the server sends the
 * light theme and the client corrects it on mount, which a dark-mode user sees
 * as a white flash. A string because it runs before React exists.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  STORAGE_KEYS.theme,
)});var d=s?s==="dark":matchMedia("(prefers-color-scheme: dark)").matches;var c=document.documentElement.classList;c.remove(${JSON.stringify(
  DEW_THEME_CLASS.light,
)},${JSON.stringify(DEW_THEME_CLASS.dark)});c.add(d?${JSON.stringify(DEW_THEME_CLASS.dark)}:${JSON.stringify(
  DEW_THEME_CLASS.light,
)});document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
