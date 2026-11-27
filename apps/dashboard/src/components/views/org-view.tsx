'use client';

import { Table } from '@freshworks/dew-components';
import type { api } from '@fwcoach/contracts';
import { useQuery } from '@tanstack/react-query';

import { Histogram, Meter } from '@/components/common/charts';
import { Section } from '@/components/common/section';
import { TableFrame } from '@/components/common/table-frame';
import { QueryView } from '@/components/common/states';
import { Figure, Summary } from '@/components/common/summary';
import { Secondary, Value } from '@/components/common/value';
import { Page } from '@/components/layout/page';
import { harnessLabel } from '@/config/labels';
import { useRange } from '@/hooks/use-range';
import { apiClient } from '@/lib/api-client';
import { formatCompact, formatCount, formatCoverage, formatPercent, formatUsd } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

/**
 * Usage in the unit a tool actually reports. Kiro bills in credits and those
 * are never turned into tokens (ADR 0005), so one column holds either.
 */
function UsageCell({ row }: { row: api.HarnessUsage }) {
  if (row.tokens !== null) {
    return (
      <>
        <Value value={row.tokens} format={(tokens) => `${formatCompact(tokens)} tokens`} />
        <Secondary>{`${formatPercent(row.tokenCoverage)} of requests report tokens`}</Secondary>
      </>
    );
  }
  if (row.credits !== null)
    return <Value value={row.credits} format={(credits) => `${formatCount(credits)} credits`} />;
  return <Value value={null} format={formatCompact} />;
}

/**
 * Org overview for a department head (spec 7.6). Cursor IDE and Cursor Agent
 * are separate rows. Every cost carries its coverage.
 *
 * TODO(X-3): usage trend, cost explain (`?explain=true`) behind the cost figure.
 */
export function OrgView({ orgUnitId }: { orgUnitId: string }) {
  const { range } = useRange();
  const query = useQuery({
    queryKey: queryKeys.orgOverview(orgUnitId, range),
    queryFn: () => apiClient.orgOverview(orgUnitId, range),
  });

  return (
    <Page
      dataThrough={query.data?.dataThrough}
      title={query.data?.orgUnit.name ?? 'Org overview'}
      description="How this department uses AI coding tools, what it costs, and how evenly use is spread across people."
    >
      <QueryView query={query}>
        {(data) => (
          <>
            <Summary>
              <Figure
                label="Using AI tools"
                value={formatCount(data.activeEngineers)}
                of={`of ${formatCount(data.engineers)} engineers`}
              />
              <Figure
                label="Estimated cost"
                value={<Value value={data.cost.costUsd} format={formatUsd} missing="priced" />}
                note={formatCoverage(data.cost.costCoverage, 'usage priced')}
              />
              <Figure
                label="Typical sessions per engineer"
                value={<Value value={data.sessionsPerEngineer.p50} format={formatCount} />}
                note="Median over the range"
              />
              <Figure
                label="Work done by subagents"
                value={<Value value={data.subagentShare} format={formatPercent} />}
                note="Share of tokens, counted inside the parent session"
              />
            </Summary>

            <Section
              title="By tool"
              hint="Each tool reports what it can. Gaps are marked, never counted as zero."
            >
              <TableFrame>
                <Table
                  skipPagination
                  data={data.harnesses.map((row) => ({ ...row, id: row.harness }))}
                  columns={[
                    {
                      id: 'tool',
                      header: 'Tool',
                      cell: ({ row }) => <strong>{harnessLabel(row.original.harness)}</strong>,
                    },
                    {
                      id: 'engineers',
                      header: 'Engineers',
                      size: 200,
                      cell: ({ row }) => (
                        <Meter
                          share={
                            data.engineers === 0
                              ? null
                              : row.original.activeEngineers / data.engineers
                          }
                          label={formatCount(row.original.activeEngineers)}
                        />
                      ),
                    },
                    {
                      id: 'sessions',
                      header: 'Sessions',
                      cell: ({ row }) => formatCount(row.original.sessions),
                    },
                    {
                      id: 'usage',
                      header: 'Usage',
                      size: 240,
                      cell: ({ row }) => <UsageCell row={row.original} />,
                    },
                    {
                      id: 'cost',
                      header: 'Estimated cost',
                      cell: ({ row }) => (
                        <Value
                          value={row.original.cost.costUsd}
                          format={formatUsd}
                          missing="priced"
                        />
                      ),
                    },
                  ]}
                />
              </TableFrame>
            </Section>

            <Section
              title="Sessions per engineer"
              hint="How many engineers fall in each band. A spread, not a ranking: nobody is named here."
            >
              <Histogram
                label="Engineers by number of sessions"
                bins={data.sessionsPerEngineer.buckets.map((bucket) => ({
                  label: `${formatCount(bucket.from)} to ${formatCount(bucket.to)}`,
                  count: bucket.engineers,
                  title: `${formatCount(bucket.engineers)} engineers had ${formatCount(bucket.from)} to ${formatCount(bucket.to)} sessions`,
                }))}
              />
            </Section>
          </>
        )}
      </QueryView>
    </Page>
  );
}
