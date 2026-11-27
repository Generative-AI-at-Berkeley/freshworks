import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { JobName, runJob } from './run-job.js';

const clock = (...times: number[]) => {
  let i = 0;
  return () => times[Math.min(i++, times.length - 1)]!;
};

describe('runJob', () => {
  it('records success, then keeps the last success through a failure', async () => {
    const metricsDir = await mkdtemp(join(tmpdir(), 'fwcoach-jobs-'));
    const file = join(metricsDir, 'fwcoach_job_rollup.prom');

    await runJob(JobName.Rollup, () => Promise.resolve(42), {
      metricsDir,
      dataThrough: new Date('2026-11-02T00:00:00Z'),
      now: clock(1_000_000, 1_004_000),
    });
    let text = await readFile(file, 'utf8');
    expect(text).toContain('fwcoach_job_last_success_timestamp_seconds{job_name="rollup"} 1004');
    expect(text).toContain('fwcoach_job_last_duration_seconds{job_name="rollup"} 4');
    expect(text).toContain('fwcoach_job_last_rows{job_name="rollup"} 42');
    expect(text).toContain('fwcoach_job_failures_total{job_name="rollup"} 0');
    expect(text).toContain(
      'fwcoach_job_data_through_timestamp_seconds{job_name="rollup"} 1793577600',
    );

    await expect(
      runJob(JobName.Rollup, () => Promise.reject(new Error('not implemented')), {
        metricsDir,
        dataThrough: new Date('2026-11-03T00:00:00Z'),
        now: clock(2_000_000, 2_001_000),
      }),
    ).rejects.toThrow('not implemented');
    text = await readFile(file, 'utf8');
    expect(text).toContain('fwcoach_job_last_run_timestamp_seconds{job_name="rollup"} 2001');
    expect(text).toContain('fwcoach_job_last_success_timestamp_seconds{job_name="rollup"} 1004');
    expect(text).toContain('fwcoach_job_last_rows{job_name="rollup"} 42');
    expect(text).toContain('fwcoach_job_failures_total{job_name="rollup"} 1');
    expect(text).toContain(
      'fwcoach_job_data_through_timestamp_seconds{job_name="rollup"} 1793577600',
    );
  });

  it('never moves data_through backwards when an old day is re-run', async () => {
    const metricsDir = await mkdtemp(join(tmpdir(), 'fwcoach-jobs-'));
    for (const day of ['2026-11-03', '2026-10-01']) {
      await runJob(JobName.Rollup, () => Promise.resolve(1), {
        metricsDir,
        dataThrough: new Date(`${day}T00:00:00Z`),
      });
    }
    const text = await readFile(join(metricsDir, 'fwcoach_job_rollup.prom'), 'utf8');
    expect(text).toContain(
      'fwcoach_job_data_through_timestamp_seconds{job_name="rollup"} 1793664000',
    );
  });

  it('writes nothing without a metrics directory', async () => {
    await expect(runJob(JobName.Retention, () => Promise.resolve(3))).resolves.toBe(3);
  });
});
