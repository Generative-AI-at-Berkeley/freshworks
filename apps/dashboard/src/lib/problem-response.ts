import { api, REQUEST_ID_HEADER } from '@fwcoach/contracts';
import { NextResponse } from 'next/server';

/**
 * A problem+json response from this app's own /api routes, same body as the
 * API's. With a request id, the body and the X-Request-ID header both carry
 * it, so the error a person sees matches the server's log line.
 */
export function problemResponse(status: number, detail: string, requestId?: string): NextResponse {
  const headers: Record<string, string> = {
    'content-type': api.PROBLEM_CONTENT_TYPE,
    'cache-control': 'no-store',
  };
  if (requestId !== undefined) headers[REQUEST_ID_HEADER] = requestId;
  return NextResponse.json(api.problem(status, detail, requestId), { status, headers });
}
