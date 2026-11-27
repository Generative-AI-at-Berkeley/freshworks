'use client';

import { Table } from '@freshworks/dew-components';
import type { api } from '@fwcoach/contracts';
import { useQuery } from '@tanstack/react-query';
import NextLink from 'next/link';

import { useCursorPages } from '@/components/common/pager';
import { PersonName } from '@/components/common/person';
import { Section } from '@/components/common/section';
import { EmptyState, QueryView } from '@/components/common/states';
import { TableFrame } from '@/components/common/table-frame';
import { Page } from '@/components/layout/page';
import { ROUTES } from '@/config/constants';
import { useRange, useWithRange } from '@/hooks/use-range';
import { apiClient } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

import styles from './views.module.css';

function Log() {
  const { range } = useRange();
  const withRange = useWithRange();
  const pages = useCursorPages();
  const query = useQuery({
    queryKey: queryKeys.accessLog(range, pages.cursor),
    queryFn: () => apiClient.accessLog(range, pages.cursor),
    placeholderData: (previous) => previous,
  });
  return (
    <QueryView query={query}>
      {(data: api.AccessLog) => (
        <Section
          title={`Views of engineer pages (${String(data.total)})`}
          info="Every time someone opens an engineer's page, the API records who, whom and when, in the same transaction as the read. Newest first."
          footer={pages.nav({
            shown: data.entries.length,
            total: data.total,
            nextCursor: data.nextCursor,
          })}
        >
          {data.entries.length === 0 ? (
            <EmptyState
              title="No views"
              description="Nobody opened an engineer page in this period."
            />
          ) : (
            <TableFrame>
              <Table
                skipPagination
                data={data.entries.map((entry) => ({
                  ...entry,
                  id: `${entry.viewedAt}-${entry.viewer.id}-${entry.subject.id}`,
                }))}
                columns={[
                  {
                    id: 'when',
                    header: 'When',
                    size: 170,
                    cell: ({ row }) => formatDateTime(row.original.viewedAt),
                  },
                  {
                    id: 'viewer',
                    header: 'Viewer',
                    size: 200,
                    cell: ({ row }) => <PersonName name={row.original.viewer.name} />,
                  },
                  {
                    id: 'subject',
                    header: 'Viewed',
                    size: 200,
                    cell: ({ row }) => (
                      <NextLink
                        className={styles.link}
                        href={withRange(ROUTES.engineer(row.original.subject.id))}
                      >
                        {row.original.subject.name}
                      </NextLink>
                    ),
                  },
                  {
                    id: 'route',
                    header: 'Route',
                    size: 200,
                    cell: ({ row }) => <span className={styles.mono}>{row.original.route}</span>,
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

/** Who looked at whom. Admins only (BE-2 serves it). */
export function AccessLogView() {
  const { days } = useRange();
  return (
    <Page title="Access log">
      {/* A new period starts again from the first page. */}
      <Log key={days} />
    </Page>
  );
}
