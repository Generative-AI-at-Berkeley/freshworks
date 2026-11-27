import type { api } from '@fwcoach/contracts';

/**
 * How a skill is doing, derived only from fields the API returns. The rules
 * are deliberately simple and written down, so a manager can check them
 * (they are shown in the page's "How statuses are decided" note).
 */
export const SkillStatus = {
  TooFew: 'too_few',
  NotActivated: 'not_activated',
  Declining: 'declining',
  Low: 'low',
  Steady: 'steady',
  Strong: 'strong',
} as const;
export type SkillStatus = (typeof SkillStatus)[keyof typeof SkillStatus];

export const THRESHOLDS = {
  /** Fewer installs than this and a percentage says nothing. */
  minInstalls: 3,
  /** Under this share of installers using it, adoption is low. */
  low: 0.25,
  /** At or above this share, adoption is strong. */
  strong: 0.6,
  /** Last week's daily users below this fraction of the week before counts as declining. */
  decline: 0.7,
} as const;

export const STATUS_META: Record<
  SkillStatus,
  { label: string; tone: 'positive' | 'neutral' | 'caution' | 'negative' | 'muted'; order: number }
> = {
  [SkillStatus.NotActivated]: { label: 'Not activated', tone: 'negative', order: 0 },
  [SkillStatus.Declining]: { label: 'Declining', tone: 'caution', order: 1 },
  [SkillStatus.Low]: { label: 'Low adoption', tone: 'caution', order: 2 },
  [SkillStatus.Steady]: { label: 'Steady', tone: 'neutral', order: 3 },
  [SkillStatus.Strong]: { label: 'Strong', tone: 'positive', order: 4 },
  [SkillStatus.TooFew]: { label: 'Too few installs', tone: 'muted', order: 5 },
};

/** Statuses a manager should act on. */
export const NEEDS_ATTENTION: ReadonlySet<SkillStatus> = new Set([
  SkillStatus.NotActivated,
  SkillStatus.Declining,
  SkillStatus.Low,
]);

export function adoptionRate(
  skill: Pick<api.SkillAdoptionRow, 'activeEngineers' | 'installedEngineers'>,
): number | null {
  return skill.installedEngineers === 0 ? null : skill.activeEngineers / skill.installedEngineers;
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Average daily users over the last 7 days and the 7 before. Null when the
 * range is too short to compare two whole weeks.
 */
export function weekOverWeek(
  trend: api.SkillAdoptionRow['trend'],
): { current: number; prior: number } | null {
  if (trend.length < 14) return null;
  const values = trend.map((point) => point.activeEngineers);
  return { current: mean(values.slice(-7)), prior: mean(values.slice(-14, -7)) };
}

export function skillStatus(skill: api.SkillAdoptionRow): SkillStatus {
  if (skill.installedEngineers < THRESHOLDS.minInstalls) return SkillStatus.TooFew;
  if (skill.activeEngineers === 0) return SkillStatus.NotActivated;
  const weeks = weekOverWeek(skill.trend);
  if (weeks && weeks.prior >= 1 && weeks.current < weeks.prior * THRESHOLDS.decline)
    return SkillStatus.Declining;
  const rate = adoptionRate(skill) ?? 0;
  if (rate < THRESHOLDS.low) return SkillStatus.Low;
  if (rate >= THRESHOLDS.strong) return SkillStatus.Strong;
  return SkillStatus.Steady;
}

/** One sentence on why, built from the skill's own numbers. */
export function statusReason(skill: api.SkillAdoptionRow, status: SkillStatus): string {
  const installed = skill.installedEngineers;
  const active = skill.activeEngineers;
  switch (status) {
    case SkillStatus.NotActivated:
      return `${installed} engineers installed it and none has used it in this period.`;
    case SkillStatus.Declining: {
      const weeks = weekOverWeek(skill.trend);
      return weeks
        ? `Daily users fell from ${weeks.prior.toFixed(1)} to ${weeks.current.toFixed(1)} on average, week over week.`
        : 'Daily users are falling.';
    }
    case SkillStatus.Low:
      return `${active} of ${installed} engineers who installed it used it.`;
    case SkillStatus.Strong:
      return `${active} of ${installed} engineers who installed it used it.`;
    case SkillStatus.Steady:
      return `${active} of ${installed} engineers who installed it used it.`;
    case SkillStatus.TooFew:
      return `Only ${installed} ${installed === 1 ? 'install' : 'installs'}. A percentage would not mean much yet.`;
  }
}

/** What a manager could do next. Plain suggestions, no claims the data cannot back. */
export function nextStep(status: SkillStatus): string {
  switch (status) {
    case SkillStatus.NotActivated:
      return 'Check it still works in its tool, then tell the people who installed it what it is for.';
    case SkillStatus.Declining:
      return 'Ask a recent user what changed. A tool update or a broken prompt is the usual cause.';
    case SkillStatus.Low:
      return 'Ask the engineers who use it what it does well, and share that with the rest.';
    case SkillStatus.Steady:
      return 'No action needed. Watch the trend.';
    case SkillStatus.Strong:
      return 'Suggest it to departments where few people have it installed.';
    case SkillStatus.TooFew:
      return 'Wait for more installs before judging it.';
  }
}
