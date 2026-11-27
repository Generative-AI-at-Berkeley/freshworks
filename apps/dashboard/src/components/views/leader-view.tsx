'use client';

import { Table } from '@freshworks/dew-components';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { Meter } from '@/components/common/charts';
import { PersonName, RowChevron } from '@/components/common/person';
import { Section } from '@/components/common/section';
import { EmptyState, QueryView } from '@/components/common/states';
import { Figure, Summary } from '@/components/common/summary';
import { Secondary, Value } from '@/components/common/value';
import { Page } from '@/components/layout/page';
import { ROUTES } from '@/config/constants';
import { harnessLabel } from '@/config/labels';
import { useRange } from '@/hooks/use-range';
import { apiClient } from '@/lib/api-client';
import { formatCount, formatCoverage, formatPercent, formatUsd } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

/**
 * Leader drill-down: org to team to individual (spec 7.6). One table of the
 * people who report here. A row with a team opens that team, a row without
 * one opens the person. People are sorted by name, never by usage (spec 8).
 *
 * TODO(X-3): depth control once BE-3 settles what depth returns.
 */
export function LeaderView({ managerId }: { managerId: string }) {
  const range = useRange();
  const router = useRouter();
  const depth = 2;
  const query = useQuery({
    queryKey: queryKeys.leaderRollup(managerId, depth, range),
    queryFn: () => apiClient.leaderRollup(managerId, depth, range),
  });
  const data = query.data;

  return (
    <Page
      title={data?.manager.name ?? 'Leaders'}
      description="Everyone in this part of the org. Open a team to go a level down, or a person to see which skills could help them."
      crumbs={data?.chain.map((person) => ({ label: person.name, href: ROUTES.leader(person.id) }))}
      range={range}
    >
      <QueryView query={query}>
        {(rollup) => {
          const rows = rollup.directReports.map((report) => ({
            ...report,
            id: report.engineerId,
            team: rollup.teams.find((team) => team.managerId === report.engineerId) ?? null,
          }));
          return (
            <>
              <Summary>
                <Figure
                  label="Using AI tools"
                  value={formatCount(rollup.total.activeEngineers)}
                  of={`of ${formatCount(rollup.total.engineers)} engineers`}
                />
                <Figure label="Sessions" value={formatCount(rollup.total.sessions)} />
                <Figure
                  label="Estimated cost"
                  value={
                    <Value value={rollup.total.cost.costUsd} format={formatUsd} missing="priced" />
                  }
                  note={formatCoverage(rollup.total.cost.costCoverage, 'usage priced')}
                />
                <Figure
                  label="Work done by subagents"
                  value={<Value value={rollup.total.subagentShare} format={formatPercent} />}
                  note="Share of tokens, counted inside the parent session"
                />
              </Summary>

              <Section title={`Reporting to ${rollup.manager.name}`}>
                {rows.length === 0 ? (
                  <EmptyState
                    title="Nobody reports here"
                    description="This person has no direct reports on these dates."
                  />
                ) : (
                  <Table
                    skipPagination
                    data={rows}
                    onRowClick={(row) => {
                      router.push(
                        row.team ? ROUTES.leader(row.engineerId) : ROUTES.engineer(row.engineerId),
                      );
                    }}
                    columns={[
                      {
                        id: 'name',
                        header: 'Name',
                        size: 240,
                        cell: ({ row }) => <PersonName name={row.original.name} />,
                      },
                      {
                        id: 'team',
                        header: 'Team using AI tools',
                        size: 220,
                        cell: ({ row }) => {
                          const team = row.original.team;
                          if (!team) return <Secondary>No team</Secondary>;
                          return (
                            <Meter
                              share={
                                team.engineers === 0 ? null : team.activeEngineers / team.engineers
                              }
                              label={`${formatCount(team.activeEngineers)} of ${formatCount(team.engineers)}`}
                            />
                          );
                        },
                      },
                      {
                        id: 'tools',
                        header: 'Their tools',
                        cell: ({ row }) =>
                          row.original.harnesses.map(harnessLabel).join(', ') || 'None yet',
                      },
                      {
                        id: 'unused',
                        header: 'Skills never used',
                        cell: ({ row }) =>
                          `${formatCount(row.original.skillsNeverUsed)} of ${formatCount(row.original.skillsInstalled)}`,
                      },
                      { id: 'go', header: '', size: 48, cell: () => <RowChevron /> },
                    ]}
                  />
                )}
              </Section>
            </>
          );
        }}
      </QueryView>
    </Page>
  );
}
