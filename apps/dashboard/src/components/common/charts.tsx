'use client';

import { type KeyboardEvent, type PointerEvent, useId, useState } from 'react';

import { useWidth } from '@/hooks/use-width';
import { formatCount, formatDay } from '@/lib/format';

import styles from './charts.module.css';

/*
 * Hand-built because Dew ships no charts. Measured series use Dew's first
 * chart category color; the comparison series is a dashed neutral.
 */

/**
 * A share as a short graphite rule. It is a glance aid next to the number, so
 * it stays neutral; color is kept for meaning.
 */
export function Meter({
  share,
  label,
  tone = 'data',
}: {
  /** Null draws an empty track. */
  share: number | null;
  label: string;
  /** `accent` for the one headline breakdown on a page. */
  tone?: 'data' | 'muted' | 'accent';
}) {
  const clamped = Math.min(1, Math.max(0, share ?? 0));
  return (
    <span className={styles.meter} role="img" aria-label={label}>
      <span className={styles.fill} data-tone={tone} style={{ width: `${clamped * 100}%` }} />
    </span>
  );
}

/** A small trend for a table cell. The column header says what it plots. */
export function Sparkline({
  values,
  label,
  width = 112,
  height = 28,
}: {
  values: readonly number[];
  label: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const pad = 3;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - (v / max) * (height - pad * 2);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = values.length - 1;
  return (
    <svg
      className={styles.spark}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <line
        className={styles.sparkBase}
        x1={pad}
        x2={width - pad}
        y1={height - pad}
        y2={height - pad}
      />
      <polyline className={styles.sparkLine} points={points} />
      <circle className={styles.sparkDot} cx={x(last)} cy={y(values[last] ?? 0)} r={2.5} />
    </svg>
  );
}

export interface TrendSeries {
  label: string;
  values: readonly number[];
  /** `compare` draws dashed and neutral, for the previous period. */
  kind: 'primary' | 'compare';
}

function niceMax(value: number): number {
  if (value <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(value));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= value) return m * step;
  return value;
}

/**
 * A daily line chart with a real y axis, dates on x, and a crosshair you can
 * drive with the pointer or the arrow keys. Series align by day index, which
 * is how a previous period of the same length lines up.
 */
export function TrendChart({
  days,
  series,
  unit,
  format = formatCount,
  height = 200,
}: {
  days: readonly string[];
  series: readonly TrendSeries[];
  /** Plural noun for the tooltip, like "engineers". */
  unit: string;
  /** How a value reads in the tooltip and axis. */
  format?: (value: number) => string;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>(640);
  const [hover, setHover] = useState<number | null>(null);
  const titleId = useId();
  const primary = series.find((s) => s.kind === 'primary');
  if (!primary || days.length < 2) return null;

  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const left = 28;
  const right = 12;
  const top = 20;
  const bottom = 24;
  const plotW = Math.max(10, width - left - right);
  const plotH = height - top - bottom;
  const x = (i: number) => left + (i / (days.length - 1)) * plotW;
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const path = (values: readonly number[]) =>
    values
      .slice(0, days.length)
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      .join('');
  const ticks = [0, max / 2, max];
  const xLabels = [0, Math.floor((days.length - 1) / 2), days.length - 1];

  const indexAt = (clientX: number, rect: DOMRect) =>
    Math.round(Math.min(1, Math.max(0, (clientX - rect.left - left) / plotW)) * (days.length - 1));
  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    setHover(indexAt(event.clientX, event.currentTarget.getBoundingClientRect()));
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const step = event.key === 'ArrowLeft' ? -1 : 1;
    setHover((current) =>
      Math.min(days.length - 1, Math.max(0, (current ?? days.length - 1) + step)),
    );
  };

  const active = hover ?? null;
  const tipLeft = active === null ? 0 : x(active);
  const latest = primary.values.at(-1) ?? 0;

  return (
    <div
      ref={ref}
      className={styles.trend}
      tabIndex={0}
      role="group"
      aria-labelledby={titleId}
      onKeyDown={onKey}
      onBlur={() => {
        setHover(null);
      }}
    >
      <span id={titleId} className={styles.srOnly}>
        {`${primary.label}, daily from ${formatDay(days[0] ?? '')} to ${formatDay(days.at(-1) ?? '')}. Latest ${format(latest)} ${unit}. Use the arrow keys to read each day.`}
      </span>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
        onPointerMove={onMove}
        onPointerLeave={() => {
          setHover(null);
        }}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line className={styles.grid} x1={left} x2={left + plotW} y1={y(tick)} y2={y(tick)} />
            <text
              className={styles.tick}
              x={left - 8}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {formatCount(tick)}
            </text>
          </g>
        ))}
        {xLabels.map((i, n) => (
          <text
            key={i}
            className={styles.tick}
            x={x(i)}
            y={height - 6}
            textAnchor={n === 0 ? 'start' : n === 2 ? 'end' : 'middle'}
          >
            {formatDay(days[i] ?? '')}
          </text>
        ))}
        {series
          .filter((s) => s.kind === 'compare')
          .map((s) => (
            <path key={s.label} className={styles.compareLine} d={path(s.values)} />
          ))}
        <path
          className={styles.area}
          d={`${path(primary.values)}L${x(Math.min(primary.values.length, days.length) - 1).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`}
        />
        <path className={styles.primaryLine} d={path(primary.values)} />
        {active === null ? (
          <>
            <circle className={styles.endDot} cx={x(days.length - 1)} cy={y(latest)} r={4} />
            <text
              className={styles.endLabel}
              x={x(days.length - 1) - 8}
              y={y(latest) - 10}
              textAnchor="end"
            >
              {format(latest)}
            </text>
          </>
        ) : (
          <>
            <line
              className={styles.crosshair}
              x1={x(active)}
              x2={x(active)}
              y1={top}
              y2={top + plotH}
            />
            {series.map((s) =>
              s.values[active] === undefined ? null : (
                <circle
                  key={s.label}
                  className={s.kind === 'primary' ? styles.endDot : styles.compareDot}
                  cx={x(active)}
                  cy={y(s.values[active] ?? 0)}
                  r={3.5}
                />
              ),
            )}
          </>
        )}
      </svg>
      {active !== null && (
        <div
          className={styles.tooltip}
          style={{ left: Math.min(Math.max(tipLeft, 80), width - 80) }}
          role="status"
        >
          <p className={styles.tipDay}>{formatDay(days[active] ?? '')}</p>
          {series.map((s) =>
            s.values[active] === undefined ? null : (
              <p key={s.label} className={styles.tipRow}>
                <span className={styles.swatch} data-kind={s.kind} />
                <span className={styles.tipLabel}>{s.label}</span>
                <span className={styles.tipValue}>{format(s.values[active] ?? 0)}</span>
              </p>
            ),
          )}
        </div>
      )}
      {series.length > 1 && (
        <div className={styles.legend} aria-hidden="true">
          {series.map((s) => (
            <span key={s.label}>
              <span className={styles.swatch} data-kind={s.kind} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Horizontal bars for a few labelled counts, longest scale set by the largest. */
export function BarList({
  items,
  total,
  unit,
}: {
  items: readonly { key: string; label: string; value: number }[];
  /** When given, bars are a share of this rather than of the largest item. */
  total?: number;
  unit: string;
}) {
  const scale = Math.max(1, total ?? Math.max(0, ...items.map((item) => item.value)));
  return (
    <ul className={styles.barList}>
      {items.map((item) => (
        <li key={item.key} className={styles.barRow}>
          <span className={styles.barLabel}>{item.label}</span>
          <Meter
            share={item.value / scale}
            label={`${item.label}: ${formatCount(item.value)} ${unit}`}
          />
          <span className={styles.barValue}>{formatCount(item.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Engineers per band. Shows a spread, never who is where. */
export function Histogram({
  bins,
  label,
}: {
  bins: readonly { label: string; count: number; title: string }[];
  label: string;
}) {
  const max = Math.max(1, ...bins.map((bin) => bin.count));
  return (
    <figure className={styles.histogramFigure} aria-label={label}>
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
