import type { IconName } from '@freshworks/dew-components';

import { ROUTES } from '@/config/constants';

/**
 * The icon rail, grouped by the question a manager is asking: are shared
 * skills catching on, how do my teams and tools compare, and is the practice
 * healthy. The first item is the landing route.
 */
export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  /** Dew's filled variant, shown on the active rail item as Freshworks products do. */
  activeIcon: IconName;
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
        icon: 'LeftNavBar/Analytics',
        activeIcon: 'LeftNavBar/AnalyticsSelected',
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
        icon: 'LeftNavBar/Organization',
        activeIcon: 'LeftNavBar/OrganizationSelected',
        // An engineer page is reached from the team drill-down.
        isActive: (pathname) =>
          pathname.startsWith(ROUTES.leaders) || pathname.startsWith('/engineers'),
      },
      {
        label: 'Tools and cost',
        href: ROUTES.org,
        icon: 'LeftNavBar/Dashboard',
        activeIcon: 'LeftNavBar/DashboardSelected',
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
        icon: 'LeftNavBar/Workload',
        activeIcon: 'LeftNavBar/WorkloadSelected',
        isActive: startsWith(ROUTES.practice),
      },
    ],
  },
];

export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

/** Where "/" sends someone. Always the first nav entry. */
export const LANDING_ROUTE = NAV_ITEMS[0]?.href ?? ROUTES.skills;
