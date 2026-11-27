import type { ReactNode } from 'react';

import styles from './table-frame.module.css';

/**
 * Wraps a Dew Table: sideways scroll on narrow screens and a hover tint on
 * clickable rows. Dew's header and rules are left as Dew draws them.
 */
export function TableFrame({
  children,
  clickable = false,
}: {
  children: ReactNode;
  clickable?: boolean;
}) {
  return (
    <div className={styles.frame} data-clickable={clickable || undefined}>
      {children}
    </div>
  );
}
