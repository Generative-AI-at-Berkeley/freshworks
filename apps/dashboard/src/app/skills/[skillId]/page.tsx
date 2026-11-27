import { SkillView } from '@/components/views/skill-view';

export default async function SkillPage({ params }: { params: Promise<{ skillId: string }> }) {
  const { skillId } = await params;
  return <SkillView skillId={decodeURIComponent(skillId)} />;
}
