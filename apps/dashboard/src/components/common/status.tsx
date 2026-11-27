import { type SkillStatus, STATUS_META } from '@/lib/skill-status';

import styles from './status.module.css';

/** A status as a small dot and a word. The word carries meaning; the dot is only a cue. */
export function StatusLabel({ status }: { status: SkillStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={styles.status} data-tone={meta.tone}>
      <span className={styles.dot} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
