'use client';

import { Card, Tag } from '@freshworks/dew-components';
import { useQuery } from '@tanstack/react-query';

import { Section } from '@/components/common/section';
import { EmptyState, QueryView } from '@/components/common/states';
import { Page } from '@/components/layout/page';
import { harnessLabel } from '@/config/labels';
import { useRange } from '@/hooks/use-range';
import { apiClient } from '@/lib/api-client';
import { formatPercent } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

/**
 * One engineer, as their manager sees them. Leads with enablement, what they
 * could try next, never volume counters (spec 7.6). Every view of this page
 * writes access_log on the API side (BE-2).
 *
 * TODO(X-3): unused installed skills first, then suggestions, with a link to
 * each skill's adoption row.
 */
export function EngineerView({ engineerId }: { engineerId: string }) {
  const range = useRange();
  const query = useQuery({
    queryKey: queryKeys.engineer(engineerId, range),
    queryFn: () => apiClient.engineer(engineerId, range),
  });

  return (
    <Page title={query.data?.engineer.name ?? 'Engineer'}>
      <QueryView query={query}>
        {(data) => {
          const unused = data.skillsInstalled.filter((skill) => skill.invocations === 0);
          return (
            <>
              <p>{data.engineer.orgUnit.name}</p>
              <Section title="Worth trying">
                {data.suggestedSkills.length === 0 ? (
                  <EmptyState
                    title="No suggestions"
                    description="Nothing popular in this department is missing here."
                  />
                ) : (
                  data.suggestedSkills.map((skill) => (
                    <Card key={skill.skillId} variant="outlined" padding="md">
                      {skill.name}: used by {formatPercent(skill.departmentActiveShare)} of the
                      department
                    </Card>
                  ))
                )}
              </Section>
              <Section title="Installed, never used">
                {unused.length === 0 ? (
                  <p>Every installed skill has been used in this range.</p>
                ) : (
                  <div>
                    {unused.map((skill) => (
                      <Tag key={skill.skillId} variant="yellow">
                        {skill.name}
                      </Tag>
                    ))}
                  </div>
                )}
              </Section>
              <Section title="Tools">
                <div>
                  {data.harnesses.map((row) => (
                    <Tag key={row.harness} variant="gray">
                      {harnessLabel(row.harness)}: {row.activeDays} active days
                    </Tag>
                  ))}
                </div>
              </Section>
            </>
          );
        }}
      </QueryView>
    </Page>
  );
}
