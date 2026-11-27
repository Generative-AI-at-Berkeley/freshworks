import type { ReactNode } from 'react';

import styles from './section.module.css';

interface SectionProps {
  title: string;
  hint?: string;
  /** Controls that act on this section only, aligned right of the title. */
  actions?: ReactNode;
  children: ReactNode;
}

export function Section({ title, hint, actions, children }: SectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <div className={styles.text}>
          <h2 className={styles.title}>{title}</h2>
          {hint && <p className={styles.hint}>{hint}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {children}
    </section>
  );
}
