import { NOT_MEASURED, NOT_PRICED } from '@/lib/format';

import styles from './value.module.css';

const MISSING = {
  measured: {
    text: NOT_MEASURED,
    why: 'This tool does not record it, so it is left out rather than shown as zero.',
  },
  priced: {
    text: NOT_PRICED,
    why: 'No sourced price exists for this usage yet, so no cost is shown.',
  },
  unused: { text: 'Not used yet', why: 'Nobody who installed it has used it in this range.' },
} as const;

interface ValueProps {
  value: number | null;
  format: (value: number) => string;
  /** What kind of gap a null is. Changes the wording and the hover explanation. */
  missing?: keyof typeof MISSING;
}

/**
 * A number, or a muted "Not measured" that explains itself on hover. Unknown
 * must look different from real data, and must never look like zero.
 */
export function Value({ value, format, missing = 'measured' }: ValueProps) {
  if (value === null) {
    return (
      <span className={styles.unknown} title={MISSING[missing].why}>
        {MISSING[missing].text}
      </span>
    );
  }
  return <span className={styles.num}>{format(value)}</span>;
}

/** A second, quieter line under a cell's main value. */
export function Secondary({ children }: { children: string }) {
  return <span className={styles.secondary}>{children}</span>;
}
