'use client';

import { Search, SegmentedTabs, Table } from '@freshworks/dew-components';
import type { api } from '@fwcoach/contracts';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Meter, Sparkline, TrendChart } from '@/components/common/charts';
import { Section } from '@/components/common/section';
import { StatusLabel } from '@/components/common/status';
import { TableFrame } from '@/components/common/table-frame';
import { EmptyState, QueryView } from '@/components/common/states';
import { Delta, type DeltaTone } from '@/components/common/summary';
import { Value } from '@/components/common/value';
import { Page } from '@/components/layout/page';
import { ROUTES } from '@/config/constants';
import { harnessLabel } from '@/config/labels';
import { useWithRange } from '@/hooks/use-range';
import { useSession } from '@/hooks/use-session';
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
import {
  NEEDS_ATTENTION,
  nextStep,
  SkillStatus,
  statusReason,
  THRESHOLDS,
} from '@/lib/skill-status';

import styles from './skills-view.module.css';

const share = (part: number, whole: number) => (whole === 0 ? null : part / whole);

function toneOf(text: string | null): DeltaTone {
  if (!text || text === 'No change') return 'flat';
  return text.startsWith('+') ? 'up' : 'down';
}

/**
 * The headline: of the engineers this person can see, how many use shared
 * skills at all, and the path from installed to used to still using.
 */
function Overview({
  data,
  previous,
  days,
}: {
  data: api.SkillAdoption;
  previous: api.SkillAdoption | undefined;
  days: number;
}) {
  const t = data.totals;
  const rate = share(t.engineersUsingSkills, t.engineersInScope);
  const before = previous
    ? share(previous.totals.engineersUsingSkills, previous.totals.engineersInScope)
    : null;
  const delta = formatPointsDelta(rate, before);
  const funnel = [
    {
      label: 'Have a shared skill installed',
      value: t.engineersWithSkills,
      definition: 'At least one shared skill installed at the end of the period.',
    },
    {
      label: 'Used one in this period',
      value: t.engineersUsingSkills,
      definition: 'Ran at least one shared skill on any day in the period.',
    },
    {
      label: 'Used one in the last 7 days',
      value: t.engineersUsingLast7Days,
      definition: 'Ran at least one shared skill in the final week. The best sign of a habit.',
    },
  ];
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
    <section className={styles.overview} aria-label="Adoption overview">
      <div className={styles.headline}>
        <p className={styles.kpiLabel}>Engineers using shared skills</p>
        <p className={styles.kpi}>
          <Value value={rate} format={formatPercent} />
        </p>
        <p className={styles.kpiNote}>
          {`${formatCount(t.engineersUsingSkills)} of ${formatCount(t.engineersInScope)} engineers in scope used at least one shared skill.`}
        </p>
        {delta && (
          <Delta text={delta} tone={toneOf(delta)} against={`vs previous ${String(days)} days`} />
        )}
        <ul className={styles.funnel}>
          {funnel.map((step) => {
            const part = share(step.value, t.engineersInScope) ?? 0;
            return (
              <li key={step.label} className={styles.step}>
                <span className={styles.stepLabel} title={step.definition}>
                  {step.label}
                </span>
                <span className={styles.stepValue}>
                  {formatCount(step.value)}
                  <span className={styles.stepShare}>{formatPercent(part)}</span>
                </span>
                <Meter
                  share={part}
                  label={`${step.label}: ${formatCount(step.value)} of ${formatCount(t.engineersInScope)}`}
                />
              </li>
            );
          })}
        </ul>
      </div>
      <div className={styles.chart}>
        <p className={styles.chartTitle}>Engineers using any shared skill per day, 7-day average</p>
        {trendDays.length > 1 ? (
          <TrendChart
            days={trendDays}
            series={series}
            unit="engineers a day"
            format={(value) => value.toFixed(1)}
          />
        ) : (
          <EmptyState title="Not enough days" description="Pick a longer period to see a trend." />
        )}
      </div>
    </section>
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
        <span className={styles.tool}>{harnessLabel(row.skill.harness)}</span>
        <span className={styles.insightStatus}>
          <StatusLabel status={row.status} />
        </span>
      </div>
      <p className={styles.reason}>{statusReason(row.skill, row.status)}</p>
      <p className={styles.next}>{nextStep(row.status)}</p>
    </li>
  );
}

/** Groups skills by what a manager would do about them. Strong and weak never share a list. */
function Insights({ rows }: { rows: readonly SkillRow[] }) {
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
  const tooFew = rows.filter((row) => row.status === SkillStatus.TooFew);
  return (
    <Section
      title="Where to act"
      hint={`Statuses come from each skill's own numbers. Low is under ${formatPercent(THRESHOLDS.low)} of installers using it, strong is ${formatPercent(THRESHOLDS.strong)} or more, declining is daily users down by ${formatPercent(1 - THRESHOLDS.decline)} or more week over week.`}
    >
      <div className={styles.insights}>
        <div className={styles.column}>
          <h3 className={styles.columnTitle}>
            Needs attention <span className={styles.count}>{attention.length}</span>
          </h3>
          {attention.length === 0 ? (
            <p className={styles.none}>Nothing needs attention in this period.</p>
          ) : (
            <ul className={styles.insightList}>
              {attention.map((row) => (
                <InsightItem key={row.id} row={row} />
              ))}
            </ul>
          )}
        </div>
        <div className={styles.column}>
          <h3 className={styles.columnTitle}>
            Working well <span className={styles.count}>{strong.length}</span>
          </h3>
          {strong.length === 0 ? (
            <p className={styles.none}>No skill has reached strong adoption yet.</p>
          ) : (
            <ul className={styles.insightList}>
              {strong.map((row) => (
                <InsightItem key={row.id} row={row} />
              ))}
            </ul>
          )}
          {tooFew.length > 0 && (
            <p className={styles.footnote}>
              {`Not judged yet, under ${String(THRESHOLDS.minInstalls)} installs: ${tooFew.map((row) => row.skill.name).join(', ')}.`}
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}

const SORT_LABEL: Record<string, string> = {
  name: 'skill name',
  status: 'status',
  adoption: 'adoption',
  dailyUsers: 'daily users',
  uses: 'uses',
  firstUse: 'days to first use',
};

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
  const visible = sortSkillRows(
    filterSkillRows(rows, { search, status, harness }),
    SORTABLE[sort.id] ?? SortKey.Status,
    sort.desc,
  );

  return (
    <Section
      title="All skills"
      hint="Adoption is engineers who used a skill in the period, out of engineers who have it installed. Select a row for the full picture."
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
          <SegmentedTabs
            className={styles.segments}
            size="mini"
            value={harness}
            onValueChange={setHarness}
          >
            <SegmentedTabs.List aria-label="Filter by tool">
              <SegmentedTabs.Trigger value="all">All tools</SegmentedTabs.Trigger>
              {tools.map((tool) => (
                <SegmentedTabs.Trigger key={tool} value={tool}>
                  {harnessLabel(tool)}
                </SegmentedTabs.Trigger>
              ))}
            </SegmentedTabs.List>
          </SegmentedTabs>
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
            data={visible}
            onRowClick={(row) => {
              router.push(withRange(ROUTES.skill(row.id)));
            }}
            columns={[
              {
                id: 'name',
                accessorFn: (row: SkillRow) => row.skill.name,
                header: 'Skill',
                size: 200,
                cell: ({ row }) => (
                  <span className={styles.nameCell}>
                    <NextLink
                      href={withRange(ROUTES.skill(row.original.id))}
                      className={styles.skillLink}
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      {row.original.skill.name}
                    </NextLink>
                    <span className={styles.tool}>{harnessLabel(row.original.skill.harness)}</span>
                  </span>
                ),
              },
              {
                id: 'status',
                accessorFn: (row: SkillRow) => row.status,
                header: 'Status',
                size: 150,
                cell: ({ row }) => <StatusLabel status={row.original.status} />,
              },
              {
                id: 'adoption',
                accessorFn: (row: SkillRow) => row.rate,
                header: 'Adoption',
                size: 190,
                cell: ({ row }) => {
                  const { skill, rate, previousRate } = row.original;
                  const delta = formatPointsDelta(rate, previousRate);
                  return (
                    <span className={styles.adoption}>
                      <span className={styles.adoptionTop}>
                        <span className={styles.rate}>
                          <Value value={rate} format={formatPercent} />
                        </span>
                        <span className={styles.secondary}>
                          {`${formatCount(skill.activeEngineers)} of ${formatCount(skill.installedEngineers)}`}
                        </span>
                        {delta && delta !== 'No change' && (
                          <span
                            className={styles.change}
                            data-tone={toneOf(delta)}
                            title={`Change in adoption vs the previous ${String(days)} days`}
                          >
                            {delta}
                          </span>
                        )}
                      </span>
                      <Meter
                        share={rate ?? 0}
                        label={`${formatPercent(rate ?? 0)} adoption`}
                        tone={rate === 0 ? 'muted' : 'data'}
                      />
                    </span>
                  );
                },
              },
              {
                id: 'dailyUsers',
                accessorFn: (row: SkillRow) => row.week?.current ?? null,
                header: 'Daily users, last 7 days',
                size: 170,
                cell: ({ row }) => {
                  const { week } = row.original;
                  if (!week) return <span className={styles.secondary}>Needs 14 days</span>;
                  const diff = week.current - week.prior;
                  return (
                    <span className={styles.daily}>
                      <span className={styles.rate}>{week.current.toFixed(1)}</span>
                      <span className={styles.secondary}>
                        {Math.abs(diff) < 0.05
                          ? 'flat'
                          : `${diff > 0 ? '+' : '−'}${Math.abs(diff).toFixed(1)} vs prior week`}
                      </span>
                    </span>
                  );
                },
              },
              {
                id: 'trend',
                header: `Trend, ${String(days)} days`,
                size: 150,
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
                size: 90,
                cell: ({ row }) => formatCount(row.original.skill.invocations),
              },
              {
                id: 'firstUse',
                accessorFn: (row: SkillRow) => row.skill.medianDaysToFirstUse,
                header: 'Median days to first use',
                size: 140,
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
      <p className={styles.footnote}>
        {`Showing ${String(visible.length)} of ${String(rows.length)} skills, sorted by ${SORT_LABEL[sort.id] ?? 'status'}${sort.id === 'status' ? ', most urgent first' : ''}.`}
      </p>
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
  const session = useSession();
  const org = session.data ? (session.data.orgUnitName ?? session.data.orgUnitId) : undefined;
  const scope =
    org && current.data
      ? `${org}, ${formatCount(current.data.totals.engineersInScope)} engineers`
      : org;

  return (
    <Page
      title="Skill adoption"
      description="Whether engineers use the shared skills they have installed, and which skills need a push."
      scope={scope}
      dataThrough={current.data?.dataThrough}
      compares
    >
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
          return (
            <>
              <Overview data={data} previous={previous} days={days} />
              <Insights rows={rows} />
              <SkillsTable rows={rows} days={days} />
            </>
          );
        }}
      </QueryView>
    </Page>
  );
}
