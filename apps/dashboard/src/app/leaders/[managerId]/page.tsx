import { LeaderView } from '@/components/views/leader-view';

export default async function LeaderPage({ params }: { params: Promise<{ managerId: string }> }) {
  const { managerId } = await params;
  return <LeaderView managerId={decodeURIComponent(managerId)} />;
}
