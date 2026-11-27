'use client';

import { InlineMessage, Shimmer } from '@freshworks/dew-components';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import styles from './states.module.css';

/**
 * Empty and error states say what happened and what to do next. No mascot
 * voice, no jokes, no emoji.
 */
export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>{title}</p>
      <p>{description}</p>
    </div>
  );
}

export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div className={styles.loading} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <Shimmer key={index} height={36} radius="md" />
      ))}
    </div>
  );
}

/**
 * Renders a query's loading and error states, and its data once it arrives.
 * Every view goes through this so no page shows a blank screen on failure.
 */
export function QueryView<T>({
  query,
  children,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <LoadingBlock />;
  if (query.isError) return <InlineMessage variant="error">{query.error.message}</InlineMessage>;
  return <>{children(query.data)}</>;
}
