import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Counter, Gauge, Registry } from 'prom-client';

export const JobName = { Rollup: 'rollup', Retention: 'retention' } as const;
export type JobName = (typeof JobName)[keyof typeof JobName];

export interface RunJobOptions {
  /** node_exporter textfile directory. Unset records nothing. */
  metricsDir?: string | undefined;
  /** For rollup: the end of the day it covers. Becomes the freshness metric on success. */
  dataThrough?: Date;
  now?: () => number;
}

const Metric = {
  LastRun: 'fwcoach_job_last_run_timestamp_seconds',
  LastSuccess: 'fwcoach_job_last_success_timestamp_seconds',
  Duration: 'fwcoach_job_last_duration_seconds',
  Rows: 'fwcoach_job_last_rows',
  Failures: 'fwcoach_job_failures_total',
  DataThrough: 'fwcoach_job_data_through_timestamp_seconds',
} as const;
type Metric = (typeof Metric)[keyof typeof Metric];

/**
 * Runs one job and records how it went in `<metricsDir>/fwcoach_job_<name>.prom`.
 *
 * Jobs are one-shot processes started by a scheduler, so there is nothing for
 * Prometheus to scrape while they run. node_exporter's textfile collector
 * serves the file instead. Each run reads the previous file so the last
 * success time, row count and failure count survive a failed run.
 */
export async function runJob(
  name: JobName,
  job: () => Promise<number>,
  { metricsDir, dataThrough, now = Date.now }: RunJobOptions = {},
): Promise<number> {
  const startedAt = now();
  const file = metricsDir === undefined ? undefined : join(metricsDir, `fwcoach_job_${name}.prom`);
  const previous = file === undefined ? new Map<Metric, number>() : await readPrevious(file, name);

  const record = async (rows: number | undefined) => {
    if (file === undefined) return;
    const finishedAt = now();
    const values = new Map(previous);
    values.set(Metric.LastRun, finishedAt / 1000);
    values.set(Metric.Duration, (finishedAt - startedAt) / 1000);
    if (rows === undefined) {
      values.set(Metric.Failures, (previous.get(Metric.Failures) ?? 0) + 1);
    } else {
      values.set(Metric.LastSuccess, finishedAt / 1000);
      values.set(Metric.Rows, rows);
      // A re-run of an old day must not make the data look older than it is.
      if (dataThrough !== undefined) {
        const through = dataThrough.getTime() / 1000;
        values.set(Metric.DataThrough, Math.max(through, previous.get(Metric.DataThrough) ?? 0));
      }
    }
    if (!values.has(Metric.Failures)) values.set(Metric.Failures, 0);
    await writeAtomically(file, await render(name, values));
  };

  let rows: number;
  try {
    rows = await job();
  } catch (error) {
    await record(undefined);
    throw error;
  }
  await record(rows);
  return rows;
}

const HELP: Record<Metric, string> = {
  [Metric.LastRun]: 'When the job last finished, successfully or not.',
  [Metric.LastSuccess]: 'When the job last finished successfully.',
  [Metric.Duration]: 'How long the last run took.',
  [Metric.Rows]: 'Rows written or removed by the last successful run.',
  [Metric.Failures]: 'Failed runs recorded in this file.',
  [Metric.DataThrough]:
    'End of the newest day the rollup has covered. now minus this is the data lag.',
};

// Not `job`: Prometheus sets that label to the scrape job and would rename ours.
const LABEL = 'job_name';

async function render(name: JobName, values: Map<Metric, number>): Promise<string> {
  const registry = new Registry();
  for (const [metric, value] of values) {
    const config = { name: metric, help: HELP[metric], labelNames: [LABEL], registers: [registry] };
    if (metric === Metric.Failures) new Counter(config).inc({ [LABEL]: name }, value);
    else new Gauge(config).set({ [LABEL]: name }, value);
  }
  return registry.metrics();
}

async function readPrevious(file: string, name: JobName): Promise<Map<Metric, number>> {
  const values = new Map<Metric, number>();
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    return values;
  }
  const known = new Set<string>(Object.values(Metric));
  for (const line of text.split('\n')) {
    const [, metric = '', job, raw] = /^(\w+)\{job_name="(\w+)"\} (\S+)$/.exec(line) ?? [];
    if (job !== name || !known.has(metric)) continue;
    const value = Number(raw);
    if (Number.isFinite(value)) values.set(metric as Metric, value);
  }
  return values;
}

// node_exporter may read the file mid-write. A rename is atomic, a write is not.
async function writeAtomically(file: string, content: string): Promise<void> {
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, content);
  await rename(temp, file);
}
