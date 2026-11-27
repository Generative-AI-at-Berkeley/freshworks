import { loadConfig } from '../config.js';
import { createPool } from '../db.js';
import { applyRetention } from './retention.js';
import { rollupDay } from './rollup-daily.js';

/**
 * Entry point for scheduled jobs. Jobs must be safe to re-run.
 *   dev:    pnpm --filter @fwcoach/api job rollup 2026-12-01
 *   image:  node dist/jobs/cli.js rollup 2026-12-01
 * With no date, rollup runs for yesterday (UTC): the last complete day.
 */
const [name, arg] = process.argv.slice(2);
const pool = createPool(loadConfig().databaseUrl);

try {
  if (name === 'rollup') await rollupDay(pool, arg ?? yesterdayUtc());
  else if (name === 'retention') await applyRetention(pool, new Date());
  else throw new Error(`Unknown job "${name ?? ''}". Expected rollup or retention.`);
} finally {
  await pool.end();
}

function yesterdayUtc(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}
