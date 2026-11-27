'use client';

import { Card } from '@freshworks/dew-components';
import type { api } from '@fwcoach/contracts';

import { BarList, TrendChart } from '@/components/common/charts';
import { Section } from '@/components/common/section';
import { StatusLabel } from '@/components/common/status';
import { EmptyState, QueryView } from '@/components/common/states';
import { Delta, type DeltaTone, Figure, Summary } from '@/components/common/summary';
import { Value } from '@/components/common/value';
import { Page } from '@/components/layout/page';
import { ROUTES } from '@/config/constants';
import { useSkillAdoption } from '@/hooks/use-skill-adoption';
import { formatCount, formatCountDelta, formatPercent, formatPointsDelta } from '@/lib/format';
import {
  adoptionRate,
  nextStep,
  skillStatus,
  statusReason,
  weekOverWeek,
} from '@/lib/skill-status';

import styles from './skill-view.module.css';

function tone(text: string | null): DeltaTone {
  if (!text || text === 'No change') return 'flat';
  return text.startsWith('+') ? 'up' : 'down';
}

function Detail({
  skill,
  prior,
  days,
}: {
  skill: api.SkillAdoptionRow;
  prior: api.SkillAdoptionRow | undefined;
  days: number;
}) {
  const status = skillStatus(skill);
  const rate = adoptionRate(skill);
  const priorRate = prior ? adoptionRate(prior) : null;
  const week = weekOverWeek(skill.trend);
  const against = `vs previous ${String(days)} days`;
  const rateDelta = formatPointsDelta(rate, priorRate);
  const usesDelta = prior ? formatCountDelta(skill.invocations, prior.invocations) : null;
  const trendDays = skill.trend.map((point) => point.day);
  const departments = [...skill.departments].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <Card variant="outlined" padding="md" as="section" aria-label="Status" className="fw-card">
        <div className={styles.verdict}>
          <StatusLabel status={status} />
          <div>
            <p className={styles.reason}>{statusReason(skill, status)}</p>
            <p className={styles.next}>{nextStep(status)}</p>
          </div>
        </div>
      </Card>

      <Summary>
        <Figure
          label="Adoption"
          definition="Engineers who used it in the period, out of engineers who have it installed."
          value={<Value value={rate} format={formatPercent} />}
          delta={
            rateDelta && rateDelta !== 'No change' ? (
              <Delta text={rateDelta} tone={tone(rateDelta)} against={against} />
            ) : undefined
          }
          note={`${formatCount(skill.activeEngineers)} of ${formatCount(skill.installedEngineers)} installed`}
        />
        <Figure
          label="Daily users"
          definition="Average engineers using it per day over the last 7 days, against the 7 days before."
          value={
            week ? week.current.toFixed(1) : <span className={styles.muted}>Needs 14 days</span>
          }
          delta={
            week && Math.abs(week.current - week.prior) >= 0.05 ? (
              <Delta
                text={`${week.current > week.prior ? '+' : '-'}${Math.abs(week.current - week.prior).toFixed(1)}`}
                tone={week.current > week.prior ? 'up' : 'down'}
                against="vs the week before"
              />
            ) : undefined
          }
          note="Last 7 days"
        />
        <Figure
          label="Uses"
          definition="Times the skill ran in the period, across all engineers."
          value={formatCount(skill.invocations)}
          delta={
            usesDelta && usesDelta !== 'No change' ? (
              <Delta text={usesDelta} tone={tone(usesDelta)} against={against} />
            ) : undefined
          }
        />
        <Figure
          label="Days to first use"
          definition="Days from install to first run, median over engineers who ran it."
          value={
            <Value
              value={skill.medianDaysToFirstUse}
              format={(value) => formatCount(value)}
              missing="unused"
            />
          }
          note="Median"
        />
      </Summary>

      <div className={styles.grid}>
        <Section
          title="Daily users"
          info="Engineers who ran the skill each day. Weekends are usually quiet."
        >
          {trendDays.length > 1 ? (
            <TrendChart
              days={trendDays}
              unit="engineers"
              series={[
                {
                  label: 'This period',
                  kind: 'primary',
                  values: skill.trend.map((p) => p.activeEngineers),
                },
                ...(prior && prior.trend.length === trendDays.length
                  ? [
                      {
                        label: `Previous ${String(days)} days`,
                        kind: 'compare' as const,
                        values: prior.trend.map((p) => p.activeEngineers),
                      },
                    ]
                  : []),
              ]}
            />
          ) : (
            <EmptyState
              title="Not enough days"
              description="Pick a longer period to see a trend."
            />
          )}
        </Section>

        <Section title="Users by department">
          {departments.length === 0 ? (
            <EmptyState
              title="No department data"
              description="The API returned no department breakdown for this skill."
            />
          ) : (
            <BarList
              unit="engineers"
              items={departments.map((d) => ({
                key: d.orgUnitId,
                label: d.name,
                value: d.activeEngineers,
              }))}
            />
          )}
        </Section>
      </div>
    </>
  );
}

/**
 * One skill in full. It reads the same adoption response as the list (one
 * request, already cached when you arrive from there), so no new API is
 * needed.
 */
export function SkillView({ skillId }: { skillId: string }) {
  const { current, previous, days } = useSkillAdoption();
  const skill = current.data?.skills.find((row) => row.skillId === skillId);
  const prior = previous?.skills.find((row) => row.skillId === skillId);
  return (
    <Page
      title={skill?.name ?? skillId}
      crumbs={[{ label: 'Skill adoption', href: ROUTES.skills }]}
      dataThrough={current.data?.dataThrough}
    >
      <QueryView query={current}>
        {() =>
          skill ? (
            <Detail skill={skill} prior={prior} days={days} />
          ) : (
            <EmptyState
              title="No such skill in this scope"
              description="Nobody you can see has it installed in this period. Try a longer period, or go back to the skill list."
            />
          )
        }
      </QueryView>
    </Page>
  );
}
