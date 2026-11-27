'use client';

import { ServerMode } from '@/config/enums';
import { useSession } from '@/hooks/use-session';

/** Says which data you are looking at, so mock numbers are never mistaken for real ones. */
export function SessionNote() {
  const session = useSession();
  if (!session.data) return null;
  return session.data.mode === ServerMode.Mock ? (
    <span>Mock data. Set API_BASE_URL to use the API.</span>
  ) : (
    <span>Viewing as {session.data.engineerId} (dev identity)</span>
  );
}
