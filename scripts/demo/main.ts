/**
 * pnpm demo:      the whole stack on synthetic data, ready to click through.
 * pnpm demo:down: stop it and delete its database volume.
 *
 * Runs as its own compose project, so demo:down never deletes the volume your
 * `docker compose up` dev stack uses. Safe to run twice: compose only
 * recreates what changed, and ingestion de-duplicates replayed events on
 * msg_id.
 *
 * Steps that wait on unfinished tickets print one line naming the ticket and
 * the demo carries on without them. See docs/runbooks/demo.md.
 */
import { spawnSync } from 'node:child_process';

import { encodeBatch, OTLP_LOGS_PATH } from '@fwcoach/contracts';
import {
  generateDay,
  generateOrg,
  type DeviceTraffic,
  type SyntheticPerson,
} from '@fwcoach/testkit';

import { inheritedEnv, loadConfig, type DemoConfig } from './config.js';

const PROJECT = 'fwcoach-demo';
const AGENT_VERSION = 'demo';
/** Where the dashboard container reaches the API, inside the compose network. */
const API_URL_IN_COMPOSE = 'http://api:8080';

const DashboardMode = { Mock: 'mock', Api: 'api' } as const;
type DashboardMode = (typeof DashboardMode)[keyof typeof DashboardMode];

interface DevIdentity {
  engineerId: string;
  orgUnitId: string;
}

const say = (line = ''): void => {
  process.stdout.write(`${line}\n`);
};
const step = (title: string): void => {
  say(`\n== ${title}`);
};
/** One line for a step that runs in a reduced form until a ticket lands. */
const degraded: string[] = [];
const degrade = (ticket: string, line: string): void => {
  degraded.push(`${ticket}: ${line}`);
  say(`   degraded (${ticket}): ${line}`);
};

function compose(args: string[], options: { env?: NodeJS.ProcessEnv; quiet?: boolean } = {}) {
  const result = spawnSync('docker', ['compose', '-p', PROJECT, ...args], {
    env: { ...inheritedEnv(), ...options.env },
    stdio: options.quiet ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });
  // With inherited stdio there is nothing captured: the user saw it already.
  const captured = options.quiet === true;
  return {
    ok: result.status === 0,
    stdout: captured ? result.stdout : '',
    stderr: captured ? result.stderr : '',
  };
}

function fail(message: string): never {
  say(`\n${message}`);
  process.exit(1);
}

function errorLine(error: unknown): string {
  return error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error);
}

function psql(sql: string): string | null {
  const result = compose(
    ['exec', '-T', 'postgres', 'psql', '-U', 'fwcoach', '-d', 'fwcoach', '-Atc', sql],
    { quiet: true },
  );
  return result.ok ? result.stdout.trim() : null;
}

function yesterdayUtc(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

function startInfra(config: DemoConfig): void {
  step('Postgres, migrations, ingest-mock and the API (docker compose)');
  if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
    fail('Docker is not running. Start Docker and run pnpm demo again.');
  }
  // --wait also waits for the one-shot migrate service to exit cleanly.
  if (!compose(['up', '-d', '--build', '--wait']).ok) {
    fail(
      'docker compose up failed. If a port is taken, set POSTGRES_PORT, INGEST_PORT or API_PORT and run pnpm demo again.',
    );
  }
  say(`   Postgres on localhost:${config.postgresPort}, migrations applied`);
}

function reportSchema(): boolean {
  step('Schema');
  const applied = psql('select count(*) from schema_migrations');
  const tables = psql(
    "select coalesce(string_agg(table_name, ', ' order by table_name), '') from information_schema.tables where table_schema = 'app'",
  );
  say(`   ${applied ?? '?'} migration(s) applied`);
  say(`   tables in app: ${tables === null || tables === '' ? 'none' : tables}`);
  const hasEvents = psql("select to_regclass('app.event') is not null") === 't';
  if (!hasEvents)
    degrade('BE-1', 'no app.event table yet, so nothing in Postgres holds raw events');
  return hasEvents;
}

function seedOrg(config: DemoConfig): SyntheticPerson[] {
  step('Synthetic org (packages/testkit)');
  let people: SyntheticPerson[];
  try {
    // The spec's acceptance run: ten or more engineers, three departments,
    // two management levels, one reorg.
    people = generateOrg({
      seed: config.seed,
      departments: 3,
      levels: 2,
      engineersPerTeam: 3,
      reorgOn: new Date(`${yesterdayUtc()}T00:00:00Z`),
    });
  } catch (error) {
    degrade('BE-2', errorLine(error));
    return [];
  }
  say(`   generated ${people.length} directory records, seed ${config.seed}`);
  // TODO(BE-2): load `people` into engineer, org_unit and manager_edge through
  // the directory sync (a DirectorySource over generateOrg, see
  // services/api/src/directory/source.ts). It must be idempotent, because
  // pnpm demo runs it on every start.
  degrade('BE-2', 'no directory loader yet, so the org is not written to Postgres');
  return people;
}

async function replayTraffic(
  config: DemoConfig,
  people: SyntheticPerson[],
  hasEvents: boolean,
): Promise<void> {
  step('Synthetic traffic through ingest-mock');
  if (people.length === 0) {
    degrade('BE-2', 'skipped: generateDay (AG-1) needs the synthetic org');
    return;
  }
  const day = yesterdayUtc();
  let devices: DeviceTraffic[];
  try {
    devices = generateDay(people, day, config.seed);
  } catch (error) {
    degrade('AG-1', errorLine(error));
    return;
  }

  const url = `http://localhost:${config.ingestPort}${OTLP_LOGS_PATH}`;
  let sent = 0;
  let rejected = 0;
  for (const device of devices) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${device.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(encodeBatch(device.events, { agentVersion: AGENT_VERSION })),
    });
    if (!response.ok) {
      fail(
        `ingest-mock answered ${response.status} for a synthetic batch. Check docker compose -p ${PROJECT} logs ingest-mock.`,
      );
    }
    const body = (await response.json()) as { partialSuccess?: { rejectedLogRecords?: number } };
    sent += device.events.length;
    rejected += body.partialSuccess?.rejectedLogRecords ?? 0;
  }
  say(`   ${day}: ${sent} events from ${devices.length} devices, ${rejected} rejected`);
  if (!hasEvents) {
    degrade('BE-1', 'ingest-mock keeps events in memory, so the API cannot read them yet');
  }
}

function runRollup(): void {
  step('Daily rollup job');
  const day = yesterdayUtc();
  const result = compose(['exec', '-T', 'api', 'node', 'dist/jobs/cli.js', 'rollup', day], {
    quiet: true,
  });
  if (result.ok) {
    say(`   rolled up ${day}`);
    return;
  }
  const reason = /Error: (.*)/.exec(result.stderr)?.[1] ?? 'the job failed';
  degrade('BE-3', reason);
}

/**
 * The dashboard reads these routes. It only gets real data when every one of
 * them answers, so one 501 is enough to keep it on mock data.
 */
async function probeApi(config: DemoConfig, identity: DevIdentity | null): Promise<boolean> {
  step('Query API');
  const base = `http://localhost:${config.apiPort}`;
  const ready = await fetch(`${base}/readyz`).catch(() => null);
  if (!ready?.ok)
    fail(`The API is not ready at ${base}/readyz. Check docker compose -p ${PROJECT} logs api.`);
  say(`   ready at ${base}`);

  // Any ID will do to see whether a route is implemented at all.
  const engineerId = identity?.engineerId ?? 'demo-probe';
  const orgUnitId = identity?.orgUnitId ?? 'demo-probe';
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 28 * 86_400_000).toISOString().slice(0, 10);
  const range = `from=${from}&to=${to}`;
  const paths = [
    `/v1/skills/adoption?${range}`,
    `/v1/org/${encodeURIComponent(orgUnitId)}/overview?${range}`,
    `/v1/leaders/${encodeURIComponent(engineerId)}/rollup?depth=1&${range}`,
    `/v1/engineers/${encodeURIComponent(engineerId)}?${range}`,
  ];

  let allServe = true;
  for (const path of paths) {
    const response = await fetch(`${base}${path}`, {
      headers: { 'x-dev-engineer': engineerId, 'x-dev-roles': 'platform_admin' },
    });
    const route = path.split('?')[0] ?? path;
    if (response.ok) {
      say(`   ${route}: ${response.status}`);
      continue;
    }
    allServe = false;
    const body = (await response.json().catch(() => ({}))) as { detail?: string };
    const ticket = /\((\w+-\d+)\)/.exec(body.detail ?? '')?.[1];
    if (ticket) degrade(ticket, `${route} answers ${response.status}`);
    else say(`   ${route}: ${response.status} ${body.detail ?? ''}`);
  }
  return allServe && identity !== null;
}

async function startDashboard(
  config: DemoConfig,
  identity: DevIdentity | null,
): Promise<DashboardMode> {
  const mode = identity ? DashboardMode.Api : DashboardMode.Mock;
  step(`Dashboard (container, ${mode} mode)`);
  const env: NodeJS.ProcessEnv = identity
    ? {
        DASHBOARD_API_BASE_URL: API_URL_IN_COMPOSE,
        DASHBOARD_DEV_ENGINEER: identity.engineerId,
        DASHBOARD_DEV_ORG_UNIT: identity.orgUnitId,
        DASHBOARD_DEV_ROLES: 'platform_admin',
      }
    : {
        DASHBOARD_API_BASE_URL: '',
        DASHBOARD_DEV_ENGINEER: '',
        DASHBOARD_DEV_ORG_UNIT: '',
        DASHBOARD_DEV_ROLES: '',
      };
  if (
    !compose(['--profile', 'dashboard', 'up', '-d', '--build', '--wait', 'dashboard'], { env }).ok
  ) {
    fail(
      `The dashboard container did not start. If port ${config.dashboardPort} is taken, set DASHBOARD_PORT and run pnpm demo again.`,
    );
  }

  // Ask the dashboard which mode it is really in, rather than trust the env.
  const session = await fetch(`http://localhost:${config.dashboardPort}/api/session`)
    .then((r) => r.json() as Promise<{ mode?: string }>)
    .catch(() => ({ mode: undefined }));
  if (session.mode !== mode) {
    fail(
      `The dashboard reports mode "${session.mode ?? 'unknown'}", expected "${mode}". Check docker compose -p ${PROJECT} logs dashboard.`,
    );
  }
  return mode;
}

/** The top of the synthetic org, so every view has someone under it. */
function pickIdentity(people: SyntheticPerson[]): DevIdentity | null {
  const top = people.find((p) => p.managerId === null);
  return top ? { engineerId: top.employeeId, orgUnitId: top.departmentId } : null;
}

async function up(config: DemoConfig): Promise<void> {
  startInfra(config);
  const hasEvents = reportSchema();
  const people = seedOrg(config);
  await replayTraffic(config, people, hasEvents);
  runRollup();
  const identity = pickIdentity(people);
  const apiServes = await probeApi(config, identity);
  const mode = await startDashboard(config, apiServes ? identity : null);

  step('Ready');
  say(`   Dashboard   http://localhost:${config.dashboardPort}`);
  say(
    mode === DashboardMode.Api
      ? `               api mode, acting as ${identity?.engineerId ?? ''} (platform_admin)`
      : '               mock mode: the API cannot serve the dashboard yet, so it shows the built-in org in apps/dashboard/src/mock',
  );
  say(`   API         http://localhost:${config.apiPort}`);
  say(`   ingest-mock http://localhost:${config.ingestPort}`);
  if (degraded.length > 0) {
    say(`\n   Waiting on tickets:`);
    for (const line of degraded) say(`   - ${line}`);
  }
  say('\n   Stop and delete the demo data with pnpm demo:down.');
}

function down(): void {
  // --profile dashboard so the dashboard container is removed too.
  if (!compose(['--profile', 'dashboard', 'down', '-v', '--remove-orphans']).ok) {
    fail('docker compose down failed. Is Docker running?');
  }
  say('Demo stopped. Its containers and database volume are gone.');
}

const command = process.argv[2] ?? 'up';
if (command === 'up') await up(loadConfig());
else if (command === 'down') down();
else fail(`Unknown command "${command}". Use pnpm demo or pnpm demo:down.`);
