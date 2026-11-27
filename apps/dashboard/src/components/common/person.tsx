import { Avatar, Icon } from '@freshworks/dew-components';

import styles from '@/components/views/views.module.css';

/** A name with initials, for rows that lead to a person. */
export function PersonName({ name }: { name: string }) {
  return (
    <span className={styles.personCell}>
      <Avatar name={name} size="xs" />
      <span className={styles.personName}>{name}</span>
    </span>
  );
}

/** The trailing chevron that says a row opens something. */
export function RowChevron() {
  return (
    <span className={styles.go}>
      <Icon name="ChevronRight" size="sm" />
    </span>
  );
}
