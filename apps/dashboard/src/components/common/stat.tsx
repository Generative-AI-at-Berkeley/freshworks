import { Card } from '@freshworks/dew-components';
import type { ReactNode } from 'react';

import styles from './stat.module.css';

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>;
}

interface StatProps {
  label: string;
  value: string;
  /** Coverage or caveat. A partial number never appears without one. */
  note?: string;
}

export function Stat({ label, value, note }: StatProps) {
  return (
    <Card variant="outlined" padding="md">
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      {note && <p className={styles.note}>{note}</p>}
    </Card>
  );
}
