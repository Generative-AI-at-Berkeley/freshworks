'use client';

import { Table } from '@freshworks/dew-components';
import type { api } from '@fwcoach/contracts';
import { useQuery } from '@tanstack/react-query';

import { BarList, TrendChart } from '@/components/common/charts';
import { Paged } from '@/components/common/pager';
import { PersonName } from '@/components/common/person';
import { Section } from '@/components/common/section';
import { EmptyState, QueryView } from '@/components/common/states';
import { Figure, Summary } from '@/components/common/summary';
import { TableFrame } from '@/components/common/table-frame';
import { Page } from '@/components/layout/page';
import { harnessLabel } from '@/config/labels';
import { useRange } from '@/hooks/use-range';
import { apiClient } from '@/lib/api-client';
import { formatCount, formatDateTime, formatDay, formatPercent } from '@/lib/format';
import { queryKeys } from '@/lib/query-keys';

import styles from './views.module.css';

const ROW_HEIGHT = 340;
const SHORT_ROW_HEIGHT = 240;

const REASON_LABEL: Record<api.RejectionReason, string> = {
  invalid_schema: 'Failed schema check',
  too_large: 'Over the size limit',
  not_base64: 'Not base64',
};

function Health({ data }: { data: api.FleetHealth }) {
  const received = data.uploads.reduce((sum, d) => sum + d.accepted + d.duplicates + d.rejected, 0);
  const rejected = data.uploads.reduce((sum, d) => sum + d.rejected, 0);
  const latest = data.agentVersions[0];
  const peak = data.uploads.reduce<api.FleetHealth['uploads'][number] | null>(
    (best, d) => (best === null || d.rejected > best.rejected ? d : best),
    null,
  );
  const days = data.uploads.map((d) => d.day);
  const retention = data.lastRetentionRun;

  return (
    <>
      <Summary>
        <Figure
          label="Reporting"
          definition="Devices that uploaded in the last 24 hours, out of all devices whose owner is still here."
          value={formatCount(data.devices.reportingLastDay)}
          of={`of ${formatCount(data.devices.total)} devices`}
        />
        <Figure
          label="Quiet devices"
          definition="No upload for 3 days or more. Often a laptop that is off, sometimes a collector that stopped."
          value={formatCount(data.devices.quiet)}
        />
        <Figure
          label="Records rejected"
          definition="Records the pipeline refused to store in this period. The payload is never kept, only why."
          value={formatCount(rejected)}
          note={
            rejected > 0 && rejected / received < 0.01
              ? 'Under 1% of received'
              : `${formatPercent(received === 0 ? null : rejected / received)} of received`
          }
        />
        <Figure
          label="Latest collector"
          definition="The newest collector version seen, and how many devices run it."
          value={latest ? latest.version : 'None'}
          note={
            latest
              ? `${formatCount(latest.devices)} of ${formatCount(data.devices.total)} devices`
              : undefined
          }
        />
      </Summary>

      <div className={styles.wideGrid}>
        <Section
          title="Rejected records per day"
          info={
            peak && peak.rejected > 0
              ? `Peak on ${formatDay(peak.day)} with ${formatCount(peak.rejected)}. A spike after a collector release usually means a schema change.`
              : 'Records refused by the pipeline each day.'
          }
          height={ROW_HEIGHT}
        >
          {days.length > 1 ? (
            <TrendChart
              days={days}
              unit="records rejected"
              height={236}
              series={[
                { label: 'Rejected', kind: 'primary', values: data.uploads.map((d) => d.rejected) },
              ]}
            />
          ) : (
            <EmptyState
              title="Not enough days"
              description="Pick a longer period to see a trend."
            />
          )}
        </Section>
        <Section title="Why records were rejected" height={ROW_HEIGHT}>
          <BarList
            unit="records"
            items={data.rejections.map((r) => ({
              key: r.reason,
              label: REASON_LABEL[r.reason],
              value: r.count,
            }))}
          />
        </Section>
      </div>

      <div className={styles.thirds}>
        <Section title="Collector versions" height={SHORT_ROW_HEIGHT}>
          <BarList
            unit="devices"
            total={data.devices.total}
            items={data.agentVersions.map((v) => ({
              key: v.version,
              label: v.version,
              value: v.devices,
            }))}
          />
        </Section>
        <Section
          title="Tools reporting"
          info="Devices that sent events for each tool in this period."
          height={SHORT_ROW_HEIGHT}
        >
          <BarList
            unit="devices"
            total={data.devices.total}
            items={data.harnesses.map((h) => ({
              key: h.harness,
              label: harnessLabel(h.harness),
              value: h.devices,
            }))}
          />
        </Section>
        <Section
          title="Retention"
          info="Raw events older than 13 months are dropped by partition (ADR 0006). Each run is recorded."
          height={SHORT_ROW_HEIGHT}
        >
          {retention ? (
            <dl className={styles.facts}>
              <div>
                <dt>Last run</dt>
                <dd>{formatDateTime(retention.ranAt)}</dd>
              </div>
              <div>
                <dt>Mode</dt>
                <dd>{retention.dryRun ? 'Dry run' : 'Live'}</dd>
              </div>
              <div>
                <dt>Partitions dropped</dt>
                <dd>{formatCount(retention.partitionsDropped)}</dd>
              </div>
              <div>
                <dt>Rows purged</dt>
                <dd>{formatCount(retention.rowsPurged)}</dd>
              </div>
            </dl>
          ) : (
            <p className={styles.muted}>The retention job has not run yet.</p>
          )}
        </Section>
      </div>

      <Paged items={data.quietDevices} perPage={8}>
        {(visible, nav) => (
          <Section
            title="Quiet devices"
            info="No upload for 3 days or more, sorted by owner."
            footer={nav}
          >
            {data.quietDevices.length === 0 ? (
              <EmptyState
                title="Every device is reporting"
                description="Nothing has been quiet for 3 days."
              />
            ) : (
              <TableFrame>
                <Table
                  skipPagination
                  data={visible.map((device) => ({ ...device, id: device.deviceId }))}
                  columns={[
                    {
                      id: 'owner',
                      header: 'Owner',
                      size: 220,
                      cell: ({ row }) => <PersonName name={row.original.owner.name} />,
                    },
                    {
                      id: 'device',
                      header: 'Device',
                      size: 160,
                      cell: ({ row }) => (
                        <span className={styles.mono}>{row.original.deviceId}</span>
                      ),
                    },
                    {
                      id: 'version',
                      header: 'Collector',
                      size: 120,
                      cell: ({ row }) => row.original.agentVersion ?? 'Unknown',
                    },
                    {
                      id: 'lastSeen',
                      header: 'Last upload',
                      size: 180,
                      cell: ({ row }) => formatDateTime(row.original.lastSeenAt),
                    },
                  ]}
                />
              </TableFrame>
            )}
          </Section>
        )}
      </Paged>
    </>
  );
}

/** Whether collectors are reporting and what the pipeline drops. Admins only (BE-4 serves it). */
export function FleetView() {
  const { range } = useRange();
  const query = useQuery({
    queryKey: queryKeys.fleetHealth(range),
    queryFn: () => apiClient.fleetHealth(range),
  });
  return (
    <Page title="Fleet health" dataThrough={query.data?.dataThrough}>
      <QueryView query={query}>{(data) => <Health data={data} />}</QueryView>
    </Page>
  );
}
