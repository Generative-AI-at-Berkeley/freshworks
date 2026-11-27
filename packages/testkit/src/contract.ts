import { api } from '@fwcoach/contracts';
import { z } from 'zod';

/**
 * The parts of a response the contract checks need. Fastify's `inject()`
 * result fits as is. For `fetch`, use `fromFetch`.
 */
export interface ResponseLike {
  statusCode: number;
  headers: Record<string, string | string[] | number | undefined>;
  json(): unknown;
}

export class ContractError extends Error {
  constructor(what: string, detail: string) {
    super(`${what} does not match its contract in packages/contracts. ${detail}`);
    this.name = 'ContractError';
  }
}

function contentType(res: ResponseLike): string {
  const value = res.headers['content-type'];
  return String(Array.isArray(value) ? value[0] : (value ?? ''));
}

function parseWith<S extends z.ZodType>(schema: S, body: unknown, what: string): z.infer<S> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ContractError(what, z.prettifyError(parsed.error));
  return parsed.data;
}

/**
 * Parses a 2xx JSON response with the route's schema from `api.*`, the same
 * one the dashboard parses with, so a shape drift fails here first.
 */
export function parseContract<S extends z.ZodType>(
  schema: S,
  res: ResponseLike,
  what = 'Response',
): z.infer<S> {
  if (res.statusCode < 200 || res.statusCode > 299) {
    throw new ContractError(what, `Expected a 2xx, got ${res.statusCode}.`);
  }
  if (!contentType(res).startsWith('application/json')) {
    throw new ContractError(what, `Expected application/json, got "${contentType(res)}".`);
  }
  return parseWith(schema, res.json(), what);
}

/** Every non-2xx is `application/problem+json` with a matching `status` (docs/api.md). */
export function parseProblem(res: ResponseLike, what = 'Error response'): api.Problem {
  if (!contentType(res).startsWith('application/problem+json')) {
    throw new ContractError(what, `Expected application/problem+json, got "${contentType(res)}".`);
  }
  const problem = parseWith(api.Problem, res.json(), what);
  if (problem.status !== res.statusCode) {
    throw new ContractError(what, `Body status ${problem.status} != HTTP ${res.statusCode}.`);
  }
  return problem;
}

/**
 * Any response from a route: a 2xx parses with `schema`, anything else is a
 * Problem. This is the property that must hold whatever the caller is allowed to see.
 */
export function parseAny<S extends z.ZodType>(
  schema: S,
  res: ResponseLike,
  what = 'Response',
): { ok: true; body: z.infer<S> } | { ok: false; problem: api.Problem } {
  return res.statusCode >= 200 && res.statusCode <= 299
    ? { ok: true, body: parseContract(schema, res, what) }
    : { ok: false, problem: parseProblem(res, what) };
}

/** Adapts a `fetch` Response, reading the body once. */
export async function fromFetch(res: Response): Promise<ResponseLike> {
  const text = await res.text();
  return {
    statusCode: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    json: () => JSON.parse(text) as unknown,
  };
}
