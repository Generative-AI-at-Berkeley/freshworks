'use client';

import { Table } from '@freshworks/dew-components';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { Section } from '@/components/common/section';
import { Stat, StatGrid } from '@/components/common/stat';
import { EmptyState, QueryView } from '@/components/common/states';
import { Page } from '@/components/layout/page';
import { ROUTES } from '@/config/constants';
import { harnessLabel } from '@/config/labels';
import { useRange } from '@/hooks/use-range';
import { apiClient } from '@/lib/api-client';
import { formatCount, formatCoverage, formatPercent, formatUsd } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

/**
 * Leader drill-down: org to team to individual (spec 7.6). Teams and reports
 * are listed by name. No column is a usage ranking (spec 8, AGENTS.md).
 *
 * TODO(X-3): depth control, breadcrumb back up the chain (Dew Breadcrumb).
 */
export function LeaderView({ managerId }: { managerId: string }) {
  const range = useRange();
  const router = useRouter();
  const depth = 2;
  const query = useQuery({
    queryKey: queryKeys.leaderRollup(managerId, depth, range),
    queryFn: () => apiClient.leaderRollup(managerId, depth, range),
  });

  return (
    <Page title={query.data?.manager.name ?? 'Leaders'}>
      <QueryView query={query}>
        {(data) => (
          <>
            <StatGrid>
              <Stat
                label="Engineers using AI tools"
                value={`${formatCount(data.total.activeEngineers)} of ${formatCount(data.total.engineers)}`}
              />
              <Stat label="Sessions" value={formatCount(data.total.sessions)} />
              <Stat
                label="Estimated cost"
                value={formatUsd(data.total.cost.costUsd)}
                note={formatCoverage(data.total.cost.costCoverage, 'usage priced')}
              />
              <Stat label="Subagent share" value={formatPercent(data.total.subagentShare)} />
            </StatGrid>
            {data.teams.length > 0 && (
              <Section title="Teams">
                <Table
                  skipPagination
                  data={[...data.teams]
                    .sort((a, b) => a.managerName.localeCompare(b.managerName))
                    .map((team) => ({ ...team, id: team.managerId }))}
                  onRowClick={(team) => {
                    router.push(ROUTES.leader(team.managerId));
                  }}
                  columns={[
                    { accessorKey: 'managerName', header: 'Team lead' },
                    {
                      id: 'active',
                      header: 'Using AI tools',
                      cell: ({ row }) =>
                        `${formatCount(row.original.activeEngineers)} of ${formatCount(row.original.engineers)}`,
                    },
                    {
                      id: 'cost',
                      header: 'Estimated cost',
                      cell: ({ row }) => formatUsd(row.original.cost.costUsd),
                    },
                  ]}
                />
              </Section>
            )}
            <Section title="Direct reports">
              {data.directReports.length === 0 ? (
                <EmptyState
                  title="No direct reports"
                  description="This person has nobody reporting to them on these dates."
                />
              ) : (
                <Table
                  skipPagination
                  data={data.directReports.map((report) => ({ ...report, id: report.engineerId }))}
                  onRowClick={(report) => {
                    router.push(ROUTES.engineer(report.engineerId));
                  }}
                  columns={[
                    { accessorKey: 'name', header: 'Name' },
                    {
                      id: 'tools',
                      header: 'Tools',
                      cell: ({ row }) => row.original.harnesses.map(harnessLabel).join(', '),
                    },
                    { accessorKey: 'skillsInstalled', header: 'Skills installed' },
                    { accessorKey: 'skillsNeverUsed', header: 'Never used' },
                  ]}
                />
              )}
            </Section>
          </>
        )}
      </QueryView>
    </Page>
  );
}
