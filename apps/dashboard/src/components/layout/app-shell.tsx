'use client';

import { Avatar, Icon, Popover, TopNavigation, Tooltip } from '@freshworks/dew-components';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useSyncExternalStore } from 'react';

import { FreshworksLogo } from '@/components/layout/freshworks-logo';
import { SessionNote } from '@/components/layout/session-note';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { LANDING_ROUTE, NAV_GROUPS } from '@/config/nav';
import { useWithRange } from '@/hooks/use-range';
import { useSession } from '@/hooks/use-session';

import styles from './app-shell.module.css';

/**
 * Icon rail as in Freshworks' Dew products: icons only, the label in a
 * tooltip, the filled icon on the active page. Groups are split by a gap.
 */
const noop = () => () => undefined;

function Rail() {
  const pathname = usePathname();
  // Dew's Tooltip reads `document` while rendering, so it joins after hydration.
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  // Switching sections keeps the chosen period.
  const withRange = useWithRange();
  return (
    <nav className={styles.rail} aria-label="Main">
      {NAV_GROUPS.map((group) => (
        <ul key={group.label} className={styles.group} aria-label={group.label}>
          {group.items.map((item) => {
            const active = item.isActive(pathname);
            const link = (
              <NextLink
                href={withRange(item.href)}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={styles.link}
              >
                <span className={styles.iconRest}>
                  <Icon name={item.icon} size="md" color="currentColor" />
                </span>
                <span className={styles.iconActive}>
                  <Icon name={item.activeIcon} size="md" color="currentColor" />
                </span>
              </NextLink>
            );
            return (
              <li key={item.href}>
                {mounted ? (
                  <Tooltip content={item.label} placement="right">
                    {link}
                  </Tooltip>
                ) : (
                  link
                )}
              </li>
            );
          })}
        </ul>
      ))}
    </nav>
  );
}

/** Who is looking and at which org, plus the theme. Names come from the session, never the page. */
function Profile() {
  const session = useSession();
  const data = session.data;
  if (!data) return <span className={styles.avatarSlot} aria-hidden="true" />;
  const viewer = data.displayName ?? data.engineerId;
  const org = data.orgUnitName ?? data.orgUnitId;
  return (
    <Popover placement="bottom-end" mode="click">
      <Popover.Trigger asChild>
        <button type="button" className={styles.avatarButton} aria-label={`Profile, ${viewer}`}>
          <Avatar name={viewer} size="sm" colorVariant="info" />
        </button>
      </Popover.Trigger>
      <Popover.Content className={styles.profile}>
        <div className={styles.who}>
          <Avatar name={viewer} size="md" colorVariant="info" />
          <div>
            <p className={styles.name}>{viewer}</p>
            <p className={styles.org}>{org}</p>
          </div>
        </div>
        <div className={styles.profileRow}>
          <ThemeToggle />
        </div>
      </Popover.Content>
    </Popover>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <div className={styles.top}>
        <TopNavigation aria-label="Product">
          <TopNavigation.Left>
            <NextLink href={LANDING_ROUTE} className={styles.product} aria-label="Home">
              <FreshworksLogo height={26} />
            </NextLink>
          </TopNavigation.Left>
          <TopNavigation.Right buttons={<SessionNote />} avatar={<Profile />} />
        </TopNavigation>
      </div>
      <Rail />
      <main className={styles.panel}>{children}</main>
    </div>
  );
}
