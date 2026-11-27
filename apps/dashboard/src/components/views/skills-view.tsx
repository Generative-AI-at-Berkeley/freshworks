'use client';

import { Search, SegmentedTabs, Select, Table } from '@freshworks/dew-components';
import type { api } from '@fwcoach/contracts';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Meter, Sparkline, TrendChart } from '@/components/common/charts';
import { usePaged } from '@/components/common/pager';
import { Section } from '@/components/common/section';
import { StatusLabel } from '@/components/common/status';
import { TableFrame } from '@/components/common/table-frame';
import { EmptyState, QueryView } from '@/components/common/states';
import { Delta, type DeltaTone, Figure, Summary } from '@/components/common/summary';
import { Value } from '@/components/common/value';
import { Page } from '@/components/layout/page';
import { ROUTES } from '@/config/constants';
import { harnessLabel } from '@/config/labels';
import { useWithRange } from '@/hooks/use-range';
import { useSkillAdoption } from '@/hooks/use-skill-adoption';
import { formatCount, formatPercent, formatPointsDelta } from '@/lib/format';
import { rollingMean } from '@/lib/range';
import {
  buildSkillRows,
  filterSkillRows,
  type SkillRow,
  SortKey,
  sortSkillRows,
  StatusFilter,
} from '@/lib/skill-rows';
import { NEEDS_ATTENTION, SkillStatus, statusReason, THRESHOLDS } from '@/lib/skill-status';

import styles from './skills-view.module.css';

const share = (part: number, whole: number) => (whole === 0 ? null : part / whole);

function toneOf(text: string | null): DeltaTone {
  if (!text || text === 'No change') return 'flat';
  return text.startsWith('+') ? 'up' : 'down';
}

/** KPI cards: how many engineers in scope have, use, and keep using shared skills. */
function Kpis({
  data,
  previous,
  days,
  attention,
}: {
  data: api.SkillAdoption;
  previous: api.SkillAdoption | undefined;
  days: number;
  attention: number;
}) {
  const t = data.totals;
  const of = `of ${formatCount(t.engineersInScope)}`;
  const rate = share(t.engineersUsingSkills, t.engineersInScope);
  const before = previous
    ? share(previous.totals.engineersUsingSkills, previous.totals.engineersInScope)
    : null;
  const delta = formatPointsDelta(rate, before);
  return (
    <Summary>
      <Figure
        label="Engineers using skills"
        definition="Ran at least one shared skill in the period, out of engineers in scope."
        value={<Value value={rate} format={formatPercent} />}
        delta={
          delta && delta !== 'No change' ? (
            <Delta text={delta} tone={toneOf(delta)} against={`vs previous ${String(days)} days`} />
          ) : undefined
        }
        note={`${formatCount(t.engineersUsingSkills)} of ${formatCount(t.engineersInScope)} engineers`}
      />
      <Figure
        label="Installed a skill"
        definition="Have at least one shared skill installed at the end of the period."
        value={formatCount(t.engineersWithSkills)}
        of={of}
      />
      <Figure
        label="Active last 7 days"
        definition="Ran a shared skill in the final week. The best sign of a habit."
        value={formatCount(t.engineersUsingLast7Days)}
        of={of}
      />
      <Figure
        label="Skills needing attention"
        definition={`Not activated, declining, or under ${formatPercent(THRESHOLDS.low)} of installers using it.`}
        value={formatCount(attention)}
        of={`of ${formatCount(data.skills.length)}`}
      />
    </Summary>
  );
}

function DailyActive({
  data,
  previous,
  days,
}: {
  data: api.SkillAdoption;
  previous: api.SkillAdoption | undefined;
  days: number;
}) {
  const trendDays = data.totals.trend.map((point) => point.day);
  const series = [
    {
      label: 'This period',
      kind: 'primary' as const,
      values: rollingMean(data.totals.trend.map((p) => p.engineersUsingSkills)),
    },
    ...(previous && previous.totals.trend.length === trendDays.length
      ? [
          {
            label: `Previous ${String(days)} days`,
            kind: 'compare' as const,
            values: rollingMean(previous.totals.trend.map((p) => p.engineersUsingSkills)),
          },
        ]
      : []),
  ];
  return (
    <Section
      title="Daily active engineers"
      info="Engineers who ran any shared skill each day, as a 7-day average."
      height={WIDGET_HEIGHT}
    >
      {trendDays.length > 1 ? (
        <TrendChart
          days={trendDays}
          series={series}
          height={276}
          unit="engineers a day"
          format={(value) => value.toFixed(1)}
        />
      ) : (
        <EmptyState title="Not enough days" description="Pick a longer period to see a trend." />
      )}
    </Section>
  );
}

function InsightItem({ row }: { row: SkillRow }) {
  const withRange = useWithRange();
  return (
    <li className={styles.insight}>
      <div className={styles.insightHead}>
        <NextLink href={withRange(ROUTES.skill(row.id))} className={styles.skillLink}>
          {row.skill.name}
        </NextLink>
        <StatusLabel status={row.status} />
      </div>
      <p className={styles.reason}>{statusReason(row.skill, row.status)}</p>
    </li>
  );
}

const WIDGET_HEIGHT = 400;

const StatusTab = {
  Attention: 'attention',
  Strong: 'strong',
} as const;
type StatusTab = (typeof StatusTab)[keyof typeof StatusTab];

/** Skills by what to do about them, three to a page so the card keeps its height. */
function StatusCard({
  attention,
  strong,
}: {
  attention: readonly SkillRow[];
  strong: readonly SkillRow[];
}) {
  const [tab, setTab] = useState<StatusTab>(
    attention.length > 0 ? StatusTab.Attention : StatusTab.Strong,
  );
  const rows = tab === StatusTab.Attention ? attention : strong;
  const { visible, nav } = usePaged(rows, 3);
  return (
    <Section
      title="Skill status"
      info={`Needs attention: not activated, declining (daily users down ${formatPercent(1 - THRESHOLDS.decline)} or more week over week), or under ${formatPercent(THRESHOLDS.low)} of installers using it. Working well: ${formatPercent(THRESHOLDS.strong)} or more. Under ${String(THRESHOLDS.minInstalls)} installs is not judged.`}
      height={WIDGET_HEIGHT}
      actions={
        <SegmentedTabs
          className={styles.segments}
          size="mini"
          value={tab}
          onValueChange={(value) => {
            setTab(value as StatusTab);
          }}
        >
          <SegmentedTabs.List aria-label="Skill status">
            <SegmentedTabs.Trigger value={StatusTab.Attention}>
              {`Needs attention (${String(attention.length)})`}
            </SegmentedTabs.Trigger>
            <SegmentedTabs.Trigger value={StatusTab.Strong}>
              {`Working well (${String(strong.length)})`}
            </SegmentedTabs.Trigger>
          </SegmentedTabs.List>
        </SegmentedTabs>
      }
      footer={nav}
    >
      {rows.length === 0 ? (
        <p className={styles.none}>
          {tab === StatusTab.Attention
            ? 'Nothing needs attention in this period.'
            : 'No skill has reached strong adoption yet.'}
        </p>
      ) : (
        <ul className={styles.insightList}>
          {visible.map((row) => (
            <InsightItem key={row.id} row={row} />
          ))}
        </ul>
      )}
    </Section>
  );
}

const SORTABLE: Record<string, SortKey> = {
  name: SortKey.Name,
  status: SortKey.Status,
  adoption: SortKey.Adoption,
  dailyUsers: SortKey.DailyUsers,
  uses: SortKey.Uses,
  firstUse: SortKey.FirstUse,
};

function SkillsTable({ rows, days }: { rows: readonly SkillRow[]; days: number }) {
  const router = useRouter();
  const withRange = useWithRange();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>(StatusFilter.All);
  const [harness, setHarness] = useState('all');
  const [sorting, setSorting] = useState<{ id: string; desc: boolean }[]>([
    { id: 'status', desc: false },
  ]);
  const tools = useMemo(() => [...new Set(rows.map((row) => row.skill.harness))].sort(), [rows]);
  const sort = sorting[0] ?? { id: 'status', desc: false };
  const matching = sortSkillRows(
    filterSkillRows(rows, { search, status, harness }),
    SORTABLE[sort.id] ?? SortKey.Status,
    sort.desc,
  );
  const { visible, nav } = usePaged(matching, 5);
  const toolOptions = [
    { value: 'all', label: 'All tools' },
    ...tools.map((tool) => ({ value: tool, label: harnessLabel(tool) })),
  ];

  return (
    <Section
      title="All skills"
      info="Adoption is engineers who used a skill in the period, out of engineers who have it installed. Daily users averages the last 7 days."
      footer={nav}
    >
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Search
            aria-label="Search skills"
            placeholder="Search skills"
            value={search}
            onValueChange={setSearch}
            onClear={() => {
              setSearch('');
            }}
          />
        </div>
        <SegmentedTabs
          className={styles.segments}
          size="mini"
          value={status}
          onValueChange={(value) => {
            setStatus(value as StatusFilter);
          }}
        >
          <SegmentedTabs.List aria-label="Filter by status">
            <SegmentedTabs.Trigger value={StatusFilter.All}>All</SegmentedTabs.Trigger>
            <SegmentedTabs.Trigger value={StatusFilter.Attention}>
              Needs attention
            </SegmentedTabs.Trigger>
            <SegmentedTabs.Trigger value={StatusFilter.Strong}>Working well</SegmentedTabs.Trigger>
          </SegmentedTabs.List>
        </SegmentedTabs>
        {tools.length > 1 && (
          <div className={styles.toolSelect}>
            <Select
              aria-label="Filter by tool"
              classNames={{ popup: styles.toolPopup }}
              options={toolOptions}
              value={toolOptions.find((option) => option.value === harness) ?? toolOptions[0]}
              onValueChange={(option) => {
                setHarness(option ? option.value : 'all');
              }}
            />
          </div>
        )}
      </div>
      {visible.length === 0 ? (
        <EmptyState
          title="No skills match"
          description="Clear the search or pick a different filter."
        />
      ) : (
        <TableFrame clickable>
          <Table
            skipPagination
            enableSorting
            sortingState={sorting}
            onSortChange={setSorting}
            data={[...visible]}
            onRowClick={(row) => {
              router.push(withRange(ROUTES.skill(row.id)));
            }}
            columns={[
              {
                id: 'name',
                accessorFn: (row: SkillRow) => row.skill.name,
                header: 'Skill',
                size: 160,
                cell: ({ row }) => (
                  <NextLink
                    href={withRange(ROUTES.skill(row.original.id))}
                    className={styles.skillLink}
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    {row.original.skill.name}
                  </NextLink>
                ),
              },
              {
                id: 'tool',
                header: 'Tool',
                size: 120,
                enableSorting: false,
                cell: ({ row }) => harnessLabel(row.original.skill.harness),
              },
              {
                id: 'status',
                accessorFn: (row: SkillRow) => row.status,
                header: 'Status',
                size: 120,
                cell: ({ row }) => <StatusLabel status={row.original.status} />,
              },
              {
                id: 'adoption',
                accessorFn: (row: SkillRow) => row.rate,
                header: 'Adoption',
                size: 250,
                cell: ({ row }) => {
                  const { skill, rate, previousRate } = row.original;
                  const delta = formatPointsDelta(rate, previousRate);
                  return (
                    <span className={styles.inline}>
                      <span className={styles.meter}>
                        <Meter
                          share={rate ?? 0}
                          label={`${formatPercent(rate ?? 0)} adoption`}
                          tone={rate === 0 ? 'muted' : 'data'}
                        />
                      </span>
                      <span className={styles.rate}>
                        <Value value={rate} format={formatPercent} />
                      </span>
                      <span className={styles.secondary}>
                        {`${formatCount(skill.activeEngineers)} of ${formatCount(skill.installedEngineers)}`}
                      </span>
                      {delta && delta !== 'No change' && (
                        <Delta
                          text={delta}
                          tone={toneOf(delta)}
                          against={`vs previous ${String(days)} days`}
                        />
                      )}
                    </span>
                  );
                },
              },
              {
                id: 'dailyUsers',
                accessorFn: (row: SkillRow) => row.week?.current ?? null,
                header: 'Daily users',
                size: 120,
                cell: ({ row }) => {
                  const { week } = row.original;
                  if (!week) return <span className={styles.secondary}>Needs 14 days</span>;
                  const diff = week.current - week.prior;
                  return (
                    <span className={styles.inline}>
                      <span className={styles.rate}>{week.current.toFixed(1)}</span>
                      {Math.abs(diff) >= 0.05 && (
                        <Delta
                          text={`${diff > 0 ? '+' : '-'}${Math.abs(diff).toFixed(1)}`}
                          tone={diff > 0 ? 'up' : 'down'}
                          against="vs the week before"
                        />
                      )}
                    </span>
                  );
                },
              },
              {
                id: 'trend',
                header: 'Trend',
                size: 90,
                enableSorting: false,
                cell: ({ row }) => {
                  const points = row.original.skill.trend;
                  const peak = Math.max(0, ...points.map((p) => p.activeEngineers));
                  return (
                    <Sparkline
                      values={rollingMean(points.map((point) => point.activeEngineers))}
                      label={`Daily users over ${String(days)} days as a 7-day average. Busiest day had ${formatCount(peak)}.`}
                    />
                  );
                },
              },
              {
                id: 'uses',
                accessorFn: (row: SkillRow) => row.skill.invocations,
                header: 'Uses',
                size: 95,
                cell: ({ row }) => formatCount(row.original.skill.invocations),
              },
              {
                id: 'firstUse',
                accessorFn: (row: SkillRow) => row.skill.medianDaysToFirstUse,
                header: 'First use',
                size: 120,
                cell: ({ row }) => (
                  <Value
                    value={row.original.skill.medianDaysToFirstUse}
                    format={(value) => `${formatCount(value)} ${value === 1 ? 'day' : 'days'}`}
                    missing="unused"
                  />
                ),
              },
            ]}
          />
        </TableFrame>
      )}
    </Section>
  );
}

/**
 * Skill adoption, the sponsor's headline view (spec 7.6). It answers, in
 * order: are engineers using the shared skills, which skills are working,
 * which are not and why, and what to do. Installed is never read as adopted.
 */
export function SkillsView() {
  const { current, previous, days } = useSkillAdoption();
  return (
    <Page title="Skill adoption" dataThrough={current.data?.dataThrough}>
      <QueryView query={current}>
        {(data) => {
          if (data.skills.length === 0) {
            return (
              <EmptyState
                title="No shared skills yet"
                description="Nobody in this scope has a shared skill installed in this period. Skills show up here once the collector sees one."
              />
            );
          }
          const rows = buildSkillRows(data, previous);
          const attention = sortSkillRows(
            rows.filter((row) => NEEDS_ATTENTION.has(row.status)),
            SortKey.Status,
            false,
          );
          const strong = sortSkillRows(
            rows.filter((row) => row.status === SkillStatus.Strong),
            SortKey.Adoption,
            true,
          );
          return (
            <>
              <Kpis data={data} previous={previous} days={days} attention={attention.length} />
              <div className={styles.grid}>
                <DailyActive data={data} previous={previous} days={days} />
                <StatusCard attention={attention} strong={strong} />
              </div>
              <SkillsTable rows={rows} days={days} />
            </>
          );
        }}
      </QueryView>
    </Page>
  );
}
