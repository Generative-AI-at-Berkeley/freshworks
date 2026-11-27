import { NextResponse, type NextRequest } from 'next/server';

import { isDevelopment } from '@/config/server';
import { contentSecurityPolicy } from '@/lib/csp';

/**
 * Sets a per-request CSP nonce. Next reads the CSP from the request headers
 * and puts the nonce on its own scripts. The root layout reads `x-nonce` for
 * the theme init script. Pages render per request already (layout.tsx), so a
 * nonce costs no static rendering.
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce, isDevelopment());

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', csp);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set('content-security-policy', csp);
  return response;
}

export const config = {
  // JSON routes and hashed static files need no page CSP. Prefetches reuse
  // the page's policy.
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|dew|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
