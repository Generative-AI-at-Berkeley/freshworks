'use client';

import { Toggle } from '@freshworks/dew-components';
import { useSyncExternalStore } from 'react';

import { STORAGE_KEYS } from '@/config/constants';
import { Theme } from '@/config/enums';
import { subscribeLocalStorage } from '@/lib/local-store';
import { applyTheme, resolveTheme } from '@/lib/theme';

export function ThemeToggle() {
  // Null on the server, which has no localStorage or media query.
  const theme = useSyncExternalStore(
    (onChange) => subscribeLocalStorage(STORAGE_KEYS.theme, onChange),
    resolveTheme,
    () => null,
  );
  return (
    <Toggle
      size="small"
      label="Dark mode"
      checked={theme === Theme.Dark}
      onChange={(checked) => {
        applyTheme(checked ? Theme.Dark : Theme.Light);
      }}
    />
  );
}
