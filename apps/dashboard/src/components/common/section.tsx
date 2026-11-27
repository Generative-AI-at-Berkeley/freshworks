import type { ReactNode } from 'react';

import styles from './section.module.css';

interface SectionProps {
  title: string;
  /** How to read or use what follows, when it is not obvious. */
  hint?: string;
  children: ReactNode;
}

export function Section({ title, hint, children }: SectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        {hint && <p className={styles.hint}>{hint}</p>}
      </div>
      {children}
    </section>
  );
}
