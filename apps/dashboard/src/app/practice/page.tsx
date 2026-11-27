import { EmptyState } from '@/components/common/states';
import { Page } from '@/components/layout/page';

/**
 * Practice health (spec 7.6) is the first view to cut, so it waits until the
 * other three work end to end. It needs an API route for antipattern
 * findings, which no ticket has yet. TODO(X-3).
 */
export default function PracticePage() {
  return (
    <Page title="Practice health">
      <EmptyState title="Not built yet" description="Practice findings need an API route first." />
    </Page>
  );
}
