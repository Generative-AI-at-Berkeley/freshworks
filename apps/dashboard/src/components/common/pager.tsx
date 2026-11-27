'use client';

import { PageNavigation } from '@freshworks/dew-components';
import { type ReactNode, useState } from 'react';

/**
 * Splits a list into fixed-size pages so a card keeps one height however long
 * the list is. The navigation is null when everything fits on one page.
 */
export function usePaged<T>(
  items: readonly T[],
  perPage: number,
): { visible: readonly T[]; nav: ReactNode } {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  // A filter can shrink the list under the current page.
  const current = Math.min(page, pages - 1);
  const start = current * perPage;
  const visible = items.slice(start, start + perPage);
  const nav =
    items.length > perPage ? (
      <PageNavigation
        rangeStart={start + 1}
        rangeEnd={start + visible.length}
        totalItems={items.length}
        isPreviousDisabled={current === 0}
        isNextDisabled={current >= pages - 1}
        onPrevious={() => {
          setPage(current - 1);
        }}
        onNext={() => {
          setPage(current + 1);
        }}
      />
    ) : null;
  return { visible, nav };
}

/** `usePaged` for places a hook cannot go, such as inside a render callback. */
export function Paged<T>({
  items,
  perPage,
  children,
}: {
  items: readonly T[];
  perPage: number;
  children: (visible: readonly T[], nav: ReactNode) => ReactNode;
}) {
  const { visible, nav } = usePaged(items, perPage);
  return <>{children(visible, nav)}</>;
}
