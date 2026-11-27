'use client';

import { Card, Icon, Tooltip } from '@freshworks/dew-components';
import type { ReactNode } from 'react';

import styles from './summary.module.css';

/** A row of KPI cards, one Dew card per number, as on Freshworks analytics pages. */
export function Summary({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

export type DeltaTone = 'up' | 'down' | 'flat';

const ARROW = { up: '▲', down: '▼', flat: '' } as const;

/** A change against the previous period. Color says direction only, not good or bad. */
export function Delta({
  text,
  tone,
  against,
}: {
  text: string;
  tone: DeltaTone;
  against?: string;
}) {
  const delta = (
    <span className={styles.delta} data-tone={tone}>
      {ARROW[tone] && (
        <span className={styles.arrow} aria-hidden="true">
          {ARROW[tone]}
        </span>
      )}
      {text}
    </span>
  );
  if (!against) return delta;
  return (
    <Tooltip content={against} placement="top">
      <span tabIndex={0} className={styles.deltaTip}>
        {delta}
      </span>
    </Tooltip>
  );
}

/** A label that explains how its number is counted, in a Dew tooltip. */
function Defined({ label, definition }: { label: string; definition?: string }) {
  if (!definition) return <>{label}</>;
  return (
    <span className={styles.definedRow}>
      {label}
      <Tooltip content={definition} placement="top-start" width={260}>
        <span className={styles.defined} tabIndex={0} role="img" aria-label={definition}>
          <Icon name="CircleInfo" size="sm" />
        </span>
      </Tooltip>
    </span>
  );
}

interface FigureProps {
  label: string;
  value: ReactNode;
  of?: string;
  /** Usually a Delta; sits beside the value. */
  delta?: ReactNode;
  note?: ReactNode;
  definition?: string;
}

export function Figure({ label, value, of, delta, note, definition }: FigureProps) {
  return (
    <Card variant="outlined" padding="md" className={`fw-card ${styles.card}`}>
      <div className={styles.cell}>
        <div className={styles.label}>
          <Defined label={label} definition={definition} />
        </div>
        <div className={styles.valueRow}>
          <p className={styles.value}>
            {value}
            {of && <span className={styles.of}> {of}</span>}
          </p>
          {delta}
        </div>
        {note && <div className={styles.note}>{note}</div>}
      </div>
    </Card>
  );
}
