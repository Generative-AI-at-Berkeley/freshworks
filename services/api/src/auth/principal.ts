import type { FastifyRequest } from 'fastify';

import { AuthMode } from '../config.js';

export const Role = {
  Engineer: 'engineer',
  /** Has at least one direct report on the date being viewed. Derived, never assigned. */
  Manager: 'manager',
  PlatformAdmin: 'platform_admin',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export interface Principal {
  engineerId: string;
  roles: Role[];
}

/**
 * Resolves who is calling.
 *
 * local: reads `X-Dev-Engineer: <employee id>`, and `X-Dev-Roles: platform_admin`
 *        to act as an admin. Dev, test and the local demo only (see config.ts).
 *        `manager` cannot be claimed by header: it is derived from
 *        manager_edge, same as with OIDC.
 * oidc:  TODO(BE-2). Verify the bearer token against the corporate IdP, map
 *        the `sub` claim to engineer.sso_subject. Endpoint and client ID come
 *        from configuration.
 */
export function resolvePrincipal(mode: AuthMode, request: FastifyRequest): Principal | null {
  if (mode === AuthMode.Oidc) return null;

  const engineerId = request.headers['x-dev-engineer'];
  if (typeof engineerId !== 'string' || engineerId === '') return null;

  const rawRoles = request.headers['x-dev-roles'];
  const claimed = typeof rawRoles === 'string' ? rawRoles.split(',').map((r) => r.trim()) : [];
  const roles: Role[] = [Role.Engineer];
  if (claimed.includes(Role.PlatformAdmin)) roles.push(Role.PlatformAdmin);
  // TODO(BE-2): add Role.Manager when manager_edge says this engineer has reports.
  return { engineerId, roles };
}
