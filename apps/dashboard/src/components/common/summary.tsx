import type { ReactNode } from 'react';

import styles from './summary.module.css';

export function Summary({ children }: { children: ReactNode }) {
  return <div className={styles.strip}>{children}</div>;
}

interface FigureProps {
  label: string;
  value: ReactNode;
  /** "of 10": shown smaller after the value, so "9 of 10" reads as one figure. */
  of?: string;
  /** Coverage or caveat. A partial number never appears without one. */
  note?: string;
}

export function Figure({ label, value, of, note }: FigureProps) {
  return (
    <div className={styles.cell}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>
        {value}
        {of && <span className={styles.of}> {of}</span>}
      </p>
      {note && <p className={styles.note}>{note}</p>}
    </div>
  );
}
