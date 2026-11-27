'use client';

import { Table } from '@freshworks/dew-components';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { Meter } from '@/components/common/charts';
import { PersonName, RowChevron } from '@/components/common/person';
import { Paged } from '@/components/common/pager';
import { Section } from '@/components/common/section';
import { TableFrame } from '@/components/common/table-frame';
import { EmptyState, QueryView } from '@/components/common/states';
import { Figure, Summary } from '@/components/common/summary';
import { Secondary, Value } from '@/components/common/value';
import { Page } from '@/components/layout/page';
import { ROUTES } from '@/config/constants';
import { harnessLabel } from '@/config/labels';
import { useRange, useWithRange } from '@/hooks/use-range';
import { apiClient } from '@/lib/api-client';
import { formatCount, formatCoverage, formatPercent, formatUsd } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

import styles from './views.module.css';

/**
 * Leader drill-down: org to team to individual (spec 7.6). One table of the
 * people who report here. A row with a team opens that team, a row without
 * one opens the person. People are sorted by name, never by usage (spec 8).
 *
 * TODO(X-3): depth control once BE-3 settles what depth returns.
 */
export function LeaderView({ managerId }: { managerId: string }) {
  const { range } = useRange();
  const router = useRouter();
  // Drilling down keeps the chosen period.
  const withRange = useWithRange();
  const depth = 2;
  const query = useQuery({
    queryKey: queryKeys.leaderRollup(managerId, depth, range),
    queryFn: () => apiClient.leaderRollup(managerId, depth, range),
  });
  const data = query.data;

  return (
    <Page
      dataThrough={query.data?.dataThrough}
      title={data?.manager.name ?? 'Teams'}
      crumbs={data?.chain.map((person) => ({ label: person.name, href: ROUTES.leader(person.id) }))}
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
                  label="Active engineers"
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
                  label="Subagent share"
                  definition="Share of tokens done by subagents, counted inside the parent session."
                  value={<Value value={rollup.total.subagentShare} format={formatPercent} />}
                />
              </Summary>

              <Paged items={rows} perPage={8}>
                {(visible, nav) => (
                  <Section title={`Reporting to ${rollup.manager.name}`} footer={nav}>
                    {rows.length === 0 ? (
                      <EmptyState
                        title="Nobody reports here"
                        description="This person has no direct reports on these dates."
                      />
                    ) : (
                      <TableFrame clickable>
                        <Table
                          skipPagination
                          data={[...visible]}
                          onRowClick={(row) => {
                            router.push(
                              withRange(
                                row.team
                                  ? ROUTES.leader(row.engineerId)
                                  : ROUTES.engineer(row.engineerId),
                              ),
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
                                const share =
                                  team.engineers === 0
                                    ? null
                                    : team.activeEngineers / team.engineers;
                                return (
                                  <span className={styles.shareCell}>
                                    <span className={styles.shareTop}>
                                      <span className={styles.shareValue}>
                                        <Value value={share} format={formatPercent} />
                                      </span>
                                      <Secondary>
                                        {`${formatCount(team.activeEngineers)} of ${formatCount(team.engineers)}`}
                                      </Secondary>
                                    </span>
                                    <Meter
                                      share={share}
                                      label={`${formatCount(team.activeEngineers)} of ${formatCount(team.engineers)} engineers`}
                                    />
                                  </span>
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
                      </TableFrame>
                    )}
                  </Section>
                )}
              </Paged>
            </>
          );
        }}
      </QueryView>
    </Page>
  );
}
