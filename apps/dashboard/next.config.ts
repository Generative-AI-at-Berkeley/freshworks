import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Next writes its own AGENTS.md and CLAUDE.md here on every dev run. The
  // rules for this repo live in the root AGENTS.md. Turn the generator off.
  agentRules: false,
  reactStrictMode: true,
  poweredByHeader: false,
  // The dev badge sits bottom-left by default, over the sidebar's theme toggle.
  devIndicators: { position: 'bottom-right' },
  // The container (apps/dashboard/Dockerfile) runs .next/standalone/server.js.
  // Tracing starts at the repo root so workspace packages are copied too.
  // `next start` still works, with a warning.
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  // The CSP needs a per-request nonce, so src/proxy.ts sets it. These are the
  // same on every response, API routes included.
  headers() {
    return Promise.resolve([{ source: '/:path*', headers: SECURITY_HEADERS }]);
  },
};

const SECURITY_HEADERS = [
  // Browsers ignore HSTS over plain http, so local runs are unaffected.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // CSP frame-ancestors covers modern browsers. This covers the rest.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
];

export default nextConfig;
