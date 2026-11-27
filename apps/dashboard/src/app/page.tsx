import { redirect } from 'next/navigation';

import { LANDING_ROUTE } from '@/config/nav';

/** The landing route comes from the nav, so reordering the sidebar moves it. */
export default function RootPage() {
  redirect(LANDING_ROUTE);
}
