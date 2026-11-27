'use client';

import { Card, Tag, Tooltip } from '@freshworks/dew-components';
import type { ReactNode } from 'react';

import styles from './summary.module.css';

/** A row of figures in one Dew card, divided by rules. */
export function Summary({ children }: { children: ReactNode }) {
  return (
    <Card variant="outlined" padding="md">
      <div className={styles.strip}>{children}</div>
    </Card>
  );
}

export type DeltaTone = 'up' | 'down' | 'flat';

const DELTA_VARIANT = { up: 'green', down: 'red', flat: 'gray' } as const;

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
      <Tag variant={DELTA_VARIANT[tone]}>{text}</Tag>
      {against && <span className={styles.against}>{against}</span>}
    </span>
  );
}

/** A label that explains how its number is counted, in a Dew tooltip. */
export function Defined({ label, definition }: { label: string; definition?: string }) {
  if (!definition) return <>{label}</>;
  return (
    <Tooltip content={definition} placement="top-start" width={260}>
      <span className={styles.defined} tabIndex={0}>
        {label}
      </span>
    </Tooltip>
  );
}

interface FigureProps {
  label: string;
  value: ReactNode;
  of?: string;
  note?: ReactNode;
  definition?: string;
}

export function Figure({ label, value, of, note, definition }: FigureProps) {
  return (
    <div className={styles.cell}>
      <div className={styles.label}>
        <Defined label={label} definition={definition} />
      </div>
      <p className={styles.value}>
        {value}
        {of && <span className={styles.of}> {of}</span>}
      </p>
      {note && <div className={styles.note}>{note}</div>}
    </div>
  );
}
