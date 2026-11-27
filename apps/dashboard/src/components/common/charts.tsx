import styles from './charts.module.css';

/**
 * Hand-built because Dew has no chart component and these three are tiny.
 * Picking a real chart library is still open on X-3; anything bigger than
 * these should wait for that decision.
 */

/** A share as a short bar plus its label, e.g. "7 of 9". `share` null draws an empty track. */
export function Meter({ share, label }: { share: number | null; label: string }) {
  const percent = share === null ? 0 : Math.round(Math.min(1, Math.max(0, share)) * 100);
  return (
    <span className={styles.meter}>
      <span
        className={styles.track}
        role="img"
        aria-label={share === null ? 'No data' : `${percent}%`}
      >
        <span className={styles.fill} style={{ width: `${percent}%` }} />
      </span>
      <span className={styles.meterLabel}>{label}</span>
    </span>
  );
}

interface SparklineProps {
  values: readonly number[];
  /** Spoken and shown on hover, e.g. "Used by 7 engineers on Nov 26". */
  label: string;
  width?: number;
  height?: number;
}

/** A trend's shape. Starts at zero so a flat line near the bottom means little use, not a cropped axis. */
export function Sparkline({ values, label, width = 96, height = 24 }: SparklineProps) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const stepX = (width - 4) / (values.length - 1);
  const y = (value: number) => height - 2 - (value / max) * (height - 4);
  const points = values
    .map((value, index) => `${(2 + index * stepX).toFixed(1)},${y(value).toFixed(1)}`)
    .join(' ');
  const last = values[values.length - 1] ?? 0;
  return (
    <svg className={styles.spark} width={width} height={height} role="img" aria-label={label}>
      <title>{label}</title>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={width - 2} cy={y(last)} r={2.5} fill="currentColor" />
    </svg>
  );
}

export interface Bin {
  label: string;
  count: number;
  /** Hover text for the bar. */
  title: string;
}

/** Vertical bars on a shared baseline, count above each, range below. */
export function Histogram({ bins, label }: { bins: readonly Bin[]; label: string }) {
  const max = Math.max(1, ...bins.map((bin) => bin.count));
  return (
    <figure aria-label={label} style={{ margin: 0 }}>
      <div className={styles.histogram}>
        {bins.map((bin) => (
          <div key={bin.label} className={styles.bin} title={bin.title}>
            <span className={styles.binCount}>{bin.count}</span>
            <div
              className={styles.bar}
              style={{ height: `${Math.max(2, (bin.count / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className={styles.axis} aria-hidden="true">
        {bins.map((bin) => (
          <span key={bin.label}>{bin.label}</span>
        ))}
      </div>
    </figure>
  );
}
