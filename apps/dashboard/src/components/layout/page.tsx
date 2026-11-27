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
  /** One sentence: the question this page answers. */
  description?: string;
  /** Where this page sits. The current page is added as the last crumb. */
  crumbs?: readonly Crumb[];
  /** Whose engineers the numbers cover, like "Engineering, 10 engineers". */
  scope?: string;
  /** Last day the API has finished rolling up. Undefined while loading. */
  dataThrough?: string | null;
  /** Show the previous period this page compares against. */
  compares?: boolean;
  children: ReactNode;
}

/**
 * Every page says where you are, what it answers, whose data it covers and
 * which dates, before any number. The period lives in the URL (`?days=`), so
 * a shared link opens the same view.
 */
export function Page({
  title,
  description,
  crumbs,
  scope,
  dataThrough,
  compares,
  children,
}: PageProps) {
  const router = useRouter();
  const withRange = useWithRange();
  const { days, range, previous, setDays } = useRange();
  return (
    <>
      <header className={styles.header}>
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
        <div className={styles.titleRow}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>{title}</h1>
            {description && <p className={styles.description}>{description}</p>}
          </div>
          <SegmentedTabs
            className={styles.period}
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
        <dl className={styles.context}>
          {scope && (
            <div>
              <dt>Scope</dt>
              <dd>{scope}</dd>
            </div>
          )}
          <div>
            <dt>Period</dt>
            <dd>{formatRange(range)}</dd>
          </div>
          {compares && (
            <div>
              <dt>Compared with</dt>
              <dd>{formatRange(previous)}</dd>
            </div>
          )}
          {dataThrough !== undefined && (
            <div>
              <dt>Data through</dt>
              <dd>{dataThrough === null ? 'No finished days yet' : formatDay(dataThrough)}</dd>
            </div>
          )}
        </dl>
      </header>
      <div className={styles.body}>{children}</div>
    </>
  );
}
