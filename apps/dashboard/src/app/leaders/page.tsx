'use client';

import { WithSession } from '@/components/common/with-session';
import { LeaderView } from '@/components/views/leader-view';

/** The signed-in person's own chain. Other leaders are /leaders/[managerId]. */
export default function MyLeaderPage() {
  return (
    <WithSession title="Leaders">
      {(session) => <LeaderView managerId={session.engineerId} />}
    </WithSession>
  );
}
