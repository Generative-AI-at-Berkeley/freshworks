import type { ReactNode } from 'react';

import styles from './page.module.css';

interface PageProps {
  title: string;
  /** Rendered right of the title: filters, range, actions. */
  actions?: ReactNode;
  children: ReactNode;
}

/** Fixed header, scrolling body. The header stays put while the body scrolls. */
export function Page({ title, actions, children }: PageProps) {
  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        {actions}
      </header>
      <div className={styles.body}>{children}</div>
    </>
  );
}
