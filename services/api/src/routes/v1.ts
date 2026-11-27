import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

import { resolvePrincipal, type Principal } from '../auth/principal.js';
import type { ApiConfig, HttpLimits } from '../config.js';
import { problem } from '../problem.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the v1 auth hook. Every route under /v1 can rely on it. */
    principal: Principal;
  }
}

/**
 * The query API from spec 7.5. Ingestion is not here: it goes through the
 * Freshworks pipeline (ADR 0002). Every route is registered now so the
 * dashboard and e2e tests can code against the paths. Each returns 501 until
 * its ticket lands.
 *
 * Keep docs/api.md in step with this file.
 */
const routes = [
  { url: '/me/data', ticket: 'BE-2' },
  { url: '/org/:orgUnitId/overview', ticket: 'BE-3' },
  { url: '/leaders/:managerId/rollup', ticket: 'BE-3' },
  { url: '/engineers/:engineerId', ticket: 'BE-2' },
  { url: '/admin/access-log', ticket: 'BE-2' },
  { url: '/skills/adoption', ticket: 'BE-3' },
  { url: '/fleet/health', ticket: 'BE-4' },
] as const;

/**
 * Registered with `{ prefix: '/v1' }`. Fastify scopes the hook to this plugin,
 * so it runs for every route the router matches here, whatever the raw URL
 * looked like. Never gate auth on `request.url` string checks: the router
 * decodes paths, the string check does not.
 */
export function v1(config: Pick<ApiConfig, 'authMode'> & { limits: HttpLimits }) {
  return async function plugin(app: FastifyInstance): Promise<void> {
    app.decorateRequest('principal');
    app.addHook('onRequest', async (request, reply) => {
      const principal = resolvePrincipal(config.authMode, request);
      if (principal === null) {
        await problem(reply, 401, 'Not signed in.');
        return;
      }
      request.principal = principal;
    });

    // Per caller, not per IP: every browser reaches the API through the
    // dashboard's server, so they all share one address. Registered after the
    // auth hook, so the key is always a resolved principal.
    await app.register(rateLimit, {
      max: config.limits.rateLimitMax,
      timeWindow: config.limits.rateLimitWindowMs,
      keyGenerator: (request) => request.principal.engineerId,
    });

    for (const { url, ticket } of routes) {
      app.get(url, (_request, reply) => problem(reply, 501, `Not implemented (${ticket}).`));
    }
  };
}
