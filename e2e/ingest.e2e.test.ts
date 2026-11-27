import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { decodeBatch, encodeBatch, OTLP_LOGS_PATH, TelemetryEvent } from '@fwcoach/contracts';
import { fromFetch, parseProblem } from '@fwcoach/testkit';
import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * Ingest idempotency and rejection, over HTTP against the compose stack's
 * ingest-mock. The HTTP answers are live today. Whether a row was stored
 * once is a Postgres question, and ingest-mock keeps events in memory until
 * BE-1 lands PostgresEventStore, so those checks switch on by themselves
 * once `app.ingest_msg` and `app.event` exist.
 */
const ingestUrl = process.env.INGEST_URL ?? 'http://localhost:4318';
const dbUrl = process.env.APP_DATABASE_URL;

const require = createRequire(import.meta.url);
const event = TelemetryEvent.parse(
  JSON.parse(
    readFileSync(require.resolve('@fwcoach/contracts/fixtures/v2/sessionStart.json'), 'utf8'),
  ),
);
const batch = encodeBatch([event], { agentVersion: '0.1.0' });
const decoded = decodeBatch(batch)[0];
const msgId = decoded?.ok ? decoded.message.msg_id : '';

// A token of its own, so this suite's device never collides with another test's.
const headers = { authorization: 'Bearer e2e_ingest', 'content-type': 'application/json' };
const post = (body: unknown) =>
  fetch(`${ingestUrl}${OTLP_LOGS_PATH}`, { method: 'POST', headers, body: JSON.stringify(body) });

async function hasBe1Tables(url: string | undefined): Promise<boolean> {
  if (!url) return false;
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ ready: boolean }>(
      `select to_regclass('app.ingest_msg') is not null
          and to_regclass('app.event') is not null as ready`,
    );
    return rows[0]?.ready ?? false;
  } finally {
    await client.end();
  }
}
const stored = await hasBe1Tables(dbUrl);

describe('ingest', () => {
  describe('a replayed batch', () => {
    it('is accepted both times with no rejections, as the collector retries', async () => {
      for (let i = 0; i < 2; i++) {
        const res = await post(batch);
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({});
      }
    });

    describe.runIf(stored)('in Postgres (BE-1)', () => {
      const pool = new pg.Pool({ connectionString: dbUrl });
      afterAll(() => pool.end());

      it('claims the msg_id once and stores one event row', async () => {
        await post(batch);
        const { rows } = await pool.query<{ msgs: string; events: string }>(
          `select (select count(*) from app.ingest_msg where msg_id = $1) as msgs,
                  (select count(*) from app.event where msg_id = $1) as events`,
          [msgId],
        );
        expect(rows[0]).toEqual({ msgs: '1', events: '1' });
      });
    });
    it.todo('BE-1: ingest_batch counts the second upload as duplicates, not accepted');
  });

  describe('an invalid record', () => {
    it('is counted as rejected and the good record in its batch still lands', async () => {
      const bad = structuredClone(batch);
      // Valid base64 JSON that is not a delivery message: invalid_schema.
      bad.resourceLogs[0]!.scopeLogs[0]!.logRecords.push({
        timeUnixNano: '0',
        body: { bytesValue: Buffer.from('{}').toString('base64') },
      });
      const res = await post(bad);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ partialSuccess: { rejectedLogRecords: 1 } });
    });

    it('answers a body that is not OTLP at all with a 400 problem', async () => {
      const res = await fromFetch(await post({ not: 'otlp' }));
      expect(res.statusCode).toBe(400);
      parseProblem(res);
    });

    it.todo(
      'BE-1: writes an ingest_rejection row with reason invalid_schema and payload_sha256, never the payload',
    );
    it.todo('BE-1: a rejected record leaves no app.event row');
  });
});
