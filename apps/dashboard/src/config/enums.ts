/** Every status or kind is a const object with a type (AGENTS.md, Everywhere). */

export const ServerMode = {
  /** No API configured. The proxy answers from src/mock. */
  Mock: 'mock',
  /** Requests go to the fwcoach query API. */
  Api: 'api',
} as const;
export type ServerMode = (typeof ServerMode)[keyof typeof ServerMode];

export const Theme = {
  Light: 'light',
  Dark: 'dark',
} as const;
export type Theme = (typeof Theme)[keyof typeof Theme];

/** Dew themes by class on <html>. See @freshworks/dew-styles colors.css. */
export const DEW_THEME_CLASS: Record<Theme, string> = {
  [Theme.Light]: 'dew-light-theme',
  [Theme.Dark]: 'dew-dark-theme',
};
