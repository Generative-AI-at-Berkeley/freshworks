'use client';

import { Avatar, Icon, IconButton } from '@freshworks/dew-components';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useSyncExternalStore } from 'react';

import { SessionNote } from '@/components/layout/session-note';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { APP_NAME, STORAGE_KEYS } from '@/config/constants';
import { LANDING_ROUTE, NAV_GROUPS } from '@/config/nav';
import { useWithRange } from '@/hooks/use-range';
import { useSession } from '@/hooks/use-session';
import { readLocalStorage, subscribeLocalStorage, writeLocalStorage } from '@/lib/local-store';

import styles from './app-shell.module.css';

function NavLinks({
  collapsed,
  withRange,
}: {
  collapsed: boolean;
  withRange: (href: string) => string;
}) {
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label="Main">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className={styles.group}>
          {!collapsed && <p className={styles.groupLabel}>{group.label}</p>}
          {group.items.map((item) => {
            const active = item.isActive(pathname);
            return (
              <NextLink
                key={item.href}
                href={withRange(item.href)}
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}
                aria-current={active ? 'page' : undefined}
                className={active ? `${styles.link} ${styles.active}` : styles.link}
              >
                {collapsed ? <Icon name={item.icon} size="sm" /> : item.label}
              </NextLink>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Which organization this is and who is looking. Names come from the session, never from the page. */
function Scope() {
  const session = useSession();
  const data = session.data;
  if (!data) return <div className={styles.scope} aria-hidden="true" />;
  const viewer = data.displayName ?? data.engineerId;
  return (
    <div className={styles.scope}>
      <p className={styles.org}>{data.orgUnitName ?? data.orgUnitId}</p>
      <div className={styles.viewer}>
        <Avatar name={viewer} size="xs" />
        <span>{viewer}</span>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  // The server has no localStorage, so it renders expanded and the client
  // reconciles without an effect that sets state after mount.
  const collapsed = useSyncExternalStore(
    (onChange) => subscribeLocalStorage(STORAGE_KEYS.sidebarCollapsed, onChange),
    () => readLocalStorage(STORAGE_KEYS.sidebarCollapsed) === 'true',
    () => false,
  );
  // Switching sections keeps the chosen period.
  const withRange = useWithRange();
  const toggle = () => {
    writeLocalStorage(STORAGE_KEYS.sidebarCollapsed, String(!collapsed));
  };

  return (
    <div className={styles.shell}>
      <aside className={collapsed ? `${styles.sidebar} ${styles.collapsed}` : styles.sidebar}>
        <div className={styles.brand}>
          {!collapsed && (
            <NextLink href={LANDING_ROUTE} className={styles.product}>
              {APP_NAME}
            </NextLink>
          )}
          <IconButton
            iconName={collapsed ? 'ExpandSidebar' : 'CollapseSidebar'}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            onClick={toggle}
          />
        </div>
        {!collapsed && <Scope />}
        <NavLinks collapsed={collapsed} withRange={withRange} />
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
