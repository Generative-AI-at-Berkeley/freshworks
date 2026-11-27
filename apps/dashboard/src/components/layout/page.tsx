'use client';

import { Breadcrumb } from '@freshworks/dew-components';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { formatRange } from '@/lib/format';
import type { DayRange } from '@/lib/range';

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
  /** The dates every number on the page covers. */
  range?: DayRange;
  children: ReactNode;
}

/**
 * Every page says where you are, what it answers, and which dates it covers,
 * before any number. A number with no period attached cannot be trusted.
 */
export function Page({ title, description, crumbs, range, children }: PageProps) {
  const router = useRouter();
  return (
    <>
      <header className={styles.header}>
        {crumbs && crumbs.length > 0 && (
          <Breadcrumb
            ariaLabel="Management chain"
            items={[
              ...crumbs.map((crumb) => ({ label: crumb.label, href: crumb.href })),
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
          <h1 className={styles.title}>{title}</h1>
          {range && <span className={styles.range}>{formatRange(range)}</span>}
        </div>
        {description && <p className={styles.description}>{description}</p>}
      </header>
      <div className={styles.body}>{children}</div>
    </>
  );
}
