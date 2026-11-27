import { api } from '@fwcoach/contracts';
import type { z } from 'zod';

import { PROXY_PREFIX } from '@/config/constants';
import type { DayRange } from '@/lib/range';
import { Session } from '@/lib/session';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Pull the sentence out of a problem+json body, the shape every API and proxy error uses. */
export function parseError(body: string, status: number, path: string): ApiError {
  try {
    const problem = api.Problem.safeParse(JSON.parse(body));
    if (problem.success) return new ApiError(problem.data.detail, status);
  } catch {
    // Not JSON. Fall through to a generic sentence.
  }
  return new ApiError(`Request to ${path} failed with status ${status}.`, status);
}

/**
 * Every response is parsed against the shared contract. A field the API
 * renamed fails here with the path, instead of rendering as blank cells.
 */
async function request<S extends z.ZodType>(path: string, schema: S): Promise<z.infer<S>> {
  let response: Response;
  try {
    response = await fetch(`${PROXY_PREFIX}${path}`, { headers: { accept: 'application/json' } });
  } catch {
    throw new ApiError(
      'Could not reach the dashboard server. Check that pnpm dev:dashboard is running.',
      0,
    );
  }
  if (!response.ok) {
    throw parseError(await response.text().catch(() => ''), response.status, path);
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new ApiError(
      `The response from ${path} does not match the contract in packages/contracts. The API and dashboard disagree on its shape.`,
      response.status,
    );
  }
  return parsed.data;
}

function query(params: Record<string, string | number>): string {
  const search = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  );
  return `?${search.toString()}`;
}

const id = encodeURIComponent;

/** The only module that knows the API's URL shape. Everything else calls these. */
export const apiClient = {
  session: () => request('/session', Session),
  skillAdoption: (range: DayRange) =>
    request(`/v1/skills/adoption${query({ ...range })}`, api.SkillAdoption),
  orgOverview: (orgUnitId: string, range: DayRange) =>
    request(`/v1/org/${id(orgUnitId)}/overview${query({ ...range })}`, api.OrgOverview),
  leaderRollup: (managerId: string, depth: number, range: DayRange) =>
    request(`/v1/leaders/${id(managerId)}/rollup${query({ depth, ...range })}`, api.LeaderRollup),
  engineer: (engineerId: string, range: DayRange) =>
    request(`/v1/engineers/${id(engineerId)}${query({ ...range })}`, api.EngineerDetail),
};
