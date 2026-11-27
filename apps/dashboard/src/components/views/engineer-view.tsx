'use client';

import { Tag } from '@freshworks/dew-components';
import { useQuery } from '@tanstack/react-query';

import { Meter } from '@/components/common/charts';
import { Section } from '@/components/common/section';
import { EmptyState, QueryView } from '@/components/common/states';
import { Page } from '@/components/layout/page';
import { ROUTES } from '@/config/constants';
import { harnessLabel } from '@/config/labels';
import { useRange } from '@/hooks/use-range';
import { apiClient } from '@/lib/api-client';
import { formatCount, formatPercent } from '@/lib/format';
import { daysIn } from '@/lib/range';
import { queryKeys } from '@/lib/query-keys';

import styles from './views.module.css';

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
      description={
        data
          ? `${data.engineer.orgUnit.name}. Suggestions come from what the rest of the department uses.`
          : undefined
      }
      crumbs={data?.chain.map((person) => ({ label: person.name, href: ROUTES.leader(person.id) }))}
    >
      <QueryView query={query}>
        {(detail) => {
          const unused = detail.skillsInstalled.filter((skill) => skill.invocations === 0);
          const used = detail.skillsInstalled.filter((skill) => skill.invocations > 0);
          return (
            <div className={styles.twoCol}>
              <Section
                title="Worth trying"
                hint={`Popular in ${detail.engineer.orgUnit.name}, not installed here.`}
              >
                {detail.suggestedSkills.length === 0 ? (
                  <EmptyState
                    title="No suggestions"
                    description="Nothing popular in this department is missing here."
                  />
                ) : (
                  <ul className={styles.list}>
                    {detail.suggestedSkills.map((skill) => (
                      <li key={skill.skillId} className={styles.listItem}>
                        <span className={styles.skillName}>{skill.name}</span>
                        <Meter
                          share={skill.departmentActiveShare}
                          label={`${formatPercent(skill.departmentActiveShare)} of the team`}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section
                title="Installed, never used"
                hint="A nudge or a short demo often fixes these."
              >
                {unused.length === 0 ? (
                  <EmptyState
                    title="Nothing unused"
                    description="Every installed skill was used in this range."
                  />
                ) : (
                  <ul className={styles.list}>
                    {unused.map((skill) => (
                      <li key={skill.skillId} className={styles.listItem}>
                        <span className={styles.skillName}>{skill.name}</span>
                        <Tag variant="yellow">Not used yet</Tag>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Tools" hint="Days with at least one session.">
                <ul className={styles.list}>
                  {detail.harnesses.map((row) => (
                    <li key={row.harness} className={styles.listItem}>
                      <span>{harnessLabel(row.harness)}</span>
                      <Meter
                        share={totalDays === 0 ? null : row.activeDays / totalDays}
                        label={`${formatCount(row.activeDays)} of ${formatCount(totalDays)} days`}
                      />
                    </li>
                  ))}
                </ul>
              </Section>

              {used.length > 0 && (
                <Section title="Skills in use">
                  <div className={styles.tags}>
                    {used.map((skill) => (
                      <Tag key={skill.skillId} variant="green">
                        {skill.name}
                      </Tag>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          );
        }}
      </QueryView>
    </Page>
  );
}
