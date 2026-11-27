'use client';

import { Tag } from '@freshworks/dew-components';

import { ServerMode } from '@/config/enums';
import { useSession } from '@/hooks/use-session';

/** Says which data you are looking at, so sample numbers are never mistaken for real ones. */
export function SessionNote() {
  const session = useSession();
  if (!session.data) return null;
  return session.data.mode === ServerMode.Mock ? (
    <span title="No API is configured, so every view shows a made-up org. Set API_BASE_URL to use real data.">
      <Tag variant="yellow">Sample data</Tag>
    </span>
  ) : (
    <span title="Development identity from DASHBOARD_DEV_ENGINEER. Replaced by sign-in later.">
      <Tag variant="gray">{`Signed in as ${session.data.engineerId}`}</Tag>
    </span>
  );
}
