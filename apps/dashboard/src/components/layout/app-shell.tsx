'use client';

import { Icon, IconButton } from '@freshworks/dew-components';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useSyncExternalStore } from 'react';

import { SessionNote } from '@/components/layout/session-note';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { APP_NAME, STORAGE_KEYS } from '@/config/constants';
import { LANDING_ROUTE, NAV_ITEMS } from '@/config/nav';
import { readLocalStorage, subscribeLocalStorage, writeLocalStorage } from '@/lib/local-store';

import styles from './app-shell.module.css';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // The server has no localStorage, so it renders expanded and the client
  // reconciles without an effect that sets state after mount.
  const collapsed = useSyncExternalStore(
    (onChange) => subscribeLocalStorage(STORAGE_KEYS.sidebarCollapsed, onChange),
    () => readLocalStorage(STORAGE_KEYS.sidebarCollapsed) === 'true',
    () => false,
  );
  const toggle = () => {
    writeLocalStorage(STORAGE_KEYS.sidebarCollapsed, String(!collapsed));
  };

  return (
    <div className={styles.shell}>
      <aside className={collapsed ? `${styles.sidebar} ${styles.collapsed}` : styles.sidebar}>
        <div className={styles.brand}>
          {!collapsed && <NextLink href={LANDING_ROUTE}>{APP_NAME}</NextLink>}
          <IconButton
            iconName={collapsed ? 'ExpandSidebar' : 'CollapseSidebar'}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            onClick={toggle}
          />
        </div>
        <nav className={styles.nav} aria-label="Main">
          {NAV_ITEMS.map((item) => {
            const active = item.isActive(pathname);
            return (
              <NextLink
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                aria-current={active ? 'page' : undefined}
                className={active ? `${styles.link} ${styles.active}` : styles.link}
              >
                <Icon name={item.icon} size="sm" />
                {!collapsed && item.label}
              </NextLink>
            );
          })}
        </nav>
        {!collapsed && (
          <div className={styles.footer}>
            <SessionNote />
            <ThemeToggle />
          </div>
        )}
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
