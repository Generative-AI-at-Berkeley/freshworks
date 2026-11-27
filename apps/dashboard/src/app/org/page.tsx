'use client';

import { WithSession } from '@/components/common/with-session';
import { OrgView } from '@/components/views/org-view';

/** The signed-in person's own org unit. Others are /org/[orgUnitId]. */
export default function MyOrgPage() {
  return (
    <WithSession title="Org overview">
      {(session) => <OrgView orgUnitId={session.orgUnitId} />}
    </WithSession>
  );
}
