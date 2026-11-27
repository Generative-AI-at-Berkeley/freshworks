'use client';

import { Table, Tag } from '@freshworks/dew-components';
import type { api } from '@fwcoach/contracts';
import { useQuery } from '@tanstack/react-query';

import { Meter, Sparkline } from '@/components/common/charts';
import { Section } from '@/components/common/section';
import { EmptyState, QueryView } from '@/components/common/states';
import { Figure, Summary } from '@/components/common/summary';
import { Value } from '@/components/common/value';
import { Page } from '@/components/layout/page';
import { harnessLabel } from '@/config/labels';
import { useRange } from '@/hooks/use-range';
import { apiClient } from '@/lib/api-client';
import { adoptionShare, formatCount, formatPercent } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

import styles from './views.module.css';

/** Below this share of installers using a skill, it is worth a look. */
const LOW_ADOPTION = 0.25;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[mid] ?? null)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function attentionLine(skill: api.SkillAdoptionRow): string {
  return skill.activeEngineers === 0
    ? `Installed by ${formatCount(skill.installedEngineers)} engineers, used by none.`
    : `Only ${formatCount(skill.activeEngineers)} of ${formatCount(skill.installedEngineers)} engineers who installed it use it.`;
}

/**
 * Skill adoption, the sponsor's headline view (spec 7.6). It leads with the
 * skills that need a decision, then shows every skill with installed and used
 * side by side, so availability is never read as adoption.
 *
 * TODO(X-3): department breakdown and "who is using this" (by name) per skill.
 */
export function SkillsView() {
  const range = useRange();
  const query = useQuery({
    queryKey: queryKeys.skillAdoption(range),
    queryFn: () => apiClient.skillAdoption(range),
  });

  return (
    <Page
      title="Skill adoption"
      description="Which shared skills engineers have installed, and how many of them actually use each one."
      range={range}
    >
      <QueryView query={query}>
        {(data) => {
          if (data.skills.length === 0) {
            return (
              <EmptyState
                title="No skills found"
                description="No collector has reported an installed skill in this range. Check fleet health for silent devices."
              />
            );
          }
          const shares = data.skills
            .map((skill) => adoptionShare(skill.activeEngineers, skill.installedEngineers))
            .filter((share): share is number => share !== null);
          const attention = data.skills
            .filter((skill) => {
              const share = adoptionShare(skill.activeEngineers, skill.installedEngineers);
              return share !== null && share < LOW_ADOPTION;
            })
            .sort(
              (a, b) =>
                a.activeEngineers / a.installedEngineers - b.activeEngineers / b.installedEngineers,
            );

          return (
            <>
              <Summary>
                <Figure
                  label="Skills installed somewhere"
                  value={formatCount(data.skills.length)}
                />
                <Figure
                  label="Median adoption"
                  value={formatPercent(median(shares))}
                  note="Share of installers who used the skill"
                />
                <Figure
                  label="Need a decision"
                  value={formatCount(attention.length)}
                  note="Under 25% adoption"
                />
              </Summary>

              {attention.length > 0 && (
                <Section
                  title="Needs a decision"
                  hint="Promote these to the people who have them, or retire them."
                >
                  <div className={styles.attention}>
                    {attention.map((skill) => (
                      <div key={skill.skillId} className={styles.attentionItem}>
                        <p className={styles.attentionText}>
                          <span className={styles.skillName}>{skill.name}</span>{' '}
                          {attentionLine(skill)}
                        </p>
                        <Tag variant="gray">{harnessLabel(skill.harness)}</Tag>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              <Section
                title="All skills"
                hint="Adoption is engineers who used a skill out of engineers who installed it."
              >
                <Table
                  skipPagination
                  data={data.skills.map((skill) => ({ ...skill, id: skill.skillId }))}
                  columns={[
                    {
                      accessorKey: 'name',
                      header: 'Skill',
                      cell: ({ row }) => (
                        <span className={styles.skillName}>{row.original.name}</span>
                      ),
                    },
                    {
                      id: 'tool',
                      header: 'Tool',
                      cell: ({ row }) => (
                        <Tag variant="gray">{harnessLabel(row.original.harness)}</Tag>
                      ),
                    },
                    {
                      id: 'adoption',
                      header: 'Adoption',
                      size: 220,
                      cell: ({ row }) => (
                        <Meter
                          share={adoptionShare(
                            row.original.activeEngineers,
                            row.original.installedEngineers,
                          )}
                          label={`${formatCount(row.original.activeEngineers)} of ${formatCount(row.original.installedEngineers)}`}
                        />
                      ),
                    },
                    {
                      id: 'trend',
                      header: 'Daily users',
                      cell: ({ row }) => {
                        const last = row.original.trend.at(-1);
                        return (
                          <Sparkline
                            values={row.original.trend.map((point) => point.activeEngineers)}
                            label={
                              last
                                ? `${formatCount(last.activeEngineers)} engineers used it on ${last.day}`
                                : 'No data'
                            }
                          />
                        );
                      },
                    },
                    {
                      id: 'firstUse',
                      header: 'Days to first use',
                      cell: ({ row }) => (
                        <Value
                          value={row.original.medianDaysToFirstUse}
                          format={(days) => `${formatCount(days)} ${days === 1 ? 'day' : 'days'}`}
                          missing="unused"
                        />
                      ),
                    },
                  ]}
                />
              </Section>
            </>
          );
        }}
      </QueryView>
    </Page>
  );
}
