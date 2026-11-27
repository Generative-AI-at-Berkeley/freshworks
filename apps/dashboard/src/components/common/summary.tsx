import type { ReactNode } from 'react';

import styles from './summary.module.css';

/** A row of figures divided by rules, not boxed one by one. */
export function Summary({ children }: { children: ReactNode }) {
  return <div className={styles.strip}>{children}</div>;
}

export type DeltaTone = 'up' | 'down' | 'flat';

/** A change against the previous period. Tone says direction only, not good or bad. */
export function Delta({
  text,
  tone,
  against,
}: {
  text: string;
  tone: DeltaTone;
  against?: string;
}) {
  return (
    <span className={styles.delta}>
      <span className={styles.deltaValue} data-tone={tone}>
        {text}
      </span>
      {against && <span className={styles.against}> {against}</span>}
    </span>
  );
}

interface FigureProps {
  label: string;
  value: ReactNode;
  of?: string;
  note?: ReactNode;
  /** Shown as a native tooltip on the label, for how the number is counted. */
  definition?: string;
}

export function Figure({ label, value, of, note, definition }: FigureProps) {
  return (
    <div className={styles.cell}>
      <p className={styles.label}>
        {definition ? (
          <abbr title={definition} className={styles.defined}>
            {label}
          </abbr>
        ) : (
          label
        )}
      </p>
      <p className={styles.value}>
        {value}
        {of && <span className={styles.of}> {of}</span>}
      </p>
      {note && <div className={styles.note}>{note}</div>}
    </div>
  );
}
