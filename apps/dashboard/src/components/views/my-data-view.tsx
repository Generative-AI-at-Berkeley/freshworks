'use client';

import { Table } from '@freshworks/dew-components';
import type { api } from '@fwcoach/contracts';
import { useQuery } from '@tanstack/react-query';

import { useCursorPages } from '@/components/common/pager';
import { Section } from '@/components/common/section';
import { EmptyState, QueryView } from '@/components/common/states';
import { Figure, Summary } from '@/components/common/summary';
import { TableFrame } from '@/components/common/table-frame';
import { Value } from '@/components/common/value';
import { Page } from '@/components/layout/page';
import { harnessLabel } from '@/config/labels';
import { useRange } from '@/hooks/use-range';
import { apiClient } from '@/lib/api-client';
import {
  formatCompact,
  formatCount,
  formatCoverage,
  formatDateTime,
  formatUsd,
} from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

import styles from './views.module.css';

function Overview({ data }: { data: api.MyData }) {
  const sessions = data.harnesses.reduce((sum, h) => sum + h.sessions, 0);
  return (
    <>
      <Summary>
        <Figure
          label="Devices"
          definition="Laptops with the collector installed that have uploaded at least once."
          value={formatCount(data.devices.length)}
        />
        <Figure label="Sessions" value={formatCount(sessions)} />
        <Figure
          label="Events stored"
          definition="Metadata records about your sessions in this period. No prompts, responses, file paths or file contents."
          value={formatCount(data.totalEvents)}
        />
        <Figure
          label="Kept for"
          definition="Raw events are dropped after this. Daily summaries are kept (ADR 0006)."
          value={formatCount(data.retentionMonths)}
          of="months"
        />
      </Summary>

      <div className={styles.wideGrid}>
        <Section
          title="Your totals"
          info="The same numbers your managers see, before they are added up with your team's."
        >
          <TableFrame>
            <Table
              skipPagination
              data={data.harnesses.map((h) => ({ ...h, id: h.harness }))}
              columns={[
                {
                  id: 'tool',
                  header: 'Tool',
                  size: 140,
                  cell: ({ row }) => harnessLabel(row.original.harness),
                },
                {
                  id: 'days',
                  header: 'Active days',
                  size: 110,
                  cell: ({ row }) => formatCount(row.original.activeDays),
                },
                {
                  id: 'sessions',
                  header: 'Sessions',
                  size: 100,
                  cell: ({ row }) => formatCount(row.original.sessions),
                },
                {
                  id: 'usage',
                  header: 'Usage',
                  size: 130,
                  cell: ({ row }) =>
                    row.original.credits !== null ? (
                      `${formatCount(row.original.credits)} credits`
                    ) : (
                      <Value
                        value={row.original.tokens}
                        format={(tokens) => `${formatCompact(tokens)} tokens`}
                      />
                    ),
                },
                {
                  id: 'cost',
                  header: 'Estimated cost',
                  size: 150,
                  cell: ({ row }) => (
                    <span className={styles.stacked}>
                      <Value
                        value={row.original.cost.costUsd}
                        format={formatUsd}
                        missing="priced"
                      />
                      <span className={styles.fields}>
                        {formatCoverage(row.original.cost.costCoverage, 'priced')}
                      </span>
                    </span>
                  ),
                },
              ]}
            />
          </TableFrame>
        </Section>
        <Section title="Your devices">
          {data.devices.length === 0 ? (
            <EmptyState title="No devices" description="No collector has uploaded for you yet." />
          ) : (
            <dl className={styles.facts}>
              {data.devices.map((device) => (
                <div key={device.deviceId}>
                  <dt className={styles.mono}>{device.deviceId}</dt>
                  <dd>{`Last upload ${formatDateTime(device.lastSeenAt)}`}</dd>
                </div>
              ))}
            </dl>
          )}
        </Section>
      </div>
    </>
  );
}

function Events() {
  const { range } = useRange();
  const pages = useCursorPages();
  const query = useQuery({
    queryKey: queryKeys.myData(range, pages.cursor),
    queryFn: () => apiClient.myData(range, pages.cursor),
    placeholderData: (previous) => previous,
  });
  return (
    <QueryView query={query}>
      {(data) => (
        <Section
          title="Events behind your numbers"
          info="Each row is one stored record. Fields lists which fields were kept, not their values. Prompt and file content are never collected."
          footer={pages.nav({
            shown: data.events.length,
            total: data.totalEvents,
            nextCursor: data.nextCursor,
          })}
        >
          {data.events.length === 0 ? (
            <EmptyState
              title="No events"
              description="Nothing was collected for you in this period."
            />
          ) : (
            <TableFrame>
              <Table
                skipPagination
                data={data.events.map((event) => ({
                  ...event,
                  id: `${event.occurredAt}-${event.eventType}-${event.sessionId ?? ''}`,
                }))}
                columns={[
                  {
                    id: 'when',
                    header: 'When',
                    size: 160,
                    cell: ({ row }) => formatDateTime(row.original.occurredAt),
                  },
                  {
                    id: 'tool',
                    header: 'Tool',
                    size: 120,
                    cell: ({ row }) => harnessLabel(row.original.harness),
                  },
                  {
                    id: 'type',
                    header: 'Event',
                    size: 150,
                    cell: ({ row }) => (
                      <span className={styles.mono}>{row.original.eventType}</span>
                    ),
                  },
                  {
                    id: 'session',
                    header: 'Session',
                    size: 150,
                    cell: ({ row }) => (
                      <span className={styles.mono}>{row.original.sessionId ?? 'None'}</span>
                    ),
                  },
                  {
                    id: 'fields',
                    header: 'Fields stored',
                    size: 300,
                    cell: ({ row }) => (
                      <span className={styles.fields}>{row.original.fields.join(', ')}</span>
                    ),
                  },
                ]}
              />
            </TableFrame>
          )}
        </Section>
      )}
    </QueryView>
  );
}

/**
 * What fwcoach holds about the signed-in person, from `/v1/me/data`. Anyone
 * can open it, for themselves only. It is the answer to "what do you collect
 * about me", so it shows the rows, not just totals.
 */
export function MyDataView() {
  const { range, days } = useRange();
  const query = useQuery({
    queryKey: queryKeys.myData(range, null),
    queryFn: () => apiClient.myData(range, null),
  });
  return (
    <Page title="My data" dataThrough={query.data?.dataThrough}>
      <QueryView query={query}>{(data) => <Overview data={data} />}</QueryView>
      <Events key={days} />
    </Page>
  );
}
