import type { IconName } from '@freshworks/dew-components';

import { ROUTES } from '@/config/constants';

/**
 * The ordered sidebar, and the source of the landing route. Reordering the
 * nav moves the landing route with it.
 *
 * Order follows the spec's cut list (7.6): skill adoption and the leader
 * drill-down are the minimum, practice health is the first to drop.
 */
export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  /** A predicate, not a prefix, so a detail route lights up one entry. */
  isActive: (pathname: string) => boolean;
}

const startsWith = (prefix: string) => (pathname: string) => pathname.startsWith(prefix);

export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: 'Skill adoption',
    href: ROUTES.skills,
    icon: 'FavouriteStar',
    isActive: startsWith(ROUTES.skills),
  },
  {
    label: 'Leaders',
    href: ROUTES.leaders,
    icon: 'GroupSharedUsers',
    // An engineer page is reached from the leader drill-down.
    isActive: (pathname) =>
      pathname.startsWith(ROUTES.leaders) || pathname.startsWith('/engineers'),
  },
  { label: 'Org overview', href: ROUTES.org, icon: 'Chart2', isActive: startsWith(ROUTES.org) },
  {
    label: 'Practice health',
    href: ROUTES.practice,
    icon: 'ShowActivities',
    isActive: startsWith(ROUTES.practice),
  },
];

/** Where "/" sends someone. Always the first nav entry. */
export const LANDING_ROUTE = NAV_ITEMS[0]?.href ?? ROUTES.skills;
