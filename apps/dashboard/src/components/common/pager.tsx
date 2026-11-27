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

/**
 * Paging for routes that return a cursor. Keeps the cursors already visited
 * so "previous" works without the API supporting it.
 */
export function useCursorPages(): {
  cursor: string | null;
  nav: (page: { shown: number; total: number; nextCursor: string | null }) => ReactNode;
  reset: () => void;
} {
  const [stack, setStack] = useState<(string | null)[]>([null]);
  const [offsets, setOffsets] = useState<number[]>([0]);
  const cursor = stack.at(-1) ?? null;
  const offset = offsets.at(-1) ?? 0;
  return {
    cursor,
    reset: () => {
      setStack([null]);
      setOffsets([0]);
    },
    nav: ({ shown, total, nextCursor }) =>
      total > shown || stack.length > 1 ? (
        <PageNavigation
          rangeStart={total === 0 ? 0 : offset + 1}
          rangeEnd={offset + shown}
          totalItems={total}
          isPreviousDisabled={stack.length <= 1}
          isNextDisabled={nextCursor === null}
          onPrevious={() => {
            setStack((s) => s.slice(0, -1));
            setOffsets((o) => o.slice(0, -1));
          }}
          onNext={() => {
            if (nextCursor === null) return;
            setStack((s) => [...s, nextCursor]);
            setOffsets((o) => [...o, offset + shown]);
          }}
        />
      ) : null,
  };
}
