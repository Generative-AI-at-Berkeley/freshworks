/**
 * pnpm gen:openapi: writes docs/openapi.json from the query API schemas in
 * packages/contracts/src/api. CI regenerates it and fails on a diff, so the
 * committed file always matches the contracts.
 *
 * Paths come from the route table in docs/api.md. The script fails if the two
 * lists drift, so a route added there must be added here too.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { api } from '@fwcoach/contracts';
import { format, resolveConfig } from 'prettier';
import { z } from 'zod';

const API_DOC = fileURLToPath(new URL('../docs/api.md', import.meta.url));
const OUT = fileURLToPath(new URL('../docs/openapi.json', import.meta.url));

const RouteStatus = { Draft: 'draft', Done: 'done' } as const;
type RouteStatus = (typeof RouteStatus)[keyof typeof RouteStatus];

interface Param {
  name: string;
  in: 'path' | 'query';
  schema: z.ZodType;
  description: string;
}

interface Route {
  path: string;
  summary: string;
  ticket: string;
  status: RouteStatus;
  /** Name of the response schema in the contracts `api` namespace. */
  response: keyof typeof api | null;
  params: readonly Param[];
  /** Everything under /v1 needs a principal. /healthz and /readyz do not. */
  auth: boolean;
}

const range: readonly Param[] = [
  {
    name: 'from',
    in: 'query',
    schema: api.Day,
    description: 'First UTC day of the range, inclusive.',
  },
  { name: 'to', in: 'query', schema: api.Day, description: 'UTC day the range ends, exclusive.' },
];
const explain: Param = {
  name: 'explain',
  in: 'query',
  schema: z.enum(['true']),
  description: 'Adds the price_book rows used and the usage each one priced.',
};
const cursor: Param = {
  name: 'cursor',
  in: 'query',
  schema: z.string(),
  description: 'The nextCursor from the previous page.',
};
const pathId = (name: string): Param => ({
  name,
  in: 'path',
  schema: z.string(),
  description: '',
});

const routes: readonly Route[] = [
  {
    path: '/v1/me/data',
    summary: 'Anyone, for themselves. Includes the raw rows behind their numbers.',
    ticket: 'BE-2',
    status: RouteStatus.Draft,
    response: 'MyData',
    params: [...range, cursor, explain],
    auth: true,
  },
  {
    path: '/v1/org/{orgUnitId}/overview',
    summary: 'Managers of that unit, admins.',
    ticket: 'BE-3',
    status: RouteStatus.Draft,
    response: 'OrgOverview',
    params: [pathId('orgUnitId'), ...range, explain],
    auth: true,
  },
  {
    path: '/v1/leaders/{managerId}/rollup',
    summary: 'That manager and their chain, admins.',
    ticket: 'BE-3',
    status: RouteStatus.Draft,
    response: 'LeaderRollup',
    params: [
      pathId('managerId'),
      ...range,
      {
        name: 'depth',
        in: 'query',
        schema: z.int().min(1),
        description: 'Levels of the reporting tree to roll up.',
      },
      explain,
    ],
    auth: true,
  },
  {
    path: '/v1/engineers/{engineerId}',
    summary: 'The engineer, their chain as of the date, admins. Writes access_log.',
    ticket: 'BE-2',
    status: RouteStatus.Draft,
    response: 'EngineerDetail',
    params: [pathId('engineerId'), ...range],
    auth: true,
  },
  {
    path: '/v1/admin/access-log',
    summary: 'Admins.',
    ticket: 'BE-2',
    status: RouteStatus.Draft,
    response: 'AccessLog',
    params: [
      ...range,
      {
        name: 'subject',
        in: 'query',
        schema: z.string(),
        description: 'Only views of this engineer.',
      },
      cursor,
    ],
    auth: true,
  },
  {
    path: '/v1/skills/adoption',
    summary: 'Managers (scoped to subtree), admins.',
    ticket: 'BE-3',
    status: RouteStatus.Draft,
    response: 'SkillAdoption',
    params: range,
    auth: true,
  },
  {
    path: '/v1/fleet/health',
    summary: 'Admins.',
    ticket: 'BE-4',
    status: RouteStatus.Draft,
    response: 'FleetHealth',
    params: range,
    auth: true,
  },
  {
    path: '/healthz',
    summary: 'Liveness.',
    ticket: 'done',
    status: RouteStatus.Done,
    response: null,
    params: [],
    auth: false,
  },
  {
    path: '/readyz',
    summary: 'Readiness, including Postgres. 503 when Postgres is unreachable.',
    ticket: 'done',
    status: RouteStatus.Done,
    response: null,
    params: [],
    auth: false,
  },
];

/** `GET /v1/org/{orgUnitId}/overview` and friends, from the docs/api.md table. */
function documentedPaths(): string[] {
  const table = readFileSync(API_DOC, 'utf8').split('## Routes')[1]?.split('\n## ')[0] ?? '';
  return [...table.matchAll(/`GET ([^`?]+)(?:\?[^`]*)?`/g)].map((match) => match[1] ?? '');
}

function checkInSync(): void {
  const documented = new Set(documentedPaths());
  const generated = new Set(routes.map((route) => route.path));
  const missing = [...documented].filter((path) => !generated.has(path));
  const extra = [...generated].filter((path) => !documented.has(path));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `docs/api.md and scripts/gen-openapi.ts list different routes. ` +
        `Only in the doc: ${missing.join(', ') || 'none'}. ` +
        `Only in the script: ${extra.join(', ') || 'none'}. Update the script.`,
    );
  }
}

function componentSchemas(): Record<string, unknown> {
  const registry = z.registry<{ id: string }>();
  for (const [name, value] of Object.entries(api)) {
    if (value instanceof z.ZodType) registry.add(value, { id: name });
  }
  const { schemas } = z.toJSONSchema(registry, {
    uri: (id) => `#/components/schemas/${id}`,
    io: 'output',
  });
  // OpenAPI 3.1 sets the dialect once, and the component key is the id.
  return Object.fromEntries(
    Object.entries(schemas)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, schema]) => {
        const { $id: _id, $schema: _schema, ...rest } = schema;
        return [name, rest];
      }),
  );
}

function paramSchema(schema: z.ZodType): unknown {
  const { $schema: _schema, ...rest } = z.toJSONSchema(schema, { io: 'input' });
  return rest;
}

const problemResponse = {
  description: 'Error. `detail` says what broke and what to do.',
  content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } } },
};

const statusBody = (value: string) => ({
  type: 'object',
  properties: { status: { const: value } },
  required: ['status'],
});

function operation(route: Route): Record<string, unknown> {
  const draft = route.status === RouteStatus.Draft;
  const okSchema =
    route.response === null ? statusBody('ok') : { $ref: `#/components/schemas/${route.response}` };
  return {
    summary: route.summary,
    description: draft
      ? `Draft. The response shape is the dashboard's proposal and ${route.ticket} owns the final one. ` +
        `Returns 501 until ${route.ticket} lands.`
      : 'Implemented.',
    'x-status': route.status,
    ...(draft ? { 'x-ticket': route.ticket } : {}),
    ...(route.auth ? {} : { security: [] }),
    parameters: route.params.map((param) => ({
      name: param.name,
      in: param.in,
      required: param.in === 'path',
      ...(param.description === '' ? {} : { description: param.description }),
      schema: paramSchema(param.schema),
    })),
    responses: {
      '200': { description: 'OK.', content: { 'application/json': { schema: okSchema } } },
      ...(route.path === '/readyz'
        ? {
            '503': {
              description: 'Postgres is unreachable.',
              content: { 'application/json': { schema: statusBody('unavailable') } },
            },
          }
        : { default: problemResponse }),
    },
  };
}

function document(): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: {
      title: 'fwcoach query API',
      version: '0.0.0',
      description:
        'Generated from packages/contracts/src/api by `pnpm gen:openapi`. Do not edit by hand. ' +
        'Conventions and auth are in docs/api.md.',
    },
    servers: [{ url: 'http://localhost:8080', description: 'Local API (`pnpm dev:api`).' }],
    security: [{ oidc: [] }, { devHeaders: [] }],
    paths: Object.fromEntries(routes.map((route) => [route.path, { get: operation(route) }])),
    components: {
      securitySchemes: {
        oidc: {
          type: 'http',
          scheme: 'bearer',
          description:
            'Bearer token from the corporate IdP. `sub` maps to engineer.sso_subject. Not implemented yet (BE-2).',
        },
        devHeaders: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Dev-Engineer',
          description:
            'Local mode only: an employee id, with optional `X-Dev-Roles: platform_admin`. ' +
            'Refused unless NODE_ENV is development or test, or API_ALLOW_HEADER_AUTH=true.',
        },
      },
      schemas: componentSchemas(),
    },
  };
}

checkInSync();
const json = JSON.stringify(document(), null, 2);
const options = (await resolveConfig(OUT)) ?? {};
writeFileSync(OUT, await format(json, { ...options, filepath: OUT }));
