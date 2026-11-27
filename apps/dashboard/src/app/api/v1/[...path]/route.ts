import { REQUEST_ID_HEADER } from '@fwcoach/contracts';
import { NextResponse } from 'next/server';

import { ServerMode } from '@/config/enums';
import { ConfigError, loadServerConfig } from '@/config/server';
import { problemResponse as problem } from '@/lib/problem-response';
import { mockResponseFor } from '@/mock/routes';

/**
 * The browser's only way to the query API. Read only, because the API is.
 *
 * Identity is added here, server side, from config. Headers from the browser
 * are never forwarded: a client that could send X-Dev-Engineer could claim to
 * be anyone. That includes X-Request-ID: the proxy mints its own per call,
 * so the ID in an API log line always came from this server.
 */

/**
 * Next decodes the segments, so `%2F` or `..` arrive as plain text. Refuse
 * them rather than build a URL that points somewhere else on the API.
 */
function safeSegments(path: readonly string[]): string[] | null {
  const ok = path.every(
    (segment) => segment !== '' && segment !== '.' && segment !== '..' && !segment.includes('/'),
  );
  return ok ? [...path] : null;
}

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  const requestId = crypto.randomUUID();
  const segments = safeSegments((await context.params).path);
  if (!segments) return problem(400, 'Invalid API path.', requestId);

  let config;
  try {
    config = loadServerConfig();
  } catch (error) {
    if (error instanceof ConfigError) return problem(503, error.message, requestId);
    throw error;
  }

  const url = new URL(request.url);
  if (config.mode === ServerMode.Mock) {
    const result = mockResponseFor(segments, url.searchParams);
    return result.status === 200
      ? NextResponse.json(result.body)
      : problem(result.status, result.detail, requestId);
  }

  const target = `${config.apiBaseUrl}/v1/${segments.map(encodeURIComponent).join('/')}${url.search}`;
  const headers = new Headers({
    accept: 'application/json',
    'x-dev-engineer': config.devEngineer,
    [REQUEST_ID_HEADER]: requestId,
  });
  if (config.devRoles) headers.set('x-dev-roles', config.devRoles);

  try {
    const upstream = await fetch(target, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(config.apiTimeoutMs),
    });
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
        [REQUEST_ID_HEADER]: requestId,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return problem(
        504,
        `The API at ${config.apiBaseUrl} did not answer within ${config.apiTimeoutMs} ms. Check its health with /readyz, or raise API_TIMEOUT_MS.`,
        requestId,
      );
    }
    return problem(
      502,
      `Could not reach the API at ${config.apiBaseUrl}. Start it with pnpm dev:api, or check API_BASE_URL.`,
      requestId,
    );
  }
}
