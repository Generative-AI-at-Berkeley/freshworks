'use client';

import type { ReactNode } from 'react';

import { QueryView } from '@/components/common/states';
import { Page } from '@/components/layout/page';
import { useSession } from '@/hooks/use-session';
import type { Session } from '@/lib/session';

/** For "my" routes: waits for the session, then renders the view for the signed-in person. */
export function WithSession({
  title,
  children,
}: {
  title: string;
  children: (session: Session) => ReactNode;
}) {
  const session = useSession();
  if (session.isSuccess) return <>{children(session.data)}</>;
  return (
    <Page title={title}>
      <QueryView query={session}>{() => null}</QueryView>
    </Page>
  );
}
