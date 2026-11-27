import { NextResponse } from 'next/server';

import { PLATFORM_ADMIN_ROLE, ServerMode } from '@/config/enums';
import { ConfigError, loadServerConfig } from '@/config/server';
import { problemResponse } from '@/lib/problem-response';
import type { Session } from '@/lib/session';
import { MOCK_VIEWER } from '@/mock/org';

// Reads config per request. Never prerender it at build time.
export const dynamic = 'force-dynamic';

/** Who the dashboard is acting as. See src/lib/session.ts. */
export function GET(): Response {
  let config;
  try {
    config = loadServerConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      return problemResponse(503, error.message);
    }
    throw error;
  }
  const session: Session =
    config.mode === ServerMode.Mock
      ? { mode: ServerMode.Mock, ...MOCK_VIEWER }
      : {
          mode: ServerMode.Api,
          engineerId: config.devEngineer,
          orgUnitId: config.devOrgUnit,
          // TODO(X-3): names come from /v1/me/data once BE-2 serves it.
          displayName: null,
          orgUnitName: null,
          isAdmin: (config.devRoles ?? '')
            .split(',')
            .map((role) => role.trim())
            .includes(PLATFORM_ADMIN_ROLE),
        };
  return NextResponse.json(session, { headers: { 'cache-control': 'no-store' } });
}
