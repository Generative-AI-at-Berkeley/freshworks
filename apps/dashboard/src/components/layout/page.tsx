'use client';

import { Breadcrumb, SegmentedTabs } from '@freshworks/dew-components';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { useRange, useWithRange } from '@/hooks/use-range';
import { formatDay, formatRange } from '@/lib/format';
import { parsePreset, RANGE_PRESETS } from '@/lib/range';

import styles from './page.module.css';

export interface Crumb {
  label: string;
  href: string;
}

interface PageProps {
  title: string;
  /** Where this page sits. The current page is added as the last crumb. */
  crumbs?: readonly Crumb[];
  /** Last day the API has finished rolling up. Undefined while loading. */
  dataThrough?: string | null;
  children: ReactNode;
}

/** The exclusive range end, as the last day it covers. */
function lastDayOf(to: string): string {
  const day = new Date(`${to}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

/**
 * Breadcrumb, title and period, as on a Freshworks analytics page. The period
 * lives in the URL (`?days=`), so a shared link opens the same view. A note
 * appears only when the data stops short of the period.
 */
export function Page({ title, crumbs, dataThrough, children }: PageProps) {
  const router = useRouter();
  const withRange = useWithRange();
  const { days, range, setDays } = useRange();
  const lagging =
    dataThrough === null || (dataThrough !== undefined && dataThrough < lastDayOf(range.to));
  return (
    <>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          {crumbs && crumbs.length > 0 && (
            <Breadcrumb
              ariaLabel="Where this page sits"
              items={[
                ...crumbs.map((crumb) => ({ label: crumb.label, href: withRange(crumb.href) })),
                { label: title },
              ]}
              onItemClick={(event, item) => {
                if (!item.href) return;
                event.preventDefault();
                router.push(item.href);
              }}
            />
          )}
          <h1 className={crumbs && crumbs.length > 0 ? styles.visuallyHidden : styles.title}>
            {title}
          </h1>
        </div>
        <div className={styles.period}>
          <span className={styles.range}>
            {formatRange(range)}
            {lagging && (
              <span className={styles.lag}>
                {dataThrough ? `, data through ${formatDay(dataThrough)}` : ', no data yet'}
              </span>
            )}
          </span>
          <SegmentedTabs
            className={styles.tabs}
            size="mini"
            value={String(days)}
            onValueChange={(value) => {
              setDays(parsePreset(value));
            }}
          >
            <SegmentedTabs.List aria-label="Period">
              {RANGE_PRESETS.map((preset) => (
                <SegmentedTabs.Trigger key={preset} value={String(preset)}>
                  {`${String(preset)} days`}
                </SegmentedTabs.Trigger>
              ))}
            </SegmentedTabs.List>
          </SegmentedTabs>
        </div>
      </header>
      <div className={styles.body}>{children}</div>
    </>
  );
}
