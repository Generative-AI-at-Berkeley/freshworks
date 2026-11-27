import { OrgView } from '@/components/views/org-view';

export default async function OrgPage({ params }: { params: Promise<{ orgUnitId: string }> }) {
  const { orgUnitId } = await params;
  return <OrgView orgUnitId={decodeURIComponent(orgUnitId)} />;
}
