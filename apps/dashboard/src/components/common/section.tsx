import { Card, Icon, Tooltip } from '@freshworks/dew-components';
import type { ReactNode } from 'react';

import styles from './section.module.css';

interface SectionProps {
  title: string;
  /** How the numbers are counted. Shown behind an info icon, not as body text. */
  info?: string;
  /** Controls that act on this section only, right of the title. */
  actions?: ReactNode;
  /** Pagination or other controls pinned to the bottom of the card. */
  footer?: ReactNode;
  /** Fixed card height in px, so cards in a row line up whatever their content. */
  height?: number;
  children: ReactNode;
}

/** A widget: a Dew card with a bold title, like a Freshworks analytics tile. */
export function Section({ title, info, actions, footer, height, children }: SectionProps) {
  return (
    <Card
      variant="outlined"
      padding="md"
      as="section"
      aria-label={title}
      className={`fw-card ${styles.card}`}
      style={height ? { height } : undefined}
    >
      <div className={styles.body}>
        <div className={styles.head}>
          <h2 className={styles.title}>
            {title}
            {info && (
              <Tooltip content={info} placement="top-start" width={280}>
                <span className={styles.info} tabIndex={0} aria-label={info} role="img">
                  <Icon name="CircleInfo" size="sm" />
                </span>
              </Tooltip>
            )}
          </h2>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
        <div className={styles.content}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </Card>
  );
}
