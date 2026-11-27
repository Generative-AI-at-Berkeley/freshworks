'use client';

import { Table } from '@freshworks/dew-components';
import { useQuery } from '@tanstack/react-query';

import { Section } from '@/components/common/section';
import { Stat, StatGrid } from '@/components/common/stat';
import { QueryView } from '@/components/common/states';
import { Page } from '@/components/layout/page';
import { harnessLabel } from '@/config/labels';
import { useRange } from '@/hooks/use-range';
import { apiClient } from '@/lib/api-client';
import { formatCompact, formatCount, formatCoverage, formatPercent, formatUsd } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

/**
 * Org overview for a department head (spec 7.6). Cursor IDE and Cursor Agent
 * are separate rows. Kiro shows credits, never tokens (ADR 0005).
 *
 * TODO(X-3): sessions-per-engineer histogram from `sessionsPerEngineer`,
 * usage trend, cost explain (`?explain=true`) on the cost stat.
 */
export function OrgView({ orgUnitId }: { orgUnitId: string }) {
  const range = useRange();
  const query = useQuery({
    queryKey: queryKeys.orgOverview(orgUnitId, range),
    queryFn: () => apiClient.orgOverview(orgUnitId, range),
  });

  return (
    <Page title={query.data?.orgUnit.name ?? 'Org overview'}>
      <QueryView query={query}>
        {(data) => (
          <>
            <StatGrid>
              <Stat
                label="Engineers using AI tools"
                value={`${formatCount(data.activeEngineers)} of ${formatCount(data.engineers)}`}
              />
              <Stat
                label="Estimated cost"
                value={formatUsd(data.cost.costUsd)}
                note={formatCoverage(data.cost.costCoverage, 'usage priced')}
              />
              <Stat
                label="Median sessions per engineer"
                value={formatCount(data.sessionsPerEngineer.p50)}
              />
              <Stat label="Subagent share" value={formatPercent(data.subagentShare)} />
            </StatGrid>
            <Section title="By tool">
              <Table
                skipPagination
                data={data.harnesses.map((row) => ({ ...row, id: row.harness }))}
                columns={[
                  {
                    id: 'tool',
                    header: 'Tool',
                    cell: ({ row }) => harnessLabel(row.original.harness),
                  },
                  { accessorKey: 'activeEngineers', header: 'Engineers' },
                  { accessorKey: 'sessions', header: 'Sessions' },
                  {
                    id: 'tokens',
                    header: 'Tokens',
                    cell: ({ row }) => formatCompact(row.original.tokens),
                  },
                  {
                    id: 'tokenCoverage',
                    header: 'Requests with tokens',
                    cell: ({ row }) => formatPercent(row.original.tokenCoverage),
                  },
                  {
                    id: 'credits',
                    header: 'Credits',
                    cell: ({ row }) => formatCount(row.original.credits),
                  },
                  {
                    id: 'cost',
                    header: 'Estimated cost',
                    cell: ({ row }) => formatUsd(row.original.cost.costUsd),
                  },
                ]}
              />
            </Section>
          </>
        )}
      </QueryView>
    </Page>
  );
}
