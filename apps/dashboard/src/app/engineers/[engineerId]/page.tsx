import { EngineerView } from '@/components/views/engineer-view';

export default async function EngineerPage({
  params,
}: {
  params: Promise<{ engineerId: string }>;
}) {
  const { engineerId } = await params;
  return <EngineerView engineerId={decodeURIComponent(engineerId)} />;
}
