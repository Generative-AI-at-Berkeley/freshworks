'use client';

import { Table, Tag } from '@freshworks/dew-components';
import { useQuery } from '@tanstack/react-query';

import { Section } from '@/components/common/section';
import { Stat, StatGrid } from '@/components/common/stat';
import { EmptyState, QueryView } from '@/components/common/states';
import { Page } from '@/components/layout/page';
import { harnessLabel } from '@/config/labels';
import { useRange } from '@/hooks/use-range';
import { apiClient } from '@/lib/api-client';
import { adoptionShare, formatCount, formatPercent } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

/**
 * Skill adoption, the sponsor's headline view (spec 7.6). Installed and used
 * sit side by side, so availability is never read as adoption.
 *
 * TODO(X-3): adoption trend chart per skill (Dew has no chart, see README),
 * department breakdown, and the "who is using this" list sorted by name.
 */
export function SkillsView() {
  const range = useRange();
  const query = useQuery({
    queryKey: queryKeys.skillAdoption(range),
    queryFn: () => apiClient.skillAdoption(range),
  });

  return (
    <Page title="Skill adoption">
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
          const unused = data.skills.filter(
            (skill) => skill.installedEngineers > 0 && skill.activeEngineers === 0,
          );
          return (
            <>
              <StatGrid>
                <Stat label="Skills installed" value={formatCount(data.skills.length)} />
                <Stat
                  label="Installed but never used"
                  value={formatCount(unused.length)}
                  note="Candidates to promote or retire"
                />
              </StatGrid>
              <Section title="By skill">
                <Table
                  skipPagination
                  data={data.skills.map((skill) => ({ ...skill, id: skill.skillId }))}
                  columns={[
                    { accessorKey: 'name', header: 'Skill' },
                    {
                      accessorKey: 'harness',
                      header: 'Tool',
                      cell: ({ row }) => (
                        <Tag variant="gray">{harnessLabel(row.original.harness)}</Tag>
                      ),
                    },
                    { accessorKey: 'installedEngineers', header: 'Installed by' },
                    { accessorKey: 'activeEngineers', header: 'Used by' },
                    {
                      id: 'adoption',
                      header: 'Adoption',
                      cell: ({ row }) =>
                        formatPercent(
                          adoptionShare(
                            row.original.activeEngineers,
                            row.original.installedEngineers,
                          ),
                        ),
                    },
                    {
                      accessorKey: 'medianDaysToFirstUse',
                      header: 'Days to first use',
                      cell: ({ row }) => formatCount(row.original.medianDaysToFirstUse),
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
