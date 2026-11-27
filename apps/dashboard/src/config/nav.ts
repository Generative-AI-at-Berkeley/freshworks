import type { IconName } from '@freshworks/dew-components';

import { ROUTES } from '@/config/constants';

/**
 * The sidebar, grouped by the question a manager is asking: are shared skills
 * catching on, how do my teams and tools compare, and is the practice healthy.
 * The first item is the landing route.
 */
export interface NavItem {
  label: string;
  href: string;
  /** Shown only when the sidebar is collapsed, where text does not fit. */
  icon: IconName;
  /** A predicate, not a prefix, so a detail route lights up one entry. */
  isActive: (pathname: string) => boolean;
}

export interface NavGroup {
  label: string;
  items: readonly NavItem[];
}

const startsWith = (prefix: string) => (pathname: string) => pathname.startsWith(prefix);

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'Adoption',
    items: [
      {
        label: 'Skill adoption',
        href: ROUTES.skills,
        icon: 'FavouriteStar',
        isActive: startsWith(ROUTES.skills),
      },
    ],
  },
  {
    label: 'Organization',
    items: [
      {
        label: 'Teams',
        href: ROUTES.leaders,
        icon: 'GroupSharedUsers',
        // An engineer page is reached from the team drill-down.
        isActive: (pathname) =>
          pathname.startsWith(ROUTES.leaders) || pathname.startsWith('/engineers'),
      },
      {
        label: 'Tools and cost',
        href: ROUTES.org,
        icon: 'Chart2',
        isActive: startsWith(ROUTES.org),
      },
    ],
  },
  {
    label: 'Practice',
    items: [
      {
        label: 'Practice health',
        href: ROUTES.practice,
        icon: 'ShowActivities',
        isActive: startsWith(ROUTES.practice),
      },
    ],
  },
];

export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

/** Where "/" sends someone. Always the first nav entry. */
export const LANDING_ROUTE = NAV_ITEMS[0]?.href ?? ROUTES.skills;
