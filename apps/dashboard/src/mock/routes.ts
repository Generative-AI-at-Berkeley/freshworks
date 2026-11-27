import type { DayRange } from '@/lib/range';
import { lastDays } from '@/lib/range';
import { accessLog, fleetHealth, myData } from '@/mock/admin';
import { engineer, leaderRollup, orgOverview, skillAdoption } from '@/mock/responses';

export type MockResult = { status: 200; body: unknown } | { status: 404; detail: string };

function rangeFrom(search: URLSearchParams): DayRange {
  const fallback = lastDays();
  return { from: search.get('from') ?? fallback.from, to: search.get('to') ?? fallback.to };
}

const found = (body: unknown): MockResult =>
  body === null ? notFound('No such id in the mock org.') : { status: 200, body };
const notFound = (detail: string): MockResult => ({ status: 404, detail });

/**
 * Answers a `/v1/...` path the way the API will, for mock mode. Path is the
 * segments after `/v1`, already decoded.
 */
export function mockResponseFor(path: readonly string[], search: URLSearchParams): MockResult {
  const range = rangeFrom(search);
  const [resource, id, action] = path;
  if (resource === 'skills' && id === 'adoption' && path.length === 2)
    return found(skillAdoption(range));
  if (resource === 'org' && id && action === 'overview' && path.length === 3)
    return found(orgOverview(id, range));
  if (resource === 'leaders' && id && action === 'rollup' && path.length === 3) {
    const depth = Number(search.get('depth') ?? '1');
    if (!Number.isInteger(depth) || depth < 1)
      return notFound('depth must be a whole number of at least 1.');
    return found(leaderRollup(id, depth, range));
  }
  if (resource === 'engineers' && id && path.length === 2) return found(engineer(id, range));
  if (resource === 'fleet' && id === 'health' && path.length === 2)
    return found(fleetHealth(range));
  if (resource === 'admin' && id === 'access-log' && path.length === 2)
    return found(accessLog(range, search.get('cursor'), search.get('subject')));
  if (resource === 'me' && id === 'data' && path.length === 2)
    return found(myData(range, search.get('cursor')));
  return notFound(`No mock data for /v1/${path.join('/')}. Add it in apps/dashboard/src/mock.`);
}
