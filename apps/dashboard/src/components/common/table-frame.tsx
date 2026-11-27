import type { ReactNode } from 'react';

import styles from './table-frame.module.css';

/**
 * Wraps a Dew Table with the dashboard's quieter reading: no header fill, no
 * vertical rules, a hover tint on clickable rows, and sideways scroll on
 * narrow screens instead of a squeezed layout.
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
