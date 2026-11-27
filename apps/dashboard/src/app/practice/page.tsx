import { EmptyState } from '@/components/common/states';
import { Page } from '@/components/layout/page';

/**
 * Practice health (spec 7.6) is the first view to cut, so it waits until the
 * other three work end to end. It needs an API route for antipattern
 * findings, which no ticket has yet. TODO(X-3).
 */
export default function PracticePage() {
  return (
    <Page
      title="Practice health"
      description="Habits that make AI tools less useful, such as abandoned sessions or unreviewed large edits, spotted across a team."
    >
      <EmptyState
        title="Not built yet"
        description="This view needs an API route for practice findings. It comes after skill adoption, leaders and org overview work end to end."
      />
    </Page>
  );
}
