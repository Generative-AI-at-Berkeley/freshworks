'use client';

import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { Meter } from '@/components/common/charts';
import { usePaged } from '@/components/common/pager';
import { Section } from '@/components/common/section';
import { QueryView } from '@/components/common/states';
import { Page } from '@/components/layout/page';
import { ROUTES } from '@/config/constants';
import { harnessLabel } from '@/config/labels';
import { useRange } from '@/hooks/use-range';
import { apiClient } from '@/lib/api-client';
import { formatCount, formatPercent } from '@/lib/format';
import { daysIn } from '@/lib/range';
import { queryKeys } from '@/lib/query-keys';

import styles from './views.module.css';

const CARD_HEIGHT = 260;

/** A fixed-height card holding a list, four rows to a page. */
function ListCard<T>({
  title,
  info,
  items,
  empty,
  render,
}: {
  title: string;
  info?: string;
  items: readonly T[];
  empty: string;
  render: (item: T) => ReactNode;
}) {
  const { visible, nav } = usePaged(items, 4);
  return (
    <Section title={title} info={info} height={CARD_HEIGHT} footer={nav}>
      {items.length === 0 ? (
        <p className={styles.muted}>{empty}</p>
      ) : (
        <ul className={styles.list}>{visible.map(render)}</ul>
      )}
    </Section>
  );
}

/**
 * One engineer, as their manager sees them. It leads with what could help:
 * skills the department uses that they lack, and skills they have but never
 * use. No volume counters to compare people by (spec 7.6). Every view of this
 * page writes access_log on the API side (BE-2).
 */
export function EngineerView({ engineerId }: { engineerId: string }) {
  const { range } = useRange();
  const query = useQuery({
    queryKey: queryKeys.engineer(engineerId, range),
    queryFn: () => apiClient.engineer(engineerId, range),
  });
  const data = query.data;
  const totalDays = daysIn(range);

  return (
    <Page
      title={data?.engineer.name ?? 'Engineer'}
      crumbs={data?.chain.map((person) => ({ label: person.name, href: ROUTES.leader(person.id) }))}
    >
      <QueryView query={query}>
        {(detail) => {
          const unused = detail.skillsInstalled.filter((skill) => skill.invocations === 0);
          const used = detail.skillsInstalled.filter((skill) => skill.invocations > 0);
          return (
            <div className={styles.twoCol}>
              <ListCard
                title="Worth trying"
                info={`Popular in ${detail.engineer.orgUnit.name}, not installed here.`}
                items={detail.suggestedSkills}
                empty="Nothing popular in this department is missing here."
                render={(skill) => (
                  <li key={skill.skillId} className={styles.listItem}>
                    <span className={styles.skillName}>{skill.name}</span>
                    <span className={styles.meterCell}>
                      <Meter
                        share={skill.departmentActiveShare}
                        label={`${formatPercent(skill.departmentActiveShare)} of the team`}
                      />
                      <span className={styles.figure}>
                        {`${formatPercent(skill.departmentActiveShare)} of the team`}
                      </span>
                    </span>
                  </li>
                )}
              />
              <ListCard
                title="Installed, never used"
                info="A nudge or a short demo often fixes these."
                items={unused}
                empty="Every installed skill was used in this period."
                render={(skill) => (
                  <li key={skill.skillId} className={styles.listItem}>
                    <span className={styles.skillName}>{skill.name}</span>
                    <span className={styles.muted}>Not used yet</span>
                  </li>
                )}
              />
              <ListCard
                title="Tools"
                info="Days with at least one session."
                items={detail.harnesses}
                empty="No tool activity in this period."
                render={(row) => (
                  <li key={row.harness} className={styles.listItem}>
                    <span>{harnessLabel(row.harness)}</span>
                    <span className={styles.meterCell}>
                      <Meter
                        share={totalDays === 0 ? null : row.activeDays / totalDays}
                        label={`${formatCount(row.activeDays)} of ${formatCount(totalDays)} days`}
                      />
                      <span className={styles.figure}>
                        {`${formatCount(row.activeDays)} of ${formatCount(totalDays)} days`}
                      </span>
                    </span>
                  </li>
                )}
              />
              <ListCard
                title="Skills in use"
                items={used}
                empty="No installed skill was used in this period."
                render={(skill) => (
                  <li key={skill.skillId} className={styles.listItem}>
                    <span className={styles.skillName}>{skill.name}</span>
                  </li>
                )}
              />
            </div>
          );
        }}
      </QueryView>
    </Page>
  );
}
