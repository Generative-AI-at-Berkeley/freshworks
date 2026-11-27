import { Tag, type TTagVariant } from '@freshworks/dew-components';

import { type SkillStatus, STATUS_META } from '@/lib/skill-status';

const VARIANT: Record<(typeof STATUS_META)[SkillStatus]['tone'], TTagVariant> = {
  negative: 'red',
  caution: 'yellow',
  positive: 'green',
  neutral: 'blue',
  muted: 'gray',
};

export function StatusLabel({ status }: { status: SkillStatus }) {
  const meta = STATUS_META[status];
  return <Tag variant={VARIANT[meta.tone]}>{meta.label}</Tag>;
}
